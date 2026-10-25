// RescueConnect API client. Only talks to endpoints that exist in backend/reports/urls.py.
import { rememberReport } from './myReports';
import {
  emitOutboxChanged,
  putOutboxItem,
  removeOutboxItem,
  setInFlight,
  type OutboxItem,
} from './outbox';
import type { ReportTypeKey } from './reportStatus';
import { attemptTimeoutMs, backoffMs } from './retry';

const DEV_API_URL = 'http://127.0.0.1:8000/api';

function resolveApiUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, '');
  // Only fall back to the local backend during development; a production build must be configured.
  return process.env.NODE_ENV === 'production' ? null : DEV_API_URL;
}

export type ReportType = 'FLOODED AREA' | 'URGENT RESPONSE';

export interface SubmitReportInput {
  reportType: ReportType;
  location: { lat: number; lng: number };
  message: string;
  photos: File[];
}

export interface SubmittedReport {
  id: number;
  /** Secret code for the public status page, formatted XXXX-XXXX-XXXX. */
  tracking_code: string;
}

export interface ReportStatusInfo {
  tracking_code: string;
  report_type: ReportTypeKey;
  report_type_label: string;
  status: string;
  status_label: string;
  submitted_at: string;
  updated_at: string;
  /** When staff marked the report resolved; null while it is open. */
  resolved_at: string | null;
}

