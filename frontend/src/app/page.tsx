'use client';

import React, { useState, useEffect } from 'react';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { MapDashboard } from '@/components/map/MapDashboard';
import { FloodReportForm } from '@/components/reports/FloodReportForm';
import { UrgentResponseForm } from '@/components/emergency/UrgentResponseForm';
import { SubmissionSuccess } from '@/components/reports/SubmissionSuccess';
import { ErrorBoundary } from '@/components/ErrorBoundary';

type ViewState = 'loading' | 'onboarding' | 'dashboard' | 'flood-form' | 'urgent-form' | 'success';

export default function RescueConnectApp() {
  const [view, setView] = useState<ViewState>('onboarding');
  const [reportLocation, setReportLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

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
              onSuccess={(ref) => {
                setReferenceNumber(ref);
                setView('success');
              }}
            />
          )}

          {view === 'urgent-form' && reportLocation && (
            <UrgentResponseForm
              location={reportLocation}
              onBack={() => setView('dashboard')}
              onSuccess={(ref) => {
                setReferenceNumber(ref);
                setView('success');
              }}
            />
          )}

          {view === 'success' && referenceNumber && (
            <SubmissionSuccess
              referenceNumber={referenceNumber}
              onDone={() => {
                setReferenceNumber(null);
                setReportLocation(null);
                setView('dashboard');
              }}
            />
          )}
      </div>
    </ErrorBoundary>
  );
}
