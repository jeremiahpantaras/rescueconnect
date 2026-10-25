// Retry timing for reports saved on the phone. Pure functions, no browser APIs.

// Short on purpose: a report that is waiting could be someone asking for rescue, so while the app is open we
// would rather retry every minute than leave it for minutes after the signal has come back.
const STEPS_MS = [15_000, 30_000, 60_000];

/** How long to wait before the next automatic attempt, after `attempts` failed ones (with ±20% jitter). */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const step = STEPS_MS[Math.min(Math.max(attempts, 1), STEPS_MS.length) - 1];
  return Math.round(step * (0.8 + random() * 0.4));
}

/**
 * How long one attempt may take. It grows with each failure (30 s, 60 s, 2 min, then 4 min) so that a slow but
 * working connection can eventually finish uploading photos instead of being cut off every time.
 */
export function attemptTimeoutMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.min(Math.max(attempts, 0), 3), 240_000);
}

/** Milliseconds until the next automatic attempt is due, or null when nothing is waiting to be retried. */
export function nextFlushDelayMs(
  items: ReadonlyArray<{ nextAttemptAt: number; blockedReason: string | null }>,
  now: number = Date.now()
): number | null {
  const waiting = items.filter((item) => !item.blockedReason);
  if (waiting.length === 0) return null;
  return Math.max(1_000, Math.min(...waiting.map((item) => item.nextAttemptAt)) - now);
}
