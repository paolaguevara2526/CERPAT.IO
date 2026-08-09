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
   Conservador a propósito: solo guarda archivos estáticos e inmutables
   (/_next/static, íconos, imágenes). NUNCA guarda páginas HTML ni la API, porque
   las páginas se arman en el servidor con los datos de la persona que entró:
   guardarlas filtraría información entre usuarios y podría mostrar una versión
   vieja (o el login) después de iniciar sesión. */
const VERSION = '${VERSION}';
const CACHE = 'cerpat-' + VERSION;

// Solo esto se guarda: archivos con nombre versionado o recursos de marca.
function sePuedeGuardar(url, request) {
  if (request.mode === 'navigate') return false;          // páginas: siempre en vivo
  if (url.pathname.startsWith('/_next/static/')) return true;
  return /\\.(css|js|woff2?|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname);
}

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
  // Páginas y todo lo que no sea estático: se dejan pasar al navegador tal cual.
  if (!sePuedeGuardar(url, request)) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok && res.type === 'basic' && !res.redirected) {
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
