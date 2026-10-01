// Service worker: la app funciona instalada y abre aunque la red falle.
const CACHE = 'veoleo-v4';
const SHELL = ['./', './index.html', './css/app.css', './js/main.js', './assets/icon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith('/__/')) return; // inicio de sesión de Firebase: siempre de la red
  const isStatic = /fonts\.(googleapis|gstatic)\.com|unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|gstatic\.com\/firebasejs/.test(url.host + url.pathname);
  if (!sameOrigin && !isStatic) return;
  // Red primero (siempre lo último publicado), caché como respaldo.
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (sameOrigin || isStatic)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))),
  );
});
