// apps/web/app/(app)/usuarios/page.tsx
// Gestión de usuarios. El CRUD completo es del Administrador/root; la
// coordinación entra en modo acotado, solo a repartir roles (p. ej. marcar
// quién revisa impuestos) sin depender de que el Administrador esté disponible.
// Crear, eliminar, desactivar y restablecer claves siguen siendo del
// Administrador, en la pantalla y en el backend.

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
  if (!esAdmin && !sesion.roles.includes('Coordinador')) redirect('/planeador');

  return <UsuariosPanel esAdmin={esAdmin} />;
}
