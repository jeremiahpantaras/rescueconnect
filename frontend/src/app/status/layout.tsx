import type { Metadata } from 'next';

// Status pages are private to the person who holds the tracking code: keep them out of search
// engines and do not send the address (which contains the code) as a Referer to other sites.
export const metadata: Metadata = {
  title: 'Report status | RescueConnect',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
