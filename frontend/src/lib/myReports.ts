// Remembers the tracking codes of reports submitted from this device, so a citizen can find them
// again without an account. Stored in localStorage only (never sent anywhere). The code is the
// credential for the status page, so people can remove entries (shared phones).
import type { ReportTypeKey } from './reportStatus';
import { formatTrackingCode, normalizeTrackingCode } from './trackingCode';

const KEY = 'rescueconnect_my_reports';
const MAX_REPORTS = 20;

export interface RememberedReport {
  code: string; // XXXX-XXXX-XXXX
  type: ReportTypeKey;
  submittedAt: string; // ISO timestamp
}

const TYPES: ReportTypeKey[] = ['flooded_area', 'urgent_response', 'unspecified'];

function isRemembered(value: unknown): value is RememberedReport {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.code === 'string' &&
    normalizeTrackingCode(item.code) !== null &&
    typeof item.type === 'string' &&
    TYPES.includes(item.type as ReportTypeKey) &&
    typeof item.submittedAt === 'string'
  );
}

export function listRememberedReports(): RememberedReport[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRemembered) : [];
  } catch {
    return []; // storage blocked or corrupted
  }
}

function save(reports: RememberedReport[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reports.slice(0, MAX_REPORTS)));
  } catch {
    // The status page still works from the code itself; only the shortcut list is lost.
  }
}

export function rememberReport(report: RememberedReport) {
  const code = normalizeTrackingCode(report.code);
  if (!code) return;
  const entry = { ...report, code: formatTrackingCode(code) };
  save([entry, ...listRememberedReports().filter((item) => item.code !== entry.code)]);
}

export function forgetReport(code: string) {
  save(listRememberedReports().filter((item) => item.code !== code));
}
