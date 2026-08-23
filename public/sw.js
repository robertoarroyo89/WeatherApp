/* Atmos service worker.
 *
 * Deliberately small. Two jobs:
 *
 *   1. Make the app shell open instantly, and open at all with no connection.
 *   2. Stay out of the way of the weather data, which has its own freshness
 *      rules in localStorage. A service worker that also cached forecast JSON
 *      would give us two caches disagreeing about what "current" means.
 *
 * Strategies:
 *   - Immutable build assets (/_next/static, fonts, icons): cache first.
 *   - Navigations: network first, falling back to the cached shell offline.
 *   - Everything else, including every API call: straight to the network.
 */

const VERSION = 'atmos-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

/** Last resort: no network, and no shell cached yet either. */
const OFFLINE_PAGE = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Sin conexión</title>
<style>
  html,body{margin:0;height:100%}
  body{background:#0b1622;color:#f2f5f7;display:grid;place-items:center;
    font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
    text-align:center;padding:2rem;-webkit-font-smoothing:antialiased}
  h1{font-size:1.5rem;font-weight:200;letter-spacing:-.02em;margin:0 0 .75rem}
  p{margin:0;opacity:.62;font-size:.9375rem;line-height:1.5}
</style></head>
<body><div><h1>Sin conexión</h1>
<p>Vuelve a abrir Atmos cuando tengas red.</p></div></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One failed URL must not abort the whole install.
      await Promise.allSettled(
        SHELL_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:woff2?|ttf|otf|png|svg|webp|avif|ico)$/.test(url.pathname)
  );
}

/** Fire-and-forget cache write. A failed write must never fail the response. */
function stash(cacheName, request, response) {
  caches
    .open(cacheName)
    .then((cache) => cache.put(request, response))
    .catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Weather data is never touched: the app decides what is fresh.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // Only a good response earns its place as the offline shell. Without
          // this guard a 404 or a 500 would overwrite it.
          if (response.ok) stash(SHELL_CACHE, '/', response.clone());
          return response;
        } catch {
          const cached = await caches.match('/', { ignoreSearch: true });
          if (cached) return cached;
          return new Response(OFFLINE_PAGE, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            status: 200,
          });
        }
      })(),
    );
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) stash(ASSET_CACHE, request, response.clone());
        return response;
      })(),
    );
  }
});
