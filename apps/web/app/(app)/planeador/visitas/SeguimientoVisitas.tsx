'use client';
// Seguimiento de visitas (Fase 3): tablero de cumplimiento + matriz de todos los
// compromisos, filtrable por cliente, asesor, dirección, área y estado (embudos
// como en Excel) y exportable a Excel. La fila es el compromiso.

import { useCallback, useEffect, useMemo, useState } from 'react';
import FiltroColumna from '@/app/_components/FiltroColumna';
import { descargarXlsx, hoyISO } from '../../administracion/exportar';

import { tinte } from '@/app/_components/color';
type Comp = {
  id: string; descripcion: string; estado: string; fechaLimite: string | null; area: string | null;
  responsableTipo: 'firma' | 'cliente'; responsable: string; empresa: string | null;
  visitaFecha: string; objetivo: string | null; asesor: string | null;
};

const HOY = hoyISO();
// Estado efectivo del compromiso (pendiente vencido = 'vencido').
function estadoEf(c: Comp): 'cumplido' | 'cancelado' | 'vencido' | 'pendiente' {
  if (c.estado === 'cumplido') return 'cumplido';
  if (c.estado === 'cancelado') return 'cancelado';
  if (c.fechaLimite && c.fechaLimite < HOY) return 'vencido';
  return 'pendiente';
}
const EST_META: Record<string, { label: string; color: string }> = {
  cumplido: { label: 'Cumplido', color: 'var(--exito)' },
  pendiente: { label: 'Pendiente', color: 'var(--alerta)' },
  vencido: { label: 'Vencido', color: 'var(--peligro)' },
  cancelado: { label: 'Cancelado', color: 'var(--neutro)' },
};
const dirLabel = (c: Comp) => (c.responsableTipo === 'cliente' ? 'Del cliente' : 'De la firma');
function fFecha(iso: string | null) { if (!iso) return '—'; try { return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return iso; } }

const COLS = ['cliente', 'asesor', 'responsable', 'direccion', 'area', 'estado'] as const;
type Col = (typeof COLS)[number];
const sinFiltros = (): Record<Col, Set<string> | null> => ({ cliente: null, asesor: null, responsable: null, direccion: null, area: null, estado: null });
function valorDe(c: Comp, col: Col): string {
  switch (col) {
    case 'cliente': return c.empresa ?? '(sin cliente)';
    case 'asesor': return c.asesor ?? '(sin asesor)';
    case 'responsable': return c.responsable;
    case 'direccion': return dirLabel(c);
    case 'area': return c.area ?? '(sin área)';
    case 'estado': return EST_META[estadoEf(c)].label;
  }
}

