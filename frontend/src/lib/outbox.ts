// The outbox: reports saved on this phone until they can be sent (store-and-forward).
// A report is written here BEFORE the first send attempt, so closing the tab, losing signal, or a crash
// cannot lose it. It is removed only after the server has confirmed it. IndexedDB (not localStorage) is used
// because photos are stored with it.
import type { ReportType } from './api';

export interface OutboxItem {
  /** Idempotency key sent as client_ref: sending the same report twice can never create two reports. */
  id: string;
  /** Device clock when the citizen pressed submit (ISO). Sent as reported_at so staff can see delays. */
  createdAt: string;
  reportType: ReportType;
  location: { lat: number; lng: number };
  message: string;
  photos: File[];
  attempts: number;
  /** Epoch ms; automatic retries wait until then (a manual "Send now" ignores it). */
  nextAttemptAt: number;
  lastError: string | null;
  /** Set when the server refused the report for a reason retrying cannot fix. Kept so the person can see it. */
  blockedReason: string | null;
}

export interface SentNotice {
  item: OutboxItem;
  report: { id: number; tracking_code: string };
}

const DB_NAME = 'rescueconnect';
const STORE = 'outbox';
const CHANGED = 'rescueconnect:outbox-changed';
const SENT = 'rescueconnect:report-sent';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot save reports on the device.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open device storage.'));
  });
  dbPromise = opening;
  opening.catch(() => {
    dbPromise = null; // allow a later retry (for example after storage permission changes)
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = work(transaction.objectStore(STORE));
        // Resolve on transaction completion, so the write is durable before we report success.
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error ?? new Error('Device storage failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Device storage was interrupted.'));
      })
  );
}

export function putOutboxItem(item: OutboxItem): Promise<void> {
  return run('readwrite', (store) => store.put(item)).then(() => undefined);
}

export function removeOutboxItem(id: string): Promise<void> {
  return run('readwrite', (store) => store.delete(id)).then(() => undefined);
}

export async function listOutboxItems(): Promise<OutboxItem[]> {
  const items = await run<OutboxItem[]>('readonly', (store) => store.getAll());
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---- which items are being sent right now (this tab) ----
const inFlight = new Set<string>();

export function isInFlight(id: string): boolean {
  return inFlight.has(id);
}

export function setInFlight(id: string, sending: boolean) {
  if (sending) inFlight.add(id);
  else inFlight.delete(id);
  emitOutboxChanged();
}

// ---- change notifications (this tab, plus other open tabs through BroadcastChannel) ----
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  if (typeof BroadcastChannel === 'undefined') {
    channel = null;
  } else {
    channel = new BroadcastChannel('rescueconnect-outbox');
    channel.onmessage = () => window.dispatchEvent(new Event(CHANGED)); // from another tab: do not echo back
  }
  return channel;
}

export function emitOutboxChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHANGED));
  getChannel()?.postMessage('changed');
}

export function onOutboxChanged(callback: () => void): () => void {
  getChannel(); // make sure messages from other tabs are being listened for
  window.addEventListener(CHANGED, callback);
  return () => window.removeEventListener(CHANGED, callback);
}

export function emitReportSent(notice: SentNotice) {
  window.dispatchEvent(new CustomEvent<SentNotice>(SENT, { detail: notice }));
}

export function onReportSent(callback: (notice: SentNotice) => void): () => void {
  const handler = (event: Event) => callback((event as CustomEvent<SentNotice>).detail);
  window.addEventListener(SENT, handler);
  return () => window.removeEventListener(SENT, handler);
}
