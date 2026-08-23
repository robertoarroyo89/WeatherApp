'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker after the page has settled.
 *
 * Deferred to the load event so it never competes with the first paint of the
 * sky, and skipped entirely in development, where a stale worker caching the dev
 * bundle causes far more confusion than it saves.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // An unavailable worker is not worth telling the user about.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