function Barras({ datos, sufijo = '' }: { datos: { k: string; v: number; pct: number }[]; sufijo?: string }) {
  if (datos.length === 0) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sin datos.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {datos.map((d) => (
        <div key={d.k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 48px', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.k}>{d.k}</span>
          <span style={{ background: 'var(--panel-2)', borderRadius: 6, height: 15, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <span style={{ display: 'block', height: '100%', width: `${d.pct}%`, background: 'linear-gradient(90deg,#2fa36b,#2E5090)', borderRadius: 6 }} />
          </span>
          <b style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{d.v}{sufijo}</b>
        </div>
      ))}
    </div>
  );
}

export default function SeguimientoVisitas() {
  const [anio, setAnio] = useState<number | 'todos'>(new Date().getFullYear());
  const [comps, setComps] = useState<Comp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Record<Col, Set<string> | null>>(sinFiltros);

  const cargar = useCallback(async (a: number | 'todos') => {
    setCargando(true); setError(null);
    try {
      const qs = a === 'todos' ? '' : `?anio=${a}`;
      const r = await fetch(`/api/visitas/compromisos${qs}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setComps(d.compromisos ?? []); else setError(d.error || 'No se pudo cargar el seguimiento.');
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(anio); }, [anio, cargar]);
  useEffect(() => { setFiltros(sinFiltros()); }, [anio]);

  const valores = useMemo(() => {
    const out = {} as Record<Col, string[]>;
    for (const c of COLS) out[c] = [...new Set(comps.map((x) => valorDe(x, c)))].sort((a, b) => a.localeCompare(b, 'es'));
    return out;
  }, [comps]);

  const filtrados = useMemo(
    () => comps.filter((c) => COLS.every((col) => { const s = filtros[col]; return s == null || s.has(valorDe(c, col)); })),
    [comps, filtros],
  );
  const hayFiltro = COLS.some((c) => filtros[c] != null);

  // KPIs y agregados (sobre lo filtrado, para que el tablero refleje los filtros).
  const kpis = useMemo(() => {
    let cumplido = 0, pendiente = 0, vencido = 0, cancelado = 0;
    for (const c of filtrados) { const e = estadoEf(c); if (e === 'cumplido') cumplido++; else if (e === 'vencido') vencido++; else if (e === 'cancelado') cancelado++; else pendiente++; }
    const base = filtrados.length - cancelado;
    return { total: filtrados.length, cumplido, pendiente, vencido, cancelado, pct: base ? Math.round((cumplido / base) * 100) : 0 };
  }, [filtrados]);

  const porAsesor = useMemo(() => {
    const m = new Map<string, { cumplido: number; base: number }>();
    for (const c of filtrados) { const e = estadoEf(c); if (e === 'cancelado') continue; const k = c.asesor ?? '(sin asesor)'; const o = m.get(k) ?? { cumplido: 0, base: 0 }; o.base++; if (e === 'cumplido') o.cumplido++; m.set(k, o); }
    return [...m.entries()].map(([k, o]) => ({ k, v: Math.round((o.cumplido / o.base) * 100), pct: Math.round((o.cumplido / o.base) * 100) })).sort((a, b) => b.v - a.v).slice(0, 8);
  }, [filtrados]);

  const porArea = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filtrados) { const k = c.area ?? '(sin área)'; m.set(k, (m.get(k) ?? 0) + 1); }
    const arr = [...m.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
    const max = Math.max(1, ...arr.map((x) => x.v));
    return arr.map((x) => ({ ...x, pct: Math.round((x.v / max) * 100) }));
  }, [filtrados]);

  const porClienteAbiertos = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filtrados) { const e = estadoEf(c); if (e === 'pendiente' || e === 'vencido') { const k = c.empresa ?? '(sin cliente)'; m.set(k, (m.get(k) ?? 0) + 1); } }
    const arr = [...m.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
    const max = Math.max(1, ...arr.map((x) => x.v));
    return arr.map((x) => ({ ...x, pct: Math.round((x.v / max) * 100) }));
  }, [filtrados]);

  function exportar() {
    const filas: (string | number)[][] = [['Cliente', 'Fecha visita', 'Compromiso', 'Responsable', 'Dirección', 'Área', 'Vence', 'Estado']];
    for (const c of filtrados) filas.push([c.empresa ?? '', c.visitaFecha, c.descripcion, c.responsable, dirLabel(c), c.area ?? '', c.fechaLimite ?? '', EST_META[estadoEf(c)].label]);
    descargarXlsx(`seguimiento-visitas-${hoyISO()}.xlsx`, [{ nombre: 'Compromisos', filas }]);
  }

  const th = (c: Col, texto: string, buscar = false, estilo?: React.CSSProperties) => (
    <th style={estilo}><span style={{ display: 'inline-flex', alignItems: 'center' }}>{texto}
      <FiltroColumna valores={valores[c]} seleccion={filtros[c]} onCambio={(s) => setFiltros((f) => ({ ...f, [c]: s }))} buscar={buscar} /></span></th>
  );
  const anios = [new Date().getFullYear(), new Date().getFullYear() - 1];
  const tile = (k: string, v: number | string, s: string, color?: string): React.ReactNode => (
    <div className="panel" style={{ padding: '13px 15px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--muted)' }}>{k}</div>
      <div style={{ fontSize: 26, fontWeight: 800, margin: '3px 0 1px', color, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s}</div>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 700 }}>Período:</span>
        <select value={String(anio)} onChange={(e) => setAnio(e.target.value === 'todos' ? 'todos' : Number(e.target.value))} style={{ padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5 }}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          <option value="todos">Todos los años</option>
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{filtrados.length}{hayFiltro ? ` de ${comps.length}` : ''} compromiso(s)</span>
        {hayFiltro && <button className="dbtn" onClick={() => setFiltros(sinFiltros())} style={{ fontSize: 12 }}>Limpiar filtros</button>}
        <button className="dbtn" onClick={exportar} style={{ fontSize: 12.5 }}>⭳ Exportar Excel</button>
      </div>

      {error && <div className="panel" style={{ padding: '12px 14px', color: 'var(--peligro-fuerte)', fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
        {tile('Compromisos', kpis.total, 'en el período')}
        {tile('Cumplimiento', `${kpis.pct}%`, `${kpis.cumplido} cumplidos`, 'var(--exito)')}
        {tile('Pendientes', kpis.pendiente, 'por vencer', 'var(--alerta)')}
        {tile('Vencidos', kpis.vencido, 'requieren gestión', kpis.vencido ? 'var(--peligro)' : undefined)}
      </div>

      {/* Tablero */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginBottom: 14 }}>
        <div className="panel" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 10 }}>Cumplimiento por asesor</div>
          <Barras datos={porAsesor} sufijo="%" />
        </div>
        <div className="panel" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 10 }}>Compromisos por área</div>
          <Barras datos={porArea} />
        </div>
        <div className="panel" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 10 }}>Clientes con compromisos abiertos</div>
          <Barras datos={porClienteAbiertos} />
        </div>
      </div>

      {/* Matriz */}
      <div className="panel">
        <div className="dt-wrap dt-alta">
          <table className="dt">
            <thead><tr>
              {th('cliente', 'Cliente', true)}
              <th style={{ width: 70 }}>Visita</th>
              <th>Compromiso</th>
              {th('responsable', 'Responsable', true)}
              {th('direccion', 'Dirección', false, { width: 110 })}
              {th('area', 'Área', true, { width: 120 })}
              <th style={{ width: 70 }}>Vence</th>
              {th('estado', 'Estado', false, { width: 110 })}
            </tr></thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
              ) : comps.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Aún no hay compromisos registrados.</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Ninguno cumple los filtros.</td></tr>
              ) : filtrados.map((c) => {
                const em = EST_META[estadoEf(c)];
                const esCli = c.responsableTipo === 'cliente';
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.empresa ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fFecha(c.visitaFecha)}</td>
                    <td>{c.descripcion}</td>
                    <td style={{ color: 'var(--muted)' }}>{c.responsable}</td>
                    <td><span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: esCli ? '#7a5bd0' : 'var(--navy)', background: esCli ? '#efeafb' : 'var(--info-suave)', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{esCli ? 'Cliente' : 'Firma'}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{c.area ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fFecha(c.fechaLimite)}</td>
                    <td><span style={{ fontSize: 11, fontWeight: 800, color: em.color, background: `${tinte(em.color, 12)}`, borderRadius: 20, padding: '2px 9px' }}>{em.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 2px 0' }}>Cada fila es un compromiso de un acta. “Vencido” = pendiente cuya fecha límite ya pasó. Usa los embudos (▼) para filtrar por cliente, asesor, dirección, área o estado.</p>
    </>
  );
}
