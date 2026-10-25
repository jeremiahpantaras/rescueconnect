// What each report status means to the citizen. The status values come from the backend
// (EmergencyReport.STATUS_CHOICES); the wording here must not promise arrival times or outcomes.

export const STATUS_STEPS = [
  {
    key: 'pending',
    label: 'Received',
    description: 'Your report has been received and is waiting to be reviewed by RescueConnect staff.',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  {
    key: 'acknowledged',
    label: 'Acknowledged',
    description: 'Staff have seen your report and are coordinating a response.',
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  },
  {
    key: 'responding',
    label: 'Responding',
    description: 'Responders are responding to your report.',
    dot: 'bg-purple-500',
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  },
  {
    key: 'resolved',
    label: 'Resolved',
    description: 'This report has been marked resolved. If you still need help, please submit a new report.',
    dot: 'bg-success',
    badge: 'bg-success/15 text-success',
  },
] as const;

export function stepIndex(status: string): number {
  return STATUS_STEPS.findIndex((step) => step.key === status);
}

export const SAFETY_NOTE =
  'If you are in immediate danger, call 911 or your local emergency hotline. ' +
  'RescueConnect reports are reviewed by staff and may not be seen right away.';

export type ReportTypeKey = 'flooded_area' | 'urgent_response' | 'unspecified';

export const REPORT_TYPE_LABELS: Record<ReportTypeKey, string> = {
  flooded_area: 'Flooded area',
  urgent_response: 'Urgent response',
  unspecified: 'Report',
};

// Wording for the "Report Resolved" notice. It states only what "resolved" means in RescueConnect: response
// personnel marked the report resolved. It must not claim an outcome (rescue, damage, cause) we do not record.
export const RESOLVED_NOTICE = {
  label: 'Resolution Notice',
  title: 'Report Resolved',
  lead: 'The response to your report has been completed.',
  body:
    'Your report has been reviewed by response personnel and has been marked as resolved. ' +
    'RescueConnect thanks you for reporting promptly and for helping keep your community safe.',
  nextSteps: [
    'No further action is required from you.',
    'Please keep your tracking code for your records. This notice remains available at this address.',
    'If conditions change or you need further assistance, submit a new report or contact your local emergency hotline.',
  ],
  footer:
    'This notice reflects the status recorded by response personnel in RescueConnect, ' +
    'the Flood Emergency Response Coordination System.',
} as const;

/** "2 hr 15 min", "3 days 4 hr", "Less than a minute". */
export function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return 'Less than a minute';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'}${hours ? ` ${hours} hr` : ''}`;
  if (hours > 0) return `${hours} hr${minutes ? ` ${minutes} min` : ''}`;
  return `${minutes} min`;
}
