// AMG Service Worker — Offline Queue
const CACHE = 'amg-v1';
const QUEUE_KEY = 'amg-offline-queue';

// Cache the app shell on install
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
});

// Intercept POST requests to GAS
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  
  // Only intercept POST to our script
  if (e.request.method !== 'POST' || url.indexOf('script.google.com') < 0) {
    return;
  }

  e.respondWith(
    fetch(e.request.clone())
      .then(function(response) {
        // Online — succeeded, clear any queued item for this user if it was a retry
        return response;
      })
      .catch(function(err) {
        // Offline — queue the request
        return e.request.json().then(function(body) {
          return saveToQueue(url, body);
        }).then(function() {
          // Return a fake success so the UI shows confirmation
          return new Response(JSON.stringify({status:'queued',msg:'Sin conexion. Registro guardado localmente y se enviara automaticamente cuando recuperes senal.'}), {
            headers: {'Content-Type':'application/json'}
          });
        });
      })
  );
});

function saveToQueue(url, body) {
  return self.clients.matchAll().then(function(clients) {
    // Store in IndexedDB via message to client
    clients.forEach(function(client) {
      client.postMessage({type:'QUEUE_ADD', url:url, body:body});
    });
  });
}

// Listen for sync event (Background Sync API)
self.addEventListener('sync', function(e) {
  if (e.tag === 'amg-sync') {
    e.waitUntil(flushQueue());
  }
});

function flushQueue() {
  // Signal clients to flush
  return self.clients.matchAll().then(function(clients) {
    clients.forEach(function(c) { c.postMessage({type:'FLUSH_QUEUE'}); });
  });
}
