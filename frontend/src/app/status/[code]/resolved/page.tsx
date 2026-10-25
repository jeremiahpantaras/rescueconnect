'use client';

import { use } from 'react';
import { ReportResolvedView } from '@/components/status/ReportResolvedView';

// In this Next.js version `params` is a Promise; Client Components unwrap it with `use`.
export default function ReportResolvedPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  let decoded = code;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    // keep the raw value; it will simply fail to look like a code
  }
  return <ReportResolvedView code={decoded} />;
}
