// Service Worker para Cancionero PWA
// Estrategia network-first: siempre intenta traer la versión más nueva de
// la red primero, y sólo cae al caché si no hay conexión (wifi de la
// iglesia caída). Con cache-first (la versión anterior) el celular quedaba
// pegado a la versión que se guardó la primera vez que se instaló, y nunca
// veía builds nuevos aunque se recargara la app.

const CACHE_NAME = 'cancionero-v4';

// La carpeta donde está publicada la app sale de dónde quedó registrado
// este archivo, no de un nombre escrito a mano: así cambiar el nombre del
// repositorio (o pasar a un dominio propio) no rompe el modo sin conexión.
const RAIZ = self.registration.scope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

// Al activar, borrar cachés de versiones anteriores del SW (incluye el
// caché viejo cache-first que haya quedado guardado en el celular)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }
  // Las páginas del inicio de sesión de Firebase (/__/auth/...) viven en
  // este mismo dominio: no se tocan ni se guardan, van directo a la red.
  if (new URL(event.request.url).pathname.startsWith('/__/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).then(response => {
      // Guardar en caché sólo las URLs propias de Cancionero, para el
      // fallback offline. No tocar Firestore ni recursos externos.
      if (response && response.status === 200 && event.request.url.startsWith(RAIZ)) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      // Sin red: usar lo último que se guardó en caché
      return caches.match(event.request).then(cached => {
        return cached || caches.match(RAIZ + 'index.html');
      });
    })
  );
});
