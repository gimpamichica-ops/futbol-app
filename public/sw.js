const CACHE = 'futbol-v6';
const API = CACHE + '-api';
const SHELL = ['./', './index.html', './estilos.css', './app.js', './datos.js', './logica.js', './ligas.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('futbol-') && k !== CACHE && k !== API).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname === 'site.api.espn.com') {
    e.respondWith((async () => {
      const cache = await caches.open(API);
      try {
        const r = await fetch(e.request, {
          signal: AbortSignal.timeout(12000)
        });
        if (!r.ok) throw Error('API');
        await cache.put(e.request, r.clone());
        return r;
      } catch (error) {
        const r = await cache.match(e.request);
        if (!r) throw error;
        const headers = new Headers(r.headers);
        headers.set('X-Futbol-Cache', 'stale');
        return new Response(await r.arrayBuffer(), {
          status: r.status,
          headers
        });
      }
    })());
  } else if (u.origin === self.location.origin) {
    // Network-first: cada deploy se ve al instante; la caché solo cubre el modo sin conexión.
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
