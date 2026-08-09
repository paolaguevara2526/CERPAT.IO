// apps/web/app/portal/layout.tsx — Portal del Cliente (solo lectura, aislado por
// NIT/grupo). Acceso: usuario Cliente (ligado a empresa/grupo) o Administrador/root
// (previsualización). El personal no-admin va a su Planeador.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import LogoutButton from '@/app/_components/LogoutButton';
import PortalClienteShell from './PortalClienteShell';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');
  const esCliente = !!sesion.empresaCliente || !!sesion.grupoCliente;
  const esAdmin = sesion.esRoot || sesion.roles.includes('Administrador');
  if (!esCliente && !esAdmin) redirect('/planeador');
  return (
    <main className="app-shell" style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 500px at 72% -12%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '14px', display: 'flex', justifyContent: 'center' }}>
      <div className="win app-win" style={{ width: '100%', minHeight: 'calc(100vh - 28px)', display: 'flex', flexDirection: 'column' }}>
        <PortalClienteShell esPreview={!esCliente}>{children}</PortalClienteShell>
        <div className="win-status">
          <span className="led" /> Información confidencial · uso exclusivo del cliente
          <span className="sp" />
          <span style={{ fontFamily: 'var(--ui)' }}><LogoutButton nombre={sesion.nombre} /></span>
        </div>
      </div>
    </main>
  );
}
