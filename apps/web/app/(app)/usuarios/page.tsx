// apps/web/app/(app)/usuarios/page.tsx
// Gestión de usuarios (CRUD) — solo Administrador/root. Estilo "software de
// escritorio" (marco de ventana + relieve 3D sutil, ver desktop.css).

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import UsuariosPanel from './UsuariosPanel';


export const metadata = { title: 'Usuarios' };
export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');
  const esAdmin = sesion.esRoot || sesion.roles.includes('Administrador');
  if (!esAdmin) redirect('/planeador');

  return <UsuariosPanel />;
}
