import type { MetadataRoute } from 'next';

// Lets RescueConnect be added to a phone's home screen and opened like an app (and offline, with the service worker).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'RescueConnect',
    short_name: 'RescueConnect',
    description: 'Flood Emergency Response Coordination System',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#0b2545',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
