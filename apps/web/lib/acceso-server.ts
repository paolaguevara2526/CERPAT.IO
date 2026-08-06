// apps/web/lib/acceso-server.ts
// Guarda de ruta para Server Components: exige sesión y que el rol pueda ver la
// ruta (según ACCESO_RUTA). Si no, redirige. Complementa la ocultación del menú
// con bloqueo real por URL. Devuelve la sesión para reutilizarla en la página.

import { redirect } from 'next/navigation';
import { getSessionUser } from './session';
import { puedeVerRuta } from './acceso';

export async function exigirRuta(href: string) {
  const sesion = await getSessionUser();
  if (!sesion) redirect('/login');
  if (sesion.debeCambiarPassword) redirect('/cambiar-clave');
  if (!puedeVerRuta(sesion, href)) redirect('/planeador');
  return sesion;
}
