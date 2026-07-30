// apps/web/app/hallazgos/page.tsx — Portal de Hallazgos (Revisoría Fiscal).
// Acceso: revisor (Auditor)/Admin/root, o cliente ligado a empresa/grupo.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import LogoutButton from '@/app/_components/LogoutButton';
import PortalHallazgos from './PortalHallazgos';

export const dynamic = 'force-dynamic';

export default async function HallazgosPage() {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');

  const esGestor = sesion.esRoot || sesion.roles.some((r) => ['Administrador', 'Auditor'].includes(r));
  const esCliente = !!sesion.empresaCliente || !!sesion.grupoCliente;
  if (!esGestor && !esCliente) redirect('/planeador');

  return (
    <main style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 520px at 72% -12%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '14px', display: 'flex', justifyContent: 'center' }}>
      <div className="win" style={{ width: '100%' }}>
        <div className="win-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
          <span className="win-title">Portal de Hallazgos · Revisoría Fiscal</span>
          <span className="win-path">cerpat.io/hallazgos</span>
          <div className="win-ctl">
            <button aria-label="Minimizar"><svg viewBox="0 0 12 12"><rect x="1.5" y="6" width="9" height="1.4" fill="currentColor" /></svg></button>
            <button aria-label="Maximizar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x="1.8" y="1.8" width="8.4" height="8.4" /></svg></button>
            <button className="close" aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button>
          </div>
        </div>
        <div className="win-toolbar">
          {esGestor && <a href="/planeador" className="dbtn" style={{ textDecoration: 'none', fontSize: 13 }}>‹ Planeador</a>}
          <span className="sp" />
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginRight: 12 }}>
            {esGestor ? 'Revisor fiscal · edición habilitada' : 'Acceso del cliente · solo consulta'}
          </span>
          <LogoutButton nombre={sesion.nombre} />
        </div>
        <div className="win-body" style={{ padding: '18px 22px 28px' }}>
          <PortalHallazgos esGestor={esGestor} />
        </div>
        <div className="win-status"><span className="led" /> {esGestor ? 'Revisoría Fiscal · CERPAT' : 'Información confidencial · uso exclusivo del cliente'}</div>
      </div>
    </main>
  );
}
