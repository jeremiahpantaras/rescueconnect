'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js so the report form can open with no connection once the app has been loaded online.
 * Production only: during development the worker would cache stale code and fight hot reloading.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Unsupported or blocked (private mode, insecure origin): the app still works online.
      });
    };
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
