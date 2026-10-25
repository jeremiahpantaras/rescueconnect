'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ClipboardList } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { LinkButton } from '@/components/ui/LinkButton';
import { formatDate } from '@/lib/datetime';
import { forgetReport, listRememberedReports, type RememberedReport } from '@/lib/myReports';
import { REPORT_TYPE_LABELS, SAFETY_NOTE } from '@/lib/reportStatus';
import { normalizeTrackingCode } from '@/lib/trackingCode';

export default function CheckReportPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<RememberedReport[]>([]);

  useEffect(() => {
    // localStorage is only available in the browser, so it is read after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReports(listRememberedReports());
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const code = normalizeTrackingCode(input);
    if (!code) {
      setError('Enter the 12-character tracking code you received, like 4F7K-9QXM-2TBD.');
      return;
    }
    setError(null);
    router.push(`/status/${code}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="My reports"
        leftAction={
          <LinkButton href="/" variant="ghost" size="sm" aria-label="Back to the map">
            <ChevronLeft className="h-6 w-6" />
          </LinkButton>
        }
      />

      <main className="mx-auto w-full max-w-xl space-y-8 p-4 pb-24 sm:p-6">
        <section aria-labelledby="check-heading">
          <h2 id="check-heading" className="mb-1 text-lg font-semibold">Check a report</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Enter the tracking code you were given when you submitted your report.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <Input
              label="Tracking code"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              error={error ?? undefined}
              className="font-mono uppercase tracking-wider"
            />
            <Button type="submit" className="w-full" size="lg">
              Check status
            </Button>
          </form>
        </section>

        <section aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="mb-3 text-lg font-semibold">Reports from this device</h2>
          {reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-muted-foreground">
              <ClipboardList className="mx-auto mb-2 h-6 w-6" />
              Reports you submit from this device will appear here.
            </div>
          ) : (
            <ul className="space-y-3">
              {reports.map((report) => (
                <li key={report.code}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 p-4 pt-4">
                      <Link href={`/status/${normalizeTrackingCode(report.code)}`} className="min-w-0 flex-1">
                        <p className="font-mono text-lg font-semibold tracking-wider text-foreground">{report.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {REPORT_TYPE_LABELS[report.type]} &middot; {formatDate(report.submittedAt)}
                        </p>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${report.code} from this device`}
                        onClick={() => {
                          forgetReport(report.code);
                          setReports(listRememberedReports());
                        }}
                      >
                        Remove
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Codes are saved only on this device. Remove them if you share this phone.
          </p>
        </section>

        <p className="text-xs text-muted-foreground">{SAFETY_NOTE}</p>
      </main>
    </div>
  );
}
