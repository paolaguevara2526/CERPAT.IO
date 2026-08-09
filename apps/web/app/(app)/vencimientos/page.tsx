// apps/web/app/(app)/vencimientos/page.tsx — Vencimientos tributarios por cliente.
// Acceso: usuarios de la firma. Edición (estado/notas): solo Administrador / root.

import { exigirRuta } from '@/lib/acceso-server';
import VencimientosView from './VencimientosView';


export const metadata = { title: 'Vencimientos' };
export const dynamic = 'force-dynamic';

export default async function VencimientosPage() {
  // Solo Coordinador / Auditor (y Administrador). Bloquea acceso por URL.
  const sesion = await exigirRuta('/vencimientos');
  const esEditor = sesion.esRoot || sesion.roles.includes('Administrador');

  return <VencimientosView esEditor={esEditor} />;
}
