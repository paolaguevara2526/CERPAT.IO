// apps/web/app/planeador/tablero/page.tsx — Tablero (kanban) por estado.

import { fetchTareas, AREAS } from '../tareas';
import Tablero from '../Tablero';
import NavegadorPeriodo from '@/app/_components/NavegadorPeriodo';
import { nombrePeriodo, periodoAMostrar } from '@/lib/periodo';


export const metadata = { title: 'Tablero' };
export const dynamic = 'force-dynamic';

export default async function TableroPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const area = searchParams?.area || '';
  const q = searchParams?.q || '';
  const mias = searchParams?.mias === '1';
  // El período viaja en la URL: el mes que se está viendo se puede compartir y
  // marcar, y al recargar no se vuelve solo al mes en curso.
  const periodo = periodoAMostrar(searchParams?.periodo);
  const qs = new URLSearchParams();
  if (area) qs.set('area', area);
  if (q) qs.set('q', q);
  if (mias) qs.set('mias', '1');
  qs.set('periodo', periodo);
  const { data, error } = await fetchTareas(qs.toString());
  const tareas = data?.tareas ?? [];

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Tablero</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{nombrePeriodo(data?.periodo)} · {tareas.length} tareas</span>
      </div>
      <div style={{ marginBottom: 12 }}><NavegadorPeriodo /></div>

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input type="hidden" name="periodo" value={periodo} />
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
        <div className="panel" style={{ padding: '16px 18px', color: 'var(--peligro-fuerte)', fontWeight: 600 }}>No se pudieron cargar las tareas: {error}.</div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>Arrastra una tarjeta a otra columna para cambiar su estado. Las reglas (permiso, auditoría, subtareas) se validan en el servidor.</p>
          <Tablero tareas={tareas} />
        </>
      )}
    </>
  );
}
