// apps/web/app/planeador/auditoria/page.tsx — Cola de auditoría del período.

import { apiFetch } from '@/lib/session';
import { exigirRuta } from '@/lib/acceso-server';
import { nombrePeriodo } from '../tareas';
import AuditoriaCola, { type TareaAuditoria } from '../AuditoriaCola';


export const metadata = { title: 'Auditoría' };
export const dynamic = 'force-dynamic';

type Resp = { periodo: string | null; total: number; tareas: TareaAuditoria[] };

async function fetchAuditoria(): Promise<{ data: Resp | null; error: string | null }> {
  try {
    const res = await apiFetch('/plan/auditoria');
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Resp, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

export default async function AuditoriaPage() {
  await exigirRuta('/planeador/auditoria'); // solo Coordinador / Auditor (y Admin)
  const { data, error } = await fetchAuditoria();
  const tareas = data?.tareas ?? [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Auditoría</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {tareas.length} por revisar</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
        Tareas enviadas a revisión (estado <strong>En revisión</strong>). Aprueba para darlas por terminadas (quedan bloqueadas como <strong>Auditado</strong>) o devuélvelas con observaciones para que el auxiliar corrija.
      </p>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: 'var(--peligro-fuerte)', fontWeight: 600 }}>No se pudo cargar la cola de auditoría: {error}.</div>
      ) : tareas.length === 0 ? (
        <div className="panel" style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>
          No hay tareas pendientes de auditoría este período. 🎉
          <div style={{ fontSize: 12, marginTop: 6 }}>Cuando un ejecutor marca una tarea como <strong>En revisión</strong> (en el Tablero o la Lista), aparece aquí.</div>
        </div>
      ) : (
        <AuditoriaCola tareas={tareas} />
      )}
    </>
  );
}
