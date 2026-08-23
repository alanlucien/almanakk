/* Almanakk service worker: cache the app shell so it opens offline.
   Event data offline comes from localStorage (see gcal.js), not from here. */
'use strict';

const CACHE = 'almanakk-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'gcal.js', 'config.js',
  'demo-data.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Network first (so updates arrive), cache fallback (so it works on a plane).
// Only same-origin requests; Google APIs always go to the network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return resp;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
