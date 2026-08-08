// PWA: manifiesto de la app (Next lo sirve en /manifest.webmanifest y lo enlaza
// automáticamente). Hace la plataforma instalable en escritorio y móvil.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CERPAT · Planeador',
    short_name: 'CERPAT',
    description: 'Plataforma de gestión operativa CERPAT: seguimiento, control y automatización.',
    start_url: '/planeador',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1d33',
    theme_color: '#171C8F',
    lang: 'es',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      { src: '/icon-maskable.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'maskable' },
    ],
  };
}
