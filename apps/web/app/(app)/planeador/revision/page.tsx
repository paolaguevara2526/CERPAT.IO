// apps/web/app/(app)/planeador/revision/page.tsx — Cola de revisión de impuestos.
// Acceso: Revisor y Coordinación (y Administrador/root). El Asesor no entra:
// vería el trabajo de sus compañeros esperando visto bueno.

import { exigirRuta } from '@/lib/acceso-server';
import ColaRevision from './ColaRevision';

export const metadata = { title: 'Revisión de impuestos' };
export const dynamic = 'force-dynamic';

export default async function RevisionPage() {
  await exigirRuta('/planeador/revision');

  return (
    <>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Revisión de impuestos</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 13, maxWidth: 760, lineHeight: 1.6 }}>
        Lo que los asesores enviaron a revisión, <strong>del más antiguo al más reciente</strong>. No hay reparto:
        la cola es de los dos y se toma por orden de llegada. Al <strong>devolver</strong> hay que decir qué
        corregir — es lo único que el asesor va a leer. Solo después de <strong>aprobar</strong> puede él
        presentar la declaración.
      </p>
      <ColaRevision />
    </>
  );
}
