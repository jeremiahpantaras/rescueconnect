'use client';

import React, { useState, useEffect } from 'react';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { MapDashboard } from '@/components/map/MapDashboard';
import { FloodReportForm } from '@/components/reports/FloodReportForm';
import { UrgentResponseForm } from '@/components/emergency/UrgentResponseForm';
import { SubmissionSuccess } from '@/components/reports/SubmissionSuccess';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SubmissionQueued } from '@/components/outbox/SubmissionQueued';
import type { SubmitOutcome, SubmittedReport } from '@/lib/api';
import { onReportSent, type OutboxItem } from '@/lib/outbox';

type ViewState = 'loading' | 'onboarding' | 'dashboard' | 'flood-form' | 'urgent-form' | 'success' | 'queued';

export default function RescueConnectApp() {
  const [view, setView] = useState<ViewState>('onboarding');
  const [reportLocation, setReportLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submittedReport, setSubmittedReport] = useState<SubmittedReport | null>(null);
  const [queuedItem, setQueuedItem] = useState<OutboxItem | null>(null);

  useEffect(() => {
    try {
      const isCompleted = localStorage.getItem('rescueconnect_onboarding_complete');
      if (isCompleted === 'true') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView('dashboard');
      }
    } catch (e) {
      console.warn("Storage access denied or failed", e);
    }
  }, []);

  const handleSubmitted = (outcome: SubmitOutcome) => {
    if (outcome.kind === 'sent') {
      setSubmittedReport(outcome.report);
      setView('success');
    } else {
      setQueuedItem(outcome.item);
      setView('queued');
    }
  };

  // A report saved offline can be delivered while the person is still on the "saved" screen:
  // switch to the normal "Report Submitted" screen with its tracking code.
  useEffect(() => {
    if (view !== 'queued' || !queuedItem) return;
    return onReportSent(({ item, report }) => {
      if (item.id !== queuedItem.id) return;
      setSubmittedReport(report);
      setQueuedItem(null);
      setView('success');
    });
  }, [view, queuedItem]);

  return (
    <ErrorBoundary>
        <div className="min-h-screen bg-background">
          {view === 'onboarding' && (
            <OnboardingFlow onComplete={() => setView('dashboard')} />
          )}

          {view === 'dashboard' && (
            <MapDashboard
              onReportFlood={(loc) => {
                setReportLocation(loc);
                setView('flood-form');
              }}
              onUrgentResponse={(loc) => {
                setReportLocation(loc);
                setView('urgent-form');
              }}
            />
          )}

          {view === 'flood-form' && reportLocation && (
            <FloodReportForm
              location={reportLocation}
              onBack={() => setView('dashboard')}
              onSuccess={handleSubmitted}
            />
          )}

          {view === 'urgent-form' && reportLocation && (
            <UrgentResponseForm
              location={reportLocation}
              onBack={() => setView('dashboard')}
              onSuccess={handleSubmitted}
            />
          )}

          {view === 'queued' && queuedItem && (
            <SubmissionQueued
              item={queuedItem}
              onDone={() => {
                setQueuedItem(null);
                setReportLocation(null);
                setView('dashboard');
              }}
            />
          )}

          {view === 'success' && submittedReport && (
            <SubmissionSuccess
              trackingCode={submittedReport.tracking_code}
              onDone={() => {
                setSubmittedReport(null);
                setReportLocation(null);
                setView('dashboard');
              }}
            />
          )}
      </div>
    </ErrorBoundary>
  );
}
