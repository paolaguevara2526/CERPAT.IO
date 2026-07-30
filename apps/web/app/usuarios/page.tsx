// apps/web/app/usuarios/page.tsx
// Gestión de usuarios (CRUD) — solo Administrador/root. Estilo "software de
// escritorio" (marco de ventana + relieve 3D sutil, ver desktop.css).

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import LogoutButton from '@/app/_components/LogoutButton';
import UsuariosPanel from './UsuariosPanel';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');
  const esAdmin = sesion.esRoot || sesion.roles.includes('Administrador');
  if (!esAdmin) redirect('/planeador');

  return (
    <main style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 500px at 70% -10%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '26px 18px 44px', display: 'flex', justifyContent: 'center' }}>
      <div className="win" style={{ width: '100%', maxWidth: 1080 }}>
        <div className="win-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#47D498" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginLeft: 2 }}>
            <circle cx="13.2" cy="3.7" r="1.8" fill="#47D498" stroke="none" /><path d="M13 6.6l-1.8 5.8" /><path d="M11.2 12.4l2.6 3.4-.4 5" /><path d="M11.2 12.4l-3 2.5-1.9 5.1" /><path d="M12.2 8.1l3.9 2.1" /><path d="M18 5.8L14.7 21" /><path d="M13.4 7.2c2.6.1 3.4 1.4 3.1 4-1.2.5-2.4.3-3.4-.4" fill="#47D498" stroke="none" />
          </svg>
          <span className="win-title">Usuarios</span>
          <span className="win-path">cerpat.io/usuarios</span>
          <div className="win-ctl">
            <button aria-label="Minimizar"><svg viewBox="0 0 12 12"><rect x="1.5" y="6" width="9" height="1.4" fill="currentColor" /></svg></button>
            <button aria-label="Maximizar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x="1.8" y="1.8" width="8.4" height="8.4" /></svg></button>
            <button className="close" aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button>
          </div>
        </div>

        <div className="win-toolbar">
          <a href="/planeador" className="dbtn" style={{ textDecoration: 'none', fontSize: 13 }}>‹ Planeador</a>
          <span className="sp" />
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginRight: 12 }}>Gestiona los usuarios y asigna roles</span>
          <LogoutButton nombre={sesion.nombre} />
        </div>

        <div className="win-body" style={{ padding: '18px 22px 26px' }}>
          <UsuariosPanel />
        </div>

        <div className="win-status"><span className="led" /> Administración · {sesion.nombre}</div>
      </div>
    </main>
  );
}
