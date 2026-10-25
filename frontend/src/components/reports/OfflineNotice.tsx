'use client';

import React from 'react';
import { Alert } from '@/components/ui/Alert';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

/** Reassures people filling in a report with no connection: it is allowed, and what will happen. */
export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <Alert variant="warning" title="You are offline" className="mb-6">
      <p>
        You can still complete this report. It will be saved on your phone and sent automatically when you have a
        signal. Responders will not have it until then.
      </p>
    </Alert>
  );
}
