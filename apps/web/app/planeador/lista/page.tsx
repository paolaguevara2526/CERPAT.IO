// apps/web/app/planeador/lista/page.tsx — Lista de tareas reales del plan.

import { fetchTareas, TareasTabla, ESTADO_META, AREAS, nombrePeriodo } from '../tareas';

export const dynamic = 'force-dynamic';

export default async function ListaPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const estado = searchParams?.estado || '';
  const area = searchParams?.area || '';
  const q = searchParams?.q || '';
  const qs = new URLSearchParams();
  if (estado) qs.set('estado', estado);
  if (area) qs.set('area', area);
  if (q) qs.set('q', q);
  const { data, error } = await fetchTareas(qs.toString());
  const tareas = data?.tareas ?? [];

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Lista de tareas</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {tareas.length} tareas</span>
      </div>

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <input name="q" defaultValue={q} placeholder="Buscar cliente o actividad…" style={{ ...sel, minWidth: 220, flex: 1 }} />
        <select name="area" defaultValue={area} style={sel}>
          <option value="">Todas las áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select name="estado" defaultValue={estado} style={sel}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
      </form>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar las tareas: {error}.</div>
      ) : (
        <TareasTabla tareas={tareas} />
      )}
    </>
  );
}
