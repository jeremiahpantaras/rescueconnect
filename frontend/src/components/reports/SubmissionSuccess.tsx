'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SubmissionSuccessProps {
  referenceNumber: string;
  onDone: () => void;
}

export function SubmissionSuccess({ referenceNumber, onDone }: SubmissionSuccessProps) {
  return (
    <div className="fixed inset-0 z-[600] flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
        <div className="rounded-full bg-success/10 p-4 mb-6">
          <CheckCircle2 className="h-20 w-20 text-success" />
        </div>
        
        <h1 className="text-3xl font-bold tracking-tight mb-2">Report Submitted</h1>
        <p className="text-muted-foreground mb-8 text-lg">
          Emergency responders have been notified. Please stay safe.
        </p>

        <div className="bg-surface border border-border w-full rounded-xl p-6 mb-8 text-left shadow-sm">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-1">Reference Number</p>
            <p className="font-mono text-xl font-semibold text-foreground">#{referenceNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Status</p>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
              Pending Response
            </div>
          </div>
        </div>

        <Button onClick={onDone} className="w-full h-14 text-lg" size="lg">
          Return to Map
        </Button>
      </div>
    </div>
  );
}
