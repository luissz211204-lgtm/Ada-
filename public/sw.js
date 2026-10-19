/*
 * Service worker mínimo de E.V.
 *
 * Objetivo: hacer la aplicación instalable (PWA) sin cachear datos
 * dinámicos que podrían quedar obsoletos o mostrar información de otra
 * sesión. Solo se sirve desde caché un pequeño conjunto de recursos
 * estáticos; todo lo demás va siempre a la red.
 */
const STATIC_CACHE = 'ev-static-v1';
const STATIC_ASSETS = ['/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear la API ni las páginas: los datos deben ser siempre frescos.
  if (url.pathname.startsWith('/api/')) return;

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).catch(() => cached)),
    );
  }
});
