// apps/web/app/(app)/layout.tsx
//
// Marco autenticado de TODA la aplicación: ventana + barra superior + barra
// lateral + barra de estado. Exige sesión.
//
// El paréntesis en "(app)" es un grupo de rutas de Next.js: agrupa pantallas
// bajo un mismo layout SIN cambiarles la dirección (/vencimientos sigue siendo
// /vencimientos). Antes solo /planeador tenía este marco, y las demás opciones
// del menú —Vencimientos, Clientes, Coordinación, Usuarios, Administración,
// Herramientas y Hallazgos— eran páginas sueltas que dibujaban su propio
// marquito sin barra lateral: al entrar se sentía como salir de la aplicación.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import LogoutButton from '@/app/_components/LogoutButton';
import BarraApp from './BarraApp';

export const dynamic = 'force-dynamic';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');
  // Cliente externo (Revisoría Fiscal) sin rol de personal: va al portal.
  const STAFF = ['Administrador', 'Coordinador', 'Asesor', 'Auditor', 'Auxiliar'];
  const esStaff = sesion.esRoot || sesion.roles.some((r) => STAFF.includes(r));
  if (!esStaff && (sesion.empresaCliente || sesion.grupoCliente)) redirect('/portal');

  return (
    <main className="app-shell" style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 500px at 72% -12%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '14px', display: 'flex', justifyContent: 'center' }}>
      <div className="win app-win" style={{ width: '100%', minHeight: 'calc(100vh - 28px)', display: 'flex', flexDirection: 'column' }}>
        {/* La barra de la app (marca, menú, buscador, tema y controles) la dibuja
            el marco compartido: necesita estado, así que vive del lado del cliente. */}
        <BarraApp roles={sesion.roles} esRoot={sesion.esRoot}>{children}</BarraApp>

        <div className="win-status">
          <span className="led" /> Conectado · {sesion.nombre}
          <span className="sp" />
          <span style={{ fontFamily: 'var(--ui)' }}><LogoutButton /></span>
        </div>
      </div>
    </main>
  );
}
