'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronLeft, Printer } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Emblem } from '@/components/ui/Emblem';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { LinkButton } from '@/components/ui/LinkButton';
import { CopyCodeButton } from '@/components/status/CopyCodeButton';
import { StatusStepper } from '@/components/status/StatusStepper';
import { NotFoundError, fetchReportStatus, type ReportStatusInfo } from '@/lib/api';
import { formatDateTime } from '@/lib/datetime';
import { RESOLVED_NOTICE, SAFETY_NOTE, STATUS_STEPS, formatDuration } from '@/lib/reportStatus';
import { normalizeTrackingCode } from '@/lib/trackingCode';

// Rarely changes, but staff can reopen a report; if they do, this page hands back to the status page.
const POLL_MS = 10_000;
const POLL_MAX_BACKOFF_MS = 30_000;

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ReportStatusInfo }
  | { kind: 'not-found'; message: string }
  | { kind: 'error'; message: string };

const NOT_A_CODE = 'That does not look like a tracking code. Codes have 12 letters and numbers, like 4F7K-9QXM-2TBD.';

export function ReportResolvedView({ code }: { code: string }) {
  const router = useRouter();
  const normalized = normalizeTrackingCode(code);
  const [state, setState] = useState<ViewState>(
    normalized ? { kind: 'loading' } : { kind: 'not-found', message: NOT_A_CODE }
  );

  useEffect(() => {
    if (!normalized) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failures = 0;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), ms);
    };

    const load = async () => {
      clearTimeout(timer);
      if (document.hidden) {
        schedule(POLL_MS);
        return;
      }
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await fetchReportStatus(normalized, controller.signal);
        if (cancelled) return;
        failures = 0;
        if (data.status !== 'resolved') {
          // Not (or no longer) resolved: this notice would be wrong, so go back to the live status page.
          router.replace(`/status/${normalized}`);
          return;
        }
        setState({ kind: 'ready', data });
        schedule(POLL_MS);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        if (error instanceof NotFoundError) {
          setState({ kind: 'not-found', message: error.message });
          return;
        }
        const message = error instanceof Error ? error.message : 'Something went wrong.';
        // The notice stays on screen if the connection drops; only a first load can fail visibly.
        setState((previous) => (previous.kind === 'ready' ? previous : { kind: 'error', message }));
        failures += 1;
        schedule(Math.min(POLL_MS * 2 ** failures, POLL_MAX_BACKOFF_MS));
      }
    };

    const wake = () => {
      if (!document.hidden) void load();
    };

    void load();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [normalized, router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <Header
          title="Report Resolved"
          leftAction={
            <LinkButton href="/" variant="ghost" size="sm" aria-label="Back to the map">
              <ChevronLeft className="h-6 w-6" />
            </LinkButton>
          }
        />
      </div>

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

        {state.kind === 'ready' && <Notice data={state.data} />}
      </main>
    </div>
  );
}

function Notice({ data }: { data: ReportStatusInfo }) {
  const resolvedAt = data.resolved_at ?? data.updated_at;
  const resolvedStep = STATUS_STEPS[STATUS_STEPS.length - 1];

  return (
    <article aria-labelledby="resolved-title" className="space-y-6">
      <Card className="overflow-hidden border-t-4 border-t-success">
        <CardContent className="space-y-4 p-6 pt-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <Emblem size={52} />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              RescueConnect &middot; {RESOLVED_NOTICE.label}
            </p>
          </div>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
          </div>
          <div role="status" aria-live="polite" className="space-y-2">
            <h1 id="resolved-title" className="text-3xl font-bold tracking-tight text-foreground">
              {RESOLVED_NOTICE.title}
            </h1>
            <p className="text-lg font-medium text-foreground">{RESOLVED_NOTICE.lead}</p>
          </div>
          <p className="text-left text-muted-foreground sm:text-center">{RESOLVED_NOTICE.body}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 p-6 pt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Resolution summary
          </h2>
          <dl className="divide-y divide-border text-sm">
            <Row label="Tracking code">
              <span className="flex items-center justify-end gap-2">
                <span className="whitespace-nowrap font-mono font-semibold tracking-wide">{data.tracking_code}</span>
                <span className="print:hidden">
                  <CopyCodeButton code={data.tracking_code} />
                </span>
              </span>
            </Row>
            <Row label="Report type">{data.report_type_label}</Row>
            <Row label="Status">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${resolvedStep.badge}`}>
                {resolvedStep.label}
              </span>
            </Row>
            <Row label="Submitted">{formatDateTime(data.submitted_at)}</Row>
            <Row label="Resolved">{formatDateTime(resolvedAt)}</Row>
            <Row label="Time to resolution">{formatDuration(data.submitted_at, resolvedAt)}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Progress</h2>
          <StatusStepper current={STATUS_STEPS.length} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">What happens next</h2>
          <ul className="list-disc space-y-2 pl-5 text-foreground">
            {RESOLVED_NOTICE.nextSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-3 print:hidden">
        <LinkButton href="/" size="lg" className="w-full">
          Return to map
        </LinkButton>
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => window.print()}>
          <Printer className="mr-2 h-5 w-5" aria-hidden="true" />
          Print this notice
        </Button>
      </div>

      <footer className="space-y-2 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        <p>{RESOLVED_NOTICE.footer}</p>
        <p className="print:hidden">{SAFETY_NOTE}</p>
      </footer>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}
