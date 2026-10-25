'use client';

import { use } from 'react';
import { ReportStatusView } from '@/components/status/ReportStatusView';

// In this Next.js version `params` is a Promise; Client Components unwrap it with `use`.
export default function ReportStatusPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  let decoded = code;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    // keep the raw value; it will simply fail to look like a code
  }
  return <ReportStatusView code={decoded} />;
}
