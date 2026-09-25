/* Service Worker der Studio (F-PWA).
   App-Shell cache-first: index.html, Manifest, Icons. Schriften von Google werden beim ersten Laden
   mitgespeichert (ohne Netz faellt die App auf Systemschrift zurueck, das sieht gut aus).
   KEINE Kundendaten: Die liegen in localStorage/IndexedDB und werden nie ueber fetch geladen.
   Alles, was nicht zur Shell gehoert (andere Hosts, POST, Anfragen mit Suchparametern ausser
   Navigation), geht unveraendert ans Netz und wird nicht gespeichert.
   Update: Der Build ersetzt 2161a021a369 durch einen Hash von index.html. Neue Version
   installiert sich im Hintergrund und wartet; die Seite zeigt "Есть новая версия · Обновить" und
   schickt auf Klick {type:'SKIP_WAITING'}. */
const VERSION = '2161a021a369';
const CACHE = 'studio-shell-' + VERSION;
const FONT_CACHE = 'studio-fonts-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  // cache:'reload' umgeht den HTTP-Cache, damit wirklich die neue Fassung gespeichert wird
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u =>
    fetch(new Request(u, {cache: 'reload'})).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); })
  ))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('studio-shell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      // jede Navigation innerhalb des Bereichs bekommt die App-Shell (Hash und ?-Parameter egal)
      e.respondWith(caches.open(CACHE).then(c => c.match('./index.html').then(hit => hit || fetch(req))));
      return;
    }
    const path = './' + url.pathname.split('/').pop();
    if (!url.search && SHELL.includes(path)) {
      e.respondWith(caches.open(CACHE).then(c => c.match(path).then(hit => hit || fetch(req))));
    }
    return; // alles andere: Netz, nichts speichern
  }
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(FONT_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    }).catch(() => new Response('', {status: 504})))));
  }
});
