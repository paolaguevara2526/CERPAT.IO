// apps/web/app/planeador/mi-dia/page.tsx — tareas asignadas al usuario en sesión.

import { fetchTareas, TareasTabla, nombrePeriodo } from '../tareas';

export const dynamic = 'force-dynamic';

export default async function MiDiaPage() {
  const { data, error } = await fetchTareas('mias=1');
  const tareas = data?.tareas ?? [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Mi Día</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {tareas.length} tareas</span>
      </div>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 13 }}>Tus tareas del período como asesor o auxiliar.</p>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar las tareas: {error}.</div>
      ) : tareas.length === 0 ? (
        <div className="panel" style={{ padding: 26, color: 'var(--muted)' }}>No tienes tareas asignadas este período. Cuando se te asignen actividades por área, aparecerán aquí.</div>
      ) : (
        <TareasTabla tareas={tareas} mostrarAsesor={false} />
      )}
    </>
  );
}
