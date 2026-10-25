// Sends the reports saved on this phone. Runs whenever RescueConnect is open (see OutboxBanner): on load, when the
// connection returns, when the tab is shown again, and on a backoff timer. Safe to run in several tabs at once:
// a Web Lock keeps them from sending the same report together, and the server ignores repeat sends anyway.
import { ApiError, postReport, rememberSent } from './api';
import {
  emitOutboxChanged,
  emitReportSent,
  isInFlight,
  listOutboxItems,
  putOutboxItem,
  removeOutboxItem,
  setInFlight,
  type OutboxItem,
} from './outbox';
import { attemptTimeoutMs, backoffMs } from './retry';

let flushing = false;

async function withLock<T>(work: () => Promise<T>): Promise<T | null> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return work();
  return locks.request('rescueconnect-outbox', { ifAvailable: true }, async (lock) => (lock ? work() : null));
}

/** Returns true when the server accepted the report. */
async function sendOne(item: OutboxItem): Promise<boolean> {
  setInFlight(item.id, true);
  try {
    const report = await postReport(item, attemptTimeoutMs(item.attempts));
    await removeOutboxItem(item.id);
    rememberSent(item, report);
    emitReportSent({ item, report });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    const retryable = error instanceof ApiError ? error.retryable : true;
    const attempts = item.attempts + 1;
    await putOutboxItem(
      retryable
        ? { ...item, attempts, nextAttemptAt: Date.now() + backoffMs(attempts), lastError: message, blockedReason: null }
        : { ...item, attempts, lastError: message, blockedReason: message }
    );
    return false;
  } finally {
    setInFlight(item.id, false);
    emitOutboxChanged();
  }
}

/** Send what is due (or everything waiting, with `force`). Does nothing if a send round is already running. */
export async function flushOutbox(options: { force?: boolean } = {}): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    await withLock(async () => {
      let delivered = false;
      for (const item of await listOutboxItems()) {
        if (item.blockedReason || isInFlight(item.id)) continue;
        if (!options.force && item.nextAttemptAt > Date.now()) continue;
        if (await sendOne(item)) delivered = true;
      }
      if (delivered) {
        // One report got through, so the connection works right now: do not make the others wait out their
        // retry delay (they may be reports that failed earlier, while the signal was down).
        for (const item of await listOutboxItems()) {
          if (item.blockedReason || isInFlight(item.id)) continue;
          await sendOne(item);
        }
      }
    });
  } catch {
    // Storage or locking problems must never break the page; the next round tries again.
  } finally {
    flushing = false;
  }
}

/** "Send now" for one report, including one the server refused earlier. */
export async function sendNow(id: string): Promise<void> {
  const item = (await listOutboxItems()).find((candidate) => candidate.id === id);
  if (!item || isInFlight(id)) return;
  await putOutboxItem({ ...item, blockedReason: null, nextAttemptAt: 0 });
  emitOutboxChanged();
  await flushOutbox({ force: true });
}

export async function discardReport(id: string): Promise<void> {
  await removeOutboxItem(id);
  emitOutboxChanged();
}
