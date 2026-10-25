'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Alert } from '@/components/ui/Alert';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { LinkButton } from '@/components/ui/LinkButton';
import { CopyCodeButton } from '@/components/status/CopyCodeButton';
import { StatusStepper } from '@/components/status/StatusStepper';
import { NotFoundError, fetchReportStatus, type ReportStatusInfo } from '@/lib/api';
import { formatDate, formatDateTime, formatTime } from '@/lib/datetime';
import { rememberReport } from '@/lib/myReports';
import { SAFETY_NOTE, STATUS_STEPS, stepIndex } from '@/lib/reportStatus';
import { normalizeTrackingCode } from '@/lib/trackingCode';

// Live updates by fast polling (no WebSockets): a staff change shows up within a few seconds.
// The request is tiny (one indexed lookup) and is skipped while the tab is hidden.
const POLL_MS = 3_000;
const POLL_MAX_BACKOFF_MS = 30_000;
const HIGHLIGHT_MS = 4_000;

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ReportStatusInfo; checkedAt: number; offline: boolean }
  | { kind: 'not-found'; message: string }
  | { kind: 'error'; message: string };

const NOT_A_CODE = 'That does not look like a tracking code. Codes have 12 letters and numbers, like 4F7K-9QXM-2TBD.';

function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDate(iso);
}

export function ReportStatusView({ code }: { code: string }) {
  const router = useRouter();
  const normalized = normalizeTrackingCode(code);
  const [state, setState] = useState<ViewState>(
    normalized ? { kind: 'loading' } : { kind: 'not-found', message: NOT_A_CODE }
  );
  const [now, setNow] = useState(() => Date.now());
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    if (!normalized) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let highlightTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let remembered = false;
    let failures = 0;
    let lastStatus: string | null = null;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), ms);
    };

    const load = async () => {
      clearTimeout(timer);
      if (document.hidden) {
        schedule(POLL_MS); // no requests for a tab nobody is looking at; `wake` refreshes on return
        return;
      }
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await fetchReportStatus(normalized, controller.signal);
        if (cancelled) return;
        failures = 0;
        if (data.status === 'resolved') {
          // Hand over to the formal "Report Resolved" notice. `replace` keeps the Back button from
          // returning to a page that would immediately redirect again.
          router.replace(`/status/${normalized}/resolved`);
          return;
        }
        if (!remembered) {
          remembered = true;
          rememberReport({ code: data.tracking_code, type: data.report_type, submittedAt: data.submitted_at });
        }
        if (lastStatus !== null && lastStatus !== data.status) {
          setJustChanged(true);
          clearTimeout(highlightTimer);
          highlightTimer = setTimeout(() => setJustChanged(false), HIGHLIGHT_MS);
        }
        lastStatus = data.status;
        setState({ kind: 'ready', data, checkedAt: Date.now(), offline: false });
        setNow(Date.now());
        schedule(POLL_MS);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        if (error instanceof NotFoundError) {
          setState({ kind: 'not-found', message: error.message });
          return; // nothing to keep checking
        }
        const message = error instanceof Error ? error.message : 'Something went wrong.';
        // Keep showing the last known status if we have one; keep retrying (slower each time) either way.
        setState((previous) => (previous.kind === 'ready' ? { ...previous, offline: true } : { kind: 'error', message }));
        failures += 1;
        schedule(Math.min(POLL_MS * 2 ** failures, POLL_MAX_BACKOFF_MS));
      }
    };

    // Refresh the moment the person comes back to the tab or the connection returns.
    const wake = () => {
      if (!document.hidden) void load();
    };

    void load();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(highlightTimer);
      controller?.abort();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [normalized, router]);

  // Keep "updated 3 min ago" fresh between checks.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Report status"
        leftAction={
          <LinkButton href="/" variant="ghost" size="sm" aria-label="Back to the map">
            <ChevronLeft className="h-6 w-6" />
          </LinkButton>
        }
      />

      <main className="mx-auto w-full max-w-xl space-y-6 p-4 pb-24 sm:p-6">
        {state.kind === 'loading' && <LoadingState message="Checking your report..." />}

        {state.kind === 'not-found' && (
          <EmptyState
            title="We couldn't find that report"
            description={state.message}
            actionLabel="Check another code"
            onAction={() => router.push('/status')}
          />
        )}

        {state.kind === 'error' && (
          <ErrorState
            title="We couldn't check your report"
            message={`${state.message} We will keep trying automatically.`}
          />
        )}

        {state.kind === 'ready' && <ReadyView state={state} now={now} justChanged={justChanged} />}
      </main>
    </div>
  );
}

function ReadyView({
  state,
  now,
  justChanged,
}: {
  state: Extract<ViewState, { kind: 'ready' }>;
  now: number;
  justChanged: boolean;
}) {
  const { data } = state;
  const index = stepIndex(data.status);
  const step = index >= 0 ? STATUS_STEPS[index] : null;

  return (
    <>
      {state.offline && (
        <Alert variant="warning" title="Can't reach RescueConnect right now">
          <p>Showing the last status we received. We will keep trying and update this page when we reconnect.</p>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-3 p-6 pt-6">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Tracking code</p>
            <div className="flex items-center justify-between gap-3">
              <p className="whitespace-nowrap font-mono text-xl font-semibold tracking-wide text-foreground sm:text-2xl">
                {data.tracking_code}
              </p>
              <CopyCodeButton code={data.tracking_code} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.report_type_label} &middot; Submitted {formatDateTime(data.submitted_at)}
          </p>
        </CardContent>
      </Card>

      <Card className={`transition-shadow duration-500 ${justChanged ? 'ring-2 ring-primary' : ''}`}>
        <CardContent className="space-y-5 p-6 pt-6">
          <div role="status" aria-live="polite" className="space-y-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                step ? step.badge : 'bg-muted text-foreground'
              }`}
            >
              {step ? step.label : data.status_label}
            </span>
            {justChanged && <p className="text-sm font-medium text-primary">Status just updated</p>}
            <p className="text-foreground">
              {step ? step.description : 'Your report is being handled by RescueConnect staff.'}
            </p>
            <p className="text-sm text-muted-foreground">Last updated {timeAgo(data.updated_at, now)}</p>
          </div>
          {step && <StatusStepper current={index} />}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="live-indicator">
        <span
          aria-hidden="true"
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            state.offline ? 'bg-amber-500' : 'bg-success motion-safe:animate-pulse'
          }`}
        />
        <span>
          {state.offline ? 'Reconnecting…' : 'Live'} &middot; updates automatically &middot; last checked{' '}
          {formatTime(state.checkedAt, { seconds: true })}
        </span>
      </p>

      <Alert variant="warning" title="In immediate danger?">
        <p>{SAFETY_NOTE}</p>
      </Alert>
    </>
  );
}
