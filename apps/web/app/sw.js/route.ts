// Service worker servido desde una ruta (no como archivo estático) para que su
// contenido cambie en CADA despliegue: el navegador compara byte a byte el
// sw.js y solo entonces detecta que hay una versión nueva. El identificador del
// despliegue va incrustado, así que cada deploy invalida la caché anterior.

export const dynamic = 'force-static';

// Identificador estable por despliegue (Vercel lo inyecta en el build).
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)
  ?? process.env.NEXT_PUBLIC_BUILD_ID
  ?? 'dev';

const SW = `/* Service worker de CERPAT (PWA) — versión ${VERSION}.
   Conservador: nunca cachea la API ni peticiones que no sean GET. Network-first
   para el contenido propio, con caché de respaldo cuando no hay conexión. */
const VERSION = '${VERSION}';
const CACHE = 'cerpat-' + VERSION;

self.addEventListener('install', () => {
  // La versión nueva toma el control sin esperar a que se cierren las pestañas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Solo GET del mismo origen; nunca la API (datos y sesión siempre en vivo).
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;
  if (url.pathname === '/sw.js') return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});

// Permite que la página fuerce la activación inmediata de una versión nueva.
self.addEventListener('message', (e) => {
  if (e.data === 'saltar-espera') self.skipWaiting();
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // El navegador debe revalidar siempre el service worker.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
