/*
  Removes the retired TabangNegros service worker from browsers that still have it.

  Older builds of the Vite app registered a worker here that answered EVERY page on this site with a saved copy
  of the old app, including /admin/. Browsers check this file for updates on their own, so serving this version
  makes an affected browser delete the old saved files, remove the worker, and reload to the real page, with
  nothing for the person to do.

  This file does not intercept any requests. Keep it at this address for as long as old browsers may return.
  (The RescueConnect citizen app has its own, separate worker: frontend/public/sw.js on the frontend's origin.)
*/
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.registration.unregister();
      const pages = await self.clients.matchAll({ type: 'window' });
      await Promise.all(pages.map((page) => page.navigate(page.url).catch(() => undefined)));
    })()
  );
});
