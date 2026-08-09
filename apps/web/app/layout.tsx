import type { Metadata, Viewport } from 'next';
import './desktop.css';
import PwaRegister from './PwaRegister';
import InstalarIOS from './InstalarIOS';

export const metadata: Metadata = {
  // Plantilla: cada pantalla pone su nombre y aquí se le añade la marca. Así la
  // pestaña dice "Pagos · CERPAT" en vez de "Planeador CERPAT" en las 14 vistas
  // —que además hacía que la app instalada mostrara el nombre tres veces.
  title: { default: 'Planeador CERPAT', template: '%s · CERPAT' },
  description: 'Sistema de Gestión y Planificación',
  applicationName: 'CERPAT',
  manifest: '/manifest.webmanifest',
  // iOS: se abre a pantalla completa al añadirla a inicio. La barra de estado
  // 'default' mantiene la hora legible sobre el header oscuro.
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'CERPAT' },
  // Safari/iOS NO acepta SVG como ícono de app: el apple-touch-icon debe ser PNG.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#171C8F',
  // iPhone con notch/isla dinámica: el contenido usa toda la pantalla y se
  // respeta el área segura desde el CSS (safe-area-inset).
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

// Aplica el tema guardado antes de pintar, para evitar parpadeo.
const TEMA_INIT = `(function(){try{var t=localStorage.getItem('cerpat_tema')||'claro';document.documentElement.setAttribute('data-cerpat-theme',t);}catch(e){document.documentElement.setAttribute('data-cerpat-theme','claro');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-cerpat-theme="claro">
      <head><script dangerouslySetInnerHTML={{ __html: TEMA_INIT }} /></head>
      <body>{children}<PwaRegister /><InstalarIOS /></body>
    </html>
  );
}
