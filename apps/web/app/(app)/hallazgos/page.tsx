// apps/web/app/(app)/hallazgos/page.tsx — Portal de Hallazgos (Revisoría Fiscal).
// Acceso: revisor (Auditor)/Admin/root, o cliente ligado a empresa/grupo.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import PortalHallazgos from './PortalHallazgos';


export const metadata = { title: 'Portal de Hallazgos' };
export const dynamic = 'force-dynamic';

export default async function HallazgosPage() {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');

  const esGestor = sesion.esRoot || sesion.roles.some((r) => ['Administrador', 'Auditor'].includes(r));
  const esCliente = !!sesion.empresaCliente || !!sesion.grupoCliente;
  if (!esGestor && !esCliente) redirect('/planeador');

  return <PortalHallazgos esGestor={esGestor} />;
}
