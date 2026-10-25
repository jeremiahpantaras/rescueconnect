'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { formatDateTime } from '@/lib/datetime';
import {
  isInFlight,
  listOutboxItems,
  onOutboxChanged,
  onReportSent,
  type OutboxItem,
  type SentNotice,
} from '@/lib/outbox';
import { discardReport, flushOutbox, sendNow } from '@/lib/outboxSync';
import { nextFlushDelayMs } from '@/lib/retry';
import { normalizeTrackingCode } from '@/lib/trackingCode';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

const TYPE_LABELS: Record<OutboxItem['reportType'], string> = {
  'FLOODED AREA': 'Flooded area report',
  'URGENT RESPONSE': 'Urgent response request',
};

const SENT_NOTICE_MS = 30_000;

function useOutboxItems(): OutboxItem[] {
  const [items, setItems] = useState<OutboxItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await listOutboxItems();
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]); // device storage unavailable: nothing is waiting
      }
    };
    void refresh();
    const stop = onOutboxChanged(() => void refresh());
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
  return items;
}

/**
 * Mounted once for the whole app. Sends reports saved on the phone whenever the app is open, and keeps the
 * person informed: what is waiting (and that responders do NOT have it yet), and when it has been delivered.
 */
export function OutboxBanner() {
  const items = useOutboxItems();
  const online = useOnlineStatus();
  const [sent, setSent] = useState<SentNotice[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Send leftovers from an earlier visit now, and again whenever the connection returns or the tab is shown.
  useEffect(() => {
    void flushOutbox({ force: true });
    const wake = () => {
      if (!document.hidden) void flushOutbox({ force: true });
    };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  // Automatic retries on the backoff schedule.
  useEffect(() => {
    const delay = nextFlushDelayMs(items);
    if (delay === null) return;
    const timer = setTimeout(() => void flushOutbox(), Math.min(delay, 30_000));
    return () => clearTimeout(timer);
  }, [items]);

  useEffect(
    () =>
      onReportSent((notice) => {
        setSent((previous) => [...previous.filter((n) => n.item.id !== notice.item.id), notice]);
        setTimeout(() => setSent((previous) => previous.filter((n) => n.item.id !== notice.item.id)), SENT_NOTICE_MS);
      }),
    []
  );

  if (items.length === 0 && sent.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[550] p-3 print:hidden">
      <div className="mx-auto max-w-xl space-y-2">
        {sent.map((notice) => (
          <div
            key={notice.item.id}
            role="status"
            className="pointer-events-auto rounded-xl border border-success/40 bg-surface p-4 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Your saved report was sent</p>
                <p className="text-sm text-muted-foreground">
                  Responders have it now. Tracking code{' '}
                  <span className="whitespace-nowrap font-mono font-semibold text-foreground">
                    {notice.report.tracking_code}
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <LinkButton href={`/status/${normalizeTrackingCode(notice.report.tracking_code) ?? ''}`} size="sm">
                    View status
                  </LinkButton>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSent((previous) => previous.filter((n) => n.item.id !== notice.item.id))}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {items.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto rounded-xl border border-amber-500/50 bg-surface p-4 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {items.length === 1 ? '1 report is' : `${items.length} reports are`} waiting to be sent
                </p>
                <p className="text-sm text-muted-foreground">
                  Responders do <strong>not</strong> have {items.length === 1 ? 'it' : 'them'} yet. We send
                  automatically when you have a signal. Keep RescueConnect open, or open it again when you are back in
                  range. In immediate danger, call 911 or your local emergency hotline.
                </p>

                <ul className="mt-3 space-y-3">
                  {items.map((item) => {
                    const sending = isInFlight(item.id);
                    return (
                      <li key={item.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                        <p className="font-medium text-foreground">
                          {TYPE_LABELS[item.reportType]}
                          {item.photos.length > 0 && ` · ${item.photos.length} ${item.photos.length === 1 ? 'photo' : 'photos'}`}
                        </p>
                        <p className="text-muted-foreground">Saved {formatDateTime(item.createdAt)}</p>
                        <p className={item.blockedReason ? 'text-emergency' : 'text-muted-foreground'}>
                          {sending ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Sending…
                            </span>
                          ) : item.blockedReason ? (
                            `Could not be sent: ${item.blockedReason}`
                          ) : !online ? (
                            'Waiting for a connection'
                          ) : (
                            'Will try again shortly'
                          )}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={sending}
                            onClick={() => void sendNow(item.id)}
                          >
                            Send now
                          </Button>
                          {confirming === item.id ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setConfirming(null);
                                  void discardReport(item.id);
                                }}
                              >
                                Yes, discard it
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                                Keep it
                              </Button>
                            </>
                          ) : (
                            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(item.id)}>
                              Discard
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
