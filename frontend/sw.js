// RateMyStop service worker — minimal, network-first with offline fallback.
// Lets the app install to home screen and work briefly offline.
const CACHE = 'civicvoice-v65-bold-hero-compact-boxes';
const ASSETS_BUMP_NOTE = 'BOLD hero with color/gradient/live signal/inline stats. Recent stories = 4 square cards (was 6 rectangles). How-It-Works step 3 emphasizes public visibility. Features section removed. Phone UI: compact boxes across stories/polls/contributors. Bot ticker cadence: ±70% jitter for organic feel.';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './api.js',
  './static-data.js',
  './static-data-extras.js',
  './departments-data.js',
  './statutes-data.js',
  './manifest.webmanifest',
  './ratemystop-sponsor-pitch.pdf',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        // Cache successful responses for static assets
        if (resp.ok && new URL(event.request.url).origin === location.origin) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
  );
});
