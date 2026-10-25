'use client';

import React, { useState } from 'react';
import { CloudOff } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/datetime';
import type { OutboxItem } from '@/lib/outbox';
import { sendNow } from '@/lib/outboxSync';
import { SAFETY_NOTE } from '@/lib/reportStatus';

const TYPE_LABELS: Record<OutboxItem['reportType'], string> = {
  'FLOODED AREA': 'Flooded area',
  'URGENT RESPONSE': 'Urgent response',
};

interface SubmissionQueuedProps {
  item: OutboxItem;
  onDone: () => void;
}

/** Shown when a report could not be sent yet. Be plain: it is saved here, but responders do not have it. */
export function SubmissionQueued({ item, onDone }: SubmissionQueuedProps) {
  const [trying, setTrying] = useState(false);

  const trySending = async () => {
    setTrying(true);
    try {
      await sendNow(item.id); // if it goes through, the page switches to the "Report Submitted" screen
    } finally {
      setTrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 rounded-full bg-amber-500/10 p-4">
          <CloudOff className="h-20 w-20 text-amber-500" aria-hidden="true" />
        </div>

        <div role="status" aria-live="polite">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Report saved on your phone</h1>
          <p className="mb-6 text-lg font-medium text-foreground">
            It has <span className="text-emergency">not been sent</span> to responders yet.
          </p>
        </div>

        <p className="mb-6 text-muted-foreground">
          There is no usable connection right now. Your report is stored safely on this phone and will be sent
          automatically as soon as you have a signal. Keep RescueConnect open, or open it again when you are back in
          range.
        </p>

        <div className="mb-6 w-full rounded-xl border border-border bg-surface p-5 text-left shadow-sm">
          <p className="text-sm text-muted-foreground">Saved report</p>
          <p className="font-semibold text-foreground">{TYPE_LABELS[item.reportType]}</p>
          <p className="text-sm text-muted-foreground">Saved {formatDateTime(item.createdAt)}</p>
          {item.photos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {item.photos.length} {item.photos.length === 1 ? 'photo' : 'photos'} attached
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            You will get your tracking code as soon as the report is received.
          </p>
        </div>

        <Alert variant="warning" title="In immediate danger?" className="mb-6 text-left">
          <p>{SAFETY_NOTE}</p>
        </Alert>

        <div className="w-full space-y-3">
          <Button onClick={trySending} isLoading={trying} size="lg" className="w-full">
            Try sending now
          </Button>
          <Button onClick={onDone} variant="outline" size="lg" className="w-full">
            Return to Map
          </Button>
        </div>
      </div>
    </div>
  );
}
