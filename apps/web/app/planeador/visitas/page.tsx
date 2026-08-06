// apps/web/app/planeador/visitas/page.tsx — Visitas del asesor/auditor al cliente.
// Cualquier usuario de la firma puede agendar; el acta la edita el responsable o
// coordinación (validado en el backend).

import { exigirRuta } from '@/lib/acceso-server';
import VisitasView from './VisitasView';

export const dynamic = 'force-dynamic';

export default async function VisitasPage() {
  // Solo Asesor / Coordinador / Auditor (y Administrador). Bloquea acceso por URL.
  await exigirRuta('/planeador/visitas');
  return <VisitasView puedeAgendar={true} />;
}
