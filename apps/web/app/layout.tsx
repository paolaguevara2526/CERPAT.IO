import type { Metadata } from 'next';
import './desktop.css';

export const metadata: Metadata = {
  title: 'Planeador CERPAT',
  description: 'Sistema de Gestión y Planificación',
};

// Aplica el tema guardado antes de pintar, para evitar parpadeo.
const TEMA_INIT = `(function(){try{var t=localStorage.getItem('cerpat_tema')||'claro';document.documentElement.setAttribute('data-cerpat-theme',t);}catch(e){document.documentElement.setAttribute('data-cerpat-theme','claro');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-cerpat-theme="claro">
      <head><script dangerouslySetInnerHTML={{ __html: TEMA_INIT }} /></head>
      <body>{children}</body>
    </html>
  );
}
