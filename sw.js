/* Ironman Trainer service worker.
 *
 * Strategy: network-first for same-origin GETs, falling back to the cache when
 * offline. Network-first matters here because the whole app is one HTML file —
 * a cache-first worker would pin trainees to an old edition until the cache
 * name changed. Every successful fetch refreshes the cache, so the last page
 * that loaded online is what you get at the pool with no signal.
 *
 * Bump CACHE when you cut a new edition (see CHANGELOG.md).
 */
const CACHE = 'im-trainer-v2.9';

const PRECACHE = [
  './',
  './index.html',
  './Ironman Trainer.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // One bad URL must not fail the whole install, so add them individually.
      .then(cache => Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => {
        if (hit) return hit;
        // A navigation to any in-app URL should still open the app offline.
        if (req.mode === 'navigate') return caches.match('./Ironman Trainer.html');
        return Response.error();
      }))
  );
});
