// apps/web/app/planeador/lista/page.tsx — Lista de tareas reales del plan.

import { fetchTareas, TareasTabla, ESTADO_META, AREAS, nombrePeriodo } from '../tareas';
import { getSessionUser, apiFetch } from '@/lib/session';


export const metadata = { title: 'Lista' };
export const dynamic = 'force-dynamic';

const ESTADOS_PAGO: { k: string; label: string }[] = [
  { k: 'pendiente', label: 'Pago pendiente' },
  { k: 'presentado_sin_pago', label: 'Presentado sin pago' },
  { k: 'presentado_pagado', label: 'Presentado y pagado' },
  { k: 'no_presentado', label: 'No presentado' },
];

async function fetchPersonas(): Promise<{ id: string; nombre: string }[]> {
  try {
    const res = await apiFetch('/plan/form-datos');
    if (!res.ok) return [];
    const d = await res.json();
    return d.usuarios ?? [];
  } catch { return []; }
}

const PAGE_SIZE = 50;

export default async function ListaPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const p = searchParams ?? {};
  const claves = ['q', 'area', 'estado', 'prioridad', 'asesorId', 'auxiliarId', 'estadoPago', 'venceDesde', 'venceHasta', 'periodo'] as const;
  const pagina = Math.max(1, parseInt(p.page ?? '1', 10) || 1);
  const qs = new URLSearchParams();
  for (const k of claves) if (p[k]) qs.set(k, p[k]!);
  const hayFiltros = claves.some((k) => p[k]);
  qs.set('page', String(pagina));
  qs.set('pageSize', String(PAGE_SIZE));

  const [{ data, error }, sesion, personas] = await Promise.all([fetchTareas(qs.toString()), getSessionUser(), fetchPersonas()]);
  const tareas = data?.tareas ?? [];
  const total = data?.total ?? tareas.length;
  const totalPaginas = data?.totalPaginas ?? 1;
  const paginaActual = data?.page ?? pagina;

  // Enlaces del paginador preservando los filtros activos.
  const urlPagina = (n: number) => {
    const u = new URLSearchParams();
    for (const k of claves) if (p[k]) u.set(k, p[k]!);
    if (n > 1) u.set('page', String(n));
    const s = u.toString();
    return `/planeador/lista${s ? `?${s}` : ''}`;
  };
  const desde = total === 0 ? 0 : (paginaActual - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(paginaActual * PAGE_SIZE, total);
  const gestionable = !!sesion && (sesion.esRoot || sesion.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)));

  const sel: React.CSSProperties = { padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'var(--ui)' };
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3, display: 'block' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Lista de tareas</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {total} tareas</span>
        </div>
      </div>

      <form method="get" className="panel" style={{ padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Buscar</span><input name="q" defaultValue={p.q ?? ''} placeholder="Cliente o actividad…" style={{ ...sel, width: '100%' }} /></label>
          <label><span style={lbl}>Área</span>
            <select name="area" defaultValue={p.area ?? ''} style={{ ...sel, width: '100%' }}>
              <option value="">Todas</option>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label><span style={lbl}>Estado</span>
            <select name="estado" defaultValue={p.estado ?? ''} style={{ ...sel, width: '100%' }}>
              <option value="">Todos</option>{Object.entries(ESTADO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label><span style={lbl}>Prioridad</span>
            <select name="prioridad" defaultValue={p.prioridad ?? ''} style={{ ...sel, width: '100%' }}>
              <option value="">Todas</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
          </label>
          <label><span style={lbl}>Estado de pago</span>
            <select name="estadoPago" defaultValue={p.estadoPago ?? ''} style={{ ...sel, width: '100%' }}>
              <option value="">Todos</option>{ESTADOS_PAGO.map((e) => <option key={e.k} value={e.k}>{e.label}</option>)}
            </select>
          </label>
          <label><span style={lbl}>Asesor</span>
            <select name="asesorId" defaultValue={p.asesorId ?? ''} style={{ ...sel, width: '100%' }}>
              <option value="">Todos</option>{personas.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </label>
          <label><span style={lbl}>Auxiliar</span>
            <select name="auxiliarId" defaultValue={p.auxiliarId ?? ''} style={{ ...sel, width: '100%' }}>
              <option value="">Todos</option>{personas.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </label>
          <label><span style={lbl}>Período</span><input name="periodo" defaultValue={p.periodo ?? ''} placeholder="YYYY-MM" style={{ ...sel, width: '100%' }} /></label>
          <label><span style={lbl}>Vence desde</span><input type="date" name="venceDesde" defaultValue={p.venceDesde ?? ''} style={{ ...sel, width: '100%' }} /></label>
          <label><span style={lbl}>Vence hasta</span><input type="date" name="venceHasta" defaultValue={p.venceHasta ?? ''} style={{ ...sel, width: '100%' }} /></label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
          <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
          {hayFiltros && <a href="/planeador/lista" className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>Limpiar</a>}
        </div>
      </form>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: 'var(--peligro-fuerte)', fontWeight: 600 }}>No se pudieron cargar las tareas: {error}.</div>
      ) : (
        <>
          <TareasTabla tareas={tareas} gestionable={gestionable} />
          {total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Mostrando {desde}–{hasta} de {total}</span>
              {totalPaginas > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {paginaActual > 1
                    ? <a href={urlPagina(paginaActual - 1)} className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>‹ Anterior</a>
                    : <span className="dbtn" style={{ fontSize: 13, opacity: 0.45, pointerEvents: 'none' }}>‹ Anterior</span>}
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>Página {paginaActual} de {totalPaginas}</span>
                  {paginaActual < totalPaginas
                    ? <a href={urlPagina(paginaActual + 1)} className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>Siguiente ›</a>
                    : <span className="dbtn" style={{ fontSize: 13, opacity: 0.45, pointerEvents: 'none' }}>Siguiente ›</span>}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
