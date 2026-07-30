import type { Metadata } from 'next';
import './desktop.css';

export const metadata: Metadata = {
  title: 'Planeador CERPAT',
  description: 'Sistema de Gestión y Planificación',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
