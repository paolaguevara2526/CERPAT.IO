// apps/web/app/planeador/tablero/page.tsx — Tablero (kanban) por estado.

import { fetchTareas, AREAS, nombrePeriodo } from '../tareas';
import Tablero from '../Tablero';

export const dynamic = 'force-dynamic';

export default async function TableroPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const area = searchParams?.area || '';
  const q = searchParams?.q || '';
  const mias = searchParams?.mias === '1';
  const qs = new URLSearchParams();
  if (area) qs.set('area', area);
  if (q) qs.set('q', q);
  if (mias) qs.set('mias', '1');
  const { data, error } = await fetchTareas(qs.toString());
  const tareas = data?.tareas ?? [];

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Tablero</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {tareas.length} tareas</span>
      </div>

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input name="q" defaultValue={q} placeholder="Buscar cliente o actividad…" style={{ ...sel, minWidth: 220, flex: 1 }} />
        <select name="area" defaultValue={area} style={sel}>
          <option value="">Todas las áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
          <input type="checkbox" name="mias" value="1" defaultChecked={mias} /> Solo mías
        </label>
        <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
      </form>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar las tareas: {error}.</div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>Arrastra una tarjeta a otra columna para cambiar su estado. Las reglas (permiso, auditoría, subtareas) se validan en el servidor.</p>
          <Tablero tareas={tareas} />
        </>
      )}
    </>
  );
}
