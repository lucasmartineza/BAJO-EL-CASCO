// Bajo el Casco — funciona sin señal una vez abierta (útil en los tramos)
const V = 'bec-v3';
const FILES = ['./', 'index.html', 'app.js', 'logo.png', 'topo.svg', 'manifest.webmanifest',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  'fonts/bc-500.woff2', 'fonts/bc-600.woff2', 'fonts/bc-700.woff2', 'fonts/bc-800.woff2', 'fonts/lora-italic.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)).catch(() => {}); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
