/*
  RescueConnect service worker.

  Purpose: once the app has been opened with a connection, it can be opened again with NO connection, so a
  citizen can still fill in a report (it is then saved on the phone and sent later; see src/lib/outbox.ts).

  - Pages (/, /status, /status/<code>): network first, but if the network is slow or down, use the saved copy.
  - /_next/static files, map pin images, icons: saved copy first (their names change when the code changes).
  - Everything cross-origin (the API, map tiles, address search) is NOT touched: those always need a connection.
  - Nothing is cached for POST requests, so reports are never replayed by this worker.
*/
'use strict';

const VERSION = 'v1';
const PAGES = `rescueconnect-pages-${VERSION}`;
const ASSETS = `rescueconnect-assets-${VERSION}`;
const PRECACHE_PAGES = ['/', '/status'];
const PRECACHE_FILES = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/leaflet/marker-icon.png',
  '/leaflet/marker-icon-2x.png',
  '/leaflet/marker-shadow.png',
];
const MAX_ASSETS = 400;
const NAVIGATION_WAIT_MS = 3000; // on a slow connection, show the saved page after this long

// The app's script/style files are named in the page HTML (and in its inline data for lazily loaded parts,
// such as the map), so saving the page's files at install time lets the first offline visit work.
function assetUrlsIn(html) {
  const urls = new Set();
  for (const match of html.matchAll(/\/_next\/static\/[^"'\\\s<>)]+?\.(?:js|css|woff2?)/g)) urls.add(match[0]);
  for (const match of html.matchAll(/(?<![\/\w])static\/(?:chunks|css|media)\/[^"'\\\s<>)]+?\.(?:js|css|woff2?)/g)) {
    urls.add('/_next/' + match[0]);
  }
  return [...urls];
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES);
      const assets = await caches.open(ASSETS);
      for (const path of PRECACHE_PAGES) {
        try {
          const response = await fetch(path, { cache: 'reload' });
          if (!response.ok) continue;
          await pages.put(path, response.clone());
          const html = await response.text();
          await Promise.allSettled(assetUrlsIn(html).map((url) => assets.add(url)));
        } catch (error) {
          // No connection during install: the worker still installs and saves pages as they are visited.
        }
      }
      await Promise.allSettled(PRECACHE_FILES.map((url) => assets.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('rescueconnect-') && name !== PAGES && name !== ASSETS) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/leaflet/') ||
    pathname === '/manifest.webmanifest' ||
    /^\/(icon|apple-icon)/.test(pathname)
  );
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]); // oldest first
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trim(cache, MAX_ASSETS);
  }
  return response;
}

async function handleNavigation(request, url) {
  const cache = await caches.open(PAGES);
  const key = new Request(url.origin + url.pathname); // ignore ?query so one saved copy serves every visit
  const cached = await cache.match(key);

  const network = fetch(request)
    .then((response) => {
      const html = (response.headers.get('content-type') || '').includes('text/html');
      if (response.ok && !response.redirected && html) cache.put(key, response.clone());
      return response;
    })
    .catch(() => null);

  if (!cached) {
    // Nothing saved for this page: wait for the network, or explain that it cannot open offline.
    const response = await network;
    return response || (await caches.match('/offline.html')) || Response.error();
  }
  // A saved copy exists: prefer fresh, but never keep a person waiting on a weak connection.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAVIGATION_WAIT_MS));
  return (await Promise.race([network, timeout])) || cached;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url));
  } else if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request).catch(() => Response.error()));
  }
});
