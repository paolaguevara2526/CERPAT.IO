import type { Metadata, Viewport } from 'next';
import './desktop.css';
import PwaRegister from './PwaRegister';

export const metadata: Metadata = {
  title: 'Planeador CERPAT',
  description: 'Sistema de Gestión y Planificación',
  applicationName: 'CERPAT',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'CERPAT' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#171C8F',
};

// Aplica el tema guardado antes de pintar, para evitar parpadeo.
const TEMA_INIT = `(function(){try{var t=localStorage.getItem('cerpat_tema')||'claro';document.documentElement.setAttribute('data-cerpat-theme',t);}catch(e){document.documentElement.setAttribute('data-cerpat-theme','claro');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-cerpat-theme="claro">
      <head><script dangerouslySetInnerHTML={{ __html: TEMA_INIT }} /></head>
      <body>{children}<PwaRegister /></body>
    </html>
  );
}
