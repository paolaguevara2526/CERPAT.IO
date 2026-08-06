// apps/web/app/portal/layout.tsx — Portal del Cliente (solo lectura, aislado por
// NIT/grupo). Acceso: usuario Cliente (ligado a empresa/grupo) o Administrador/root
// (previsualización). El personal no-admin va a su Planeador.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import PortalClienteShell from './PortalClienteShell';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');
  const esCliente = !!sesion.empresaCliente || !!sesion.grupoCliente;
  const esAdmin = sesion.esRoot || sesion.roles.includes('Administrador');
  if (!esCliente && !esAdmin) redirect('/planeador');
  return <PortalClienteShell nombre={sesion.nombre} esPreview={!esCliente}>{children}</PortalClienteShell>;
}
