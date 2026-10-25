// RescueConnect shows every date and time on the 12-hour clock with AM/PM, never 24-hour, whatever the
// device's language or region would normally use. Format anything shown to a person through these helpers;
// ESLint forbids toLocale*String and Intl.DateTimeFormat anywhere else.

type DateInput = string | number | Date;

const NONE = '—';

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "October 25, 2026 at 10:15 PM" */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return NONE;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** "Oct 25, 2026" */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return NONE;
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/** "10:15 PM", or "10:15:33 PM" with `seconds`. */
export function formatTime(value: DateInput, options: { seconds?: boolean } = {}): string {
  const date = toDate(value);
  if (!date) return NONE;
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(options.seconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).format(date);
}