export class ApiError extends Error {
  readonly status?: number;
  /** True when trying again later can work (no signal, slow connection, server busy or down). */
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

/** The server has no report for that tracking code. */
export class NotFoundError extends ApiError {}

function newId(): string {
  // crypto.randomUUID needs a secure context; getRandomValues also works on plain http (phone testing on a LAN).
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getDeviceId(): string {
  try {
    const existing = localStorage.getItem('device_id');
    if (existing) return existing;
    const created = `device-${newId()}`;
    localStorage.setItem('device_id', created);
    return created;
  } catch {
    // Storage can be blocked (private mode); the backend only needs some identifier.
    return `device-${Date.now()}`;
  }
}

// Turn a failed response into a readable message. Handles the shapes the backend returns:
// {error: "..."}, DRF field errors {field: ["..."]}, throttling {detail: "..."}, and non-JSON bodies.
async function readErrorMessage(response: Response): Promise<string> {
  if (response.status === 429) {
    return 'Too many requests from your network. Please wait a while and try again.';
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON (for example an HTML 500 page).
  }

  if (body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    if (typeof data.error === 'string') return data.error;
    if (typeof data.detail === 'string') return data.detail;
    const fieldMessages = Object.entries(data)
      .map(([field, value]) => {
        const text = Array.isArray(value) ? value.join(' ') : String(value);
        return `${field}: ${text}`;
      })
      .filter(Boolean);
    if (fieldMessages.length > 0) return fieldMessages.join(' ');
  }

  return response.status >= 500
    ? 'RescueConnect had a problem receiving your report. Please try again shortly.'
    : 'Your report could not be submitted. Please check the details and try again.';
}

const TYPE_KEYS: Record<ReportType, ReportTypeKey> = {
  'FLOODED AREA': 'flooded_area',
  'URGENT RESPONSE': 'urgent_response',
};

export type ReportDraft = Pick<OutboxItem, 'id' | 'createdAt' | 'reportType' | 'location' | 'message' | 'photos'>;

/**
 * One attempt to send a report. The draft's id is sent as `client_ref`, so if an earlier attempt actually reached
 * the server (but its reply was lost), the server answers with the original report instead of creating a second.
 */
export async function postReport(draft: ReportDraft, timeoutMs: number): Promise<SubmittedReport> {
  const apiUrl = resolveApiUrl();
  if (!apiUrl) {
    throw new ApiError('RescueConnect is not configured to reach its server. Please contact the administrator.');
  }

  // The backend has no report_type field yet, so the type is carried as a message prefix.
  const formData = new FormData();
  formData.append('latitude', draft.location.lat.toString());
  formData.append('longitude', draft.location.lng.toString());
  formData.append('message', `[${draft.reportType}] ${draft.message}`.trim());
  formData.append('device_id', getDeviceId());
  formData.append('client_ref', draft.id);
  formData.append('reported_at', draft.createdAt);
  draft.photos.slice(0, 2).forEach((photo, index) => formData.append(`photo${index + 1}`, photo));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/reports/send/`, { method: 'POST', body: formData, signal: controller.signal });
    } catch {
      throw new ApiError(
        controller.signal.aborted
          ? 'The connection is too slow to send the report right now.'
          : 'Could not reach RescueConnect. Please check your connection.',
        { retryable: true }
      );
    }

    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429 || response.status === 408;
      throw new ApiError(await readErrorMessage(response), { status: response.status, retryable });
    }
    return (await response.json()) as SubmittedReport;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The connection is too slow to send the report right now.', { retryable: true });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type SubmitOutcome =
  | { kind: 'sent'; report: SubmittedReport }
  /** No usable connection: the report is saved on this phone and will be sent automatically. */
  | { kind: 'queued'; item: OutboxItem };

/**
 * Submit a report so it cannot be lost. It is saved on this device first, then sent. If there is no signal (or the
 * connection is too slow, or the server is unreachable) it stays saved and the outbox sends it later. Only a
 * refusal that retrying cannot fix (for example invalid details) is thrown, for the form to show.
 */
export async function submitReport(input: SubmitReportInput): Promise<SubmitOutcome> {
  const item: OutboxItem = {
    id: newId(),
    createdAt: new Date().toISOString(),
    reportType: input.reportType,
    location: input.location,
    message: input.message,
    photos: input.photos.slice(0, 2),
    attempts: 0,
    // Keeps the background sender away while this first attempt is running.
    nextAttemptAt: Date.now() + attemptTimeoutMs(0) + 10_000,
    lastError: null,
    blockedReason: null,
  };

  let saved = true;
  try {
    await putOutboxItem(item);
  } catch {
    saved = false; // storage unavailable (e.g. some private modes): send directly, as before
  }

  const saveForLater = async (error: ApiError): Promise<SubmitOutcome> => {
    const waiting: OutboxItem = { ...item, attempts: 1, nextAttemptAt: Date.now() + backoffMs(1), lastError: error.message };
    await putOutboxItem(waiting);
    emitOutboxChanged();
    // Ask the browser not to clear this storage under pressure; the saved report may be the only copy.
    navigator.storage?.persist?.().catch(() => undefined);
    return { kind: 'queued', item: waiting };
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (!saved) {
      throw new ApiError('You are offline, and this browser cannot save the report on your phone. Please try again when you have a signal.', { retryable: true });
    }
    return saveForLater(new ApiError('No internet connection.', { retryable: true }));
  }

  setInFlight(item.id, true);
  try {
    const report = await postReport(item, attemptTimeoutMs(0));
    if (saved) await removeOutboxItem(item.id).catch(() => undefined);
    rememberReport({ code: report.tracking_code, type: TYPE_KEYS[input.reportType], submittedAt: item.createdAt });
    return { kind: 'sent', report };
  } catch (error) {
    if (error instanceof ApiError && error.retryable && saved) {
      return saveForLater(error);
    }
    if (saved) await removeOutboxItem(item.id).catch(() => undefined);
    throw error;
  } finally {
    setInFlight(item.id, false);
  }
}

/** Remember the code of a report that has just been delivered (from the outbox) on this device. */
export function rememberSent(item: OutboxItem, report: SubmittedReport) {
  rememberReport({ code: report.tracking_code, type: TYPE_KEYS[item.reportType], submittedAt: item.createdAt });
}

/** Current status of a report, for the public status page. `code` is the citizen's tracking code. */
export async function fetchReportStatus(code: string, signal?: AbortSignal): Promise<ReportStatusInfo> {
  const apiUrl = resolveApiUrl();
  if (!apiUrl) {
    throw new ApiError('RescueConnect is not configured to reach its server. Please contact the administrator.');
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/reports/status/${encodeURIComponent(code)}/`, { cache: 'no-store', signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Could not reach RescueConnect. Please check your connection.', { retryable: true });
  }

  if (response.status === 404) {
    throw new NotFoundError(await readErrorMessage(response), { status: 404 });
  }
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), { status: response.status });
  }
  return (await response.json()) as ReportStatusInfo;
}
