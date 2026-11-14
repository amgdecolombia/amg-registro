// AMG Service Worker v2
// 1) Guarda la pagina para que la app abra aunque no haya senal.
// 2) No intercepta los envios al servidor: la cola de marcajes sin conexion
//    la maneja la pagina (IndexedDB) y solo borra un marcaje cuando el
//    servidor confirma que quedo registrado.
const CACHE = 'amg-v2';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       // envios: siempre directo a la red
  if (req.url.indexOf('script.google.com') >= 0) return;  // datos del servidor: nunca desde cache
  var esPagina = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0;
  if (!esPagina) return;
  // Red primero; si no hay senal, la ultima version guardada de la pagina
  e.respondWith(
    fetch(req).then(function(resp) {
      var copia = resp.clone();
      caches.open(CACHE).then(function(c) { c.put(req, copia); });
      return resp;
    }).catch(function() {
      return caches.match(req, { ignoreSearch: true }).then(function(r) {
        return r || caches.match('./', { ignoreSearch: true });
      });
    })
  );
});

// Al recuperar senal, pedirle a la pagina que suba lo pendiente
self.addEventListener('sync', function(e) {
  if (e.tag === 'amg-sync') {
    e.waitUntil(self.clients.matchAll().then(function(clients) {
      clients.forEach(function(c) { c.postMessage({ type: 'FLUSH_QUEUE' }); });
    }));
  }
});
