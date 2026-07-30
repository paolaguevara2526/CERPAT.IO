// apps/web/app/planeador/layout.tsx
// Shell autenticado del planeador (React): marco de ventana + barra lateral de
// tres secciones + barra de estado. Exige sesión.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import LogoutButton from '@/app/_components/LogoutButton';
import PlaneadorSidebar from './PlaneadorSidebar';

export const dynamic = 'force-dynamic';

export default async function PlaneadorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');
  // Cliente externo (Revisoría Fiscal) sin rol de personal: va al portal.
  const STAFF = ['Administrador', 'Coordinador', 'Asesor', 'Auditor', 'Auxiliar'];
  const esStaff = sesion.esRoot || sesion.roles.some((r) => STAFF.includes(r));
  if (!esStaff && (sesion.empresaCliente || sesion.grupoCliente)) redirect('/hallazgos');
  const esAdmin = sesion.esRoot || sesion.roles.includes('Administrador');
  const esGestorHallazgos = esAdmin || sesion.roles.includes('Auditor');

  return (
    <main style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 500px at 72% -12%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '14px', display: 'flex', justifyContent: 'center' }}>
      <div className="win" style={{ width: '100%' }}>
        <div className="win-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
          <span className="win-title">Planeador CERPAT</span>
          <span className="win-path">cerpat.io/planeador</span>
          <div className="win-ctl">
            <button aria-label="Minimizar"><svg viewBox="0 0 12 12"><rect x="1.5" y="6" width="9" height="1.4" fill="currentColor" /></svg></button>
            <button aria-label="Maximizar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x="1.8" y="1.8" width="8.4" height="8.4" /></svg></button>
            <button className="close" aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', minHeight: 520 }}>
          <PlaneadorSidebar esAdmin={esAdmin} esGestorHallazgos={esGestorHallazgos} />
          <div style={{ padding: '18px 20px', overflow: 'auto' }}>{children}</div>
        </div>

        <div className="win-status">
          <span className="led" /> Conectado · {sesion.nombre}
          <span className="sp" />
          <span style={{ fontFamily: 'var(--ui)' }}><LogoutButton /></span>
        </div>
      </div>
    </main>
  );
}
