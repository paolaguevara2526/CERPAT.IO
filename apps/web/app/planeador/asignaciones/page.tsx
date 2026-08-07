// apps/web/app/planeador/asignaciones/page.tsx — Tablero de asignaciones.
// Trae las filas (cliente × área con asesor/auxiliar) y delega toda la vista
// interactiva (filtros, métricas, vistas por persona/área/cliente) al cliente.
// Alcance validado en el backend: coordinación ve todo; asesor/auxiliar, lo suyo.

import { apiFetch } from '@/lib/session';
import { exigirRuta } from '@/lib/acceso-server';
import AsignacionesView, { type FilaAsignacion } from './AsignacionesView';

export const dynamic = 'force-dynamic';

type Data = { esCoordinacion: boolean; yoId: string; filas: FilaAsignacion[] };

async function fetchAsignaciones(): Promise<{ data: Data | null; error: string | null }> {
  try {
    const res = await apiFetch('/plan/asignaciones');
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

export default async function AsignacionesPage() {
  await exigirRuta('/planeador/asignaciones');
  const { data, error } = await fetchAsignaciones();

  if (error) {
    return (
      <>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>Asignaciones</h1>
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar las asignaciones: {error}.</div>
      </>
    );
  }

  return <AsignacionesView filas={data?.filas ?? []} esCoordinacion={!!data?.esCoordinacion} />;
}
