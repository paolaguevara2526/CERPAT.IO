// apps/web/app/(app)/administracion/page.tsx — Panel de Administración (catálogos y parámetros).
// Solo Administrador o root.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import AdminPanel from './AdminPanel';


export const metadata = { title: 'Administración' };
export const dynamic = 'force-dynamic';

export default async function AdministracionPage() {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');
  const esAdmin = sesion.esRoot || sesion.roles.includes('Administrador');
  const esCoordinacion = esAdmin || sesion.roles.includes('Coordinador');
  // Coordinación entra pero solo ve Empresas, Config. tributaria y Plan por cliente.
  if (!esCoordinacion) redirect('/planeador');

  return <AdminPanel esAdmin={esAdmin} />;
}
