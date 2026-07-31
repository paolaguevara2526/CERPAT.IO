// apps/web/app/vencimientos/page.tsx — Vencimientos tributarios por cliente.
// Acceso: usuarios de la firma. Edición (estado/notas): solo Administrador / root.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import LogoutButton from '@/app/_components/LogoutButton';
import VencimientosView from './VencimientosView';

export const dynamic = 'force-dynamic';
const ROLES_FIRMA = ['Administrador', 'Coordinador', 'Asesor', 'Auxiliar', 'Auditor'];

export default async function VencimientosPage() {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');

  const esFirma = sesion.esRoot || sesion.roles.some((r) => ROLES_FIRMA.includes(r));
  if (!esFirma) redirect('/planeador');
  const esEditor = sesion.esRoot || sesion.roles.includes('Administrador');

  return (
    <main style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 520px at 72% -12%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '14px', display: 'flex', justifyContent: 'center' }}>
      <div className="win" style={{ width: '100%' }}>
        <div className="win-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
          <span className="win-title">Vencimientos tributarios</span>
          <span className="win-path">cerpat.io/vencimientos</span>
          <div className="win-ctl">
            <button aria-label="Minimizar"><svg viewBox="0 0 12 12"><rect x="1.5" y="6" width="9" height="1.4" fill="currentColor" /></svg></button>
            <button aria-label="Maximizar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x="1.8" y="1.8" width="8.4" height="8.4" /></svg></button>
            <button className="close" aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button>
          </div>
        </div>
        <div className="win-toolbar">
          <a href="/planeador" className="dbtn" style={{ textDecoration: 'none', fontSize: 13 }}>‹ Planeador</a>
          <span className="sp" />
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginRight: 12 }}>
            {esEditor ? 'Administrador · edición habilitada' : 'Consulta del equipo'}
          </span>
          <LogoutButton nombre={sesion.nombre} />
        </div>
        <div className="win-body" style={{ padding: '18px 22px 28px' }}>
          <VencimientosView esEditor={esEditor} />
        </div>
        <div className="win-status"><span className="led" /> Vencimientos · CERPAT</div>
      </div>
    </main>
  );
}
