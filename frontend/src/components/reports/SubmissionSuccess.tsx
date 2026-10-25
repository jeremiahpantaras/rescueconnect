'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { CopyCodeButton } from '@/components/status/CopyCodeButton';
import { normalizeTrackingCode } from '@/lib/trackingCode';
import { SAFETY_NOTE } from '@/lib/reportStatus';

interface SubmissionSuccessProps {
  trackingCode: string;
  onDone: () => void;
}

export function SubmissionSuccess({ trackingCode, onDone }: SubmissionSuccessProps) {
  // The status page address uses the plain 12 characters.
  const statusPath = `/status/${normalizeTrackingCode(trackingCode) ?? ''}`;

  return (
    <div className="fixed inset-0 z-[600] flex flex-col overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
        <div className="rounded-full bg-success/10 p-4 mb-6">
          <CheckCircle2 className="h-20 w-20 text-success" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Report Submitted</h1>
        <p className="text-muted-foreground mb-8 text-lg">
          RescueConnect has received your report. Save your tracking code to check on it.
        </p>

        <div className="bg-surface border border-border w-full rounded-xl p-6 mb-4 text-left shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Tracking code</p>
          <div className="flex items-center justify-between gap-3">
            <p className="whitespace-nowrap font-mono text-xl font-semibold tracking-wide text-foreground sm:text-2xl" data-testid="tracking-code">
              {trackingCode}
            </p>
            <CopyCodeButton code={trackingCode} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Keep this code private. Anyone who has it can see the status of your report, and you will need it to check
            from another phone or browser.
          </p>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-1">Status</p>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-500">
              Received
            </div>
          </div>
        </div>

        <p className="mb-6 text-xs text-muted-foreground">{SAFETY_NOTE}</p>

        <div className="w-full space-y-3">
          <LinkButton href={statusPath} size="lg" className="w-full">
            View report status
          </LinkButton>
          <Button onClick={onDone} variant="outline" className="w-full h-14 text-lg" size="lg">
            Return to Map
          </Button>
        </div>
      </div>
    </div>
  );
}
