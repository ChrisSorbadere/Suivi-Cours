// v3 — stratégie réseau d'abord : l'app se met toujours à jour
const CACHE = 'suivi-cours-v3';

self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => {
  // Purger TOUS les anciens caches (y compris v1/v2 cache-first)
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return resp;
      })
      .catch(() => caches.match(e.request)) // offline : servir le cache
  );
});
