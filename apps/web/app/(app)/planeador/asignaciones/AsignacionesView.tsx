'use client';
// Vista interactiva del tablero de asignaciones: filtros en vivo (buscar, área,
// persona, rol), métricas (incluye alertas de clientes sin asesor/sin auxiliar) y
// tres formas de leer lo mismo: por persona (con barras de carga y detalle
// expandible), por área y por cliente (tabla ordenable). Todo en el cliente sobre
// las filas que entrega /plan/asignaciones (alcance ya resuelto en el backend).

import { Fragment, useMemo, useState } from 'react';
import SyncResponsablesBoton from './SyncResponsablesBoton';
import FiltroColumna from '../../administracion/FiltroColumna';

import { tinte } from '@/app/_components/color';
export type FilaAsignacion = {
  empresaId: string; empresa: string;
  areaId: string | null; area: string; areaOrden: number;
  asesorId: string | null; asesor: string | null;
  auxiliarId: string | null; auxiliar: string | null;
};

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

type Vista = 'persona' | 'area' | 'cliente';
type Rol = 'todos' | 'asesor' | 'auxiliar';
type ColKey = 'empresa' | 'area' | 'asesor' | 'auxiliar';
type ColFiltros = Record<ColKey, Set<string> | null>;
const SIN_COL: ColFiltros = { empresa: null, area: null, asesor: null, auxiliar: null };

const C_ASESOR = 'var(--info)';
const C_AUX = 'var(--cero)';
const C_ALERTA = 'var(--peligro)';

const sel: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' };

function SinChip({ texto }: { texto: string }) {
  return <span className="chip" style={{ color: C_ALERTA, borderColor: `${tinte(C_ALERTA, 35)}`, background: `${tinte(C_ALERTA, 8)}`, fontSize: 10.5, fontWeight: 700 }}>{texto}</span>;
}
function Barra({ valor, max, color }: { valor: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, transition: 'width .3s ease' }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 22, textAlign: 'right' }}>{valor || <span style={{ color: 'var(--muted)' }}>—</span>}</span>
    </div>
  );
}

export default function AsignacionesView({ filas, esCoordinacion }: { filas: FilaAsignacion[]; esCoordinacion: boolean }) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [persona, setPersona] = useState('');
  const [rol, setRol] = useState<Rol>('todos');
  const [vista, setVista] = useState<Vista>(esCoordinacion ? 'persona' : 'area');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [ordCli, setOrdCli] = useState<{ col: 'empresa' | 'area' | 'asesor' | 'auxiliar'; dir: 1 | -1 }>({ col: 'empresa', dir: 1 });
  const [ordPer, setOrdPer] = useState<{ col: 'nombre' | 'asesor' | 'auxiliar' | 'total'; dir: 1 | -1 }>({ col: 'total', dir: -1 });
  const [colFil, setColFil] = useState<ColFiltros>(SIN_COL);

  const valDe = (f: FilaAsignacion, c: ColKey): string =>
    c === 'empresa' ? f.empresa : c === 'area' ? f.area : c === 'asesor' ? (f.asesor ?? 'Sin asesor') : (f.auxiliar ?? 'Sin auxiliar');

  const areas = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; orden: number }>();
    for (const f of filas) if (f.areaId) m.set(f.areaId, { id: f.areaId, nombre: f.area, orden: f.areaOrden });
    return [...m.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
  }, [filas]);
  const personas = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of filas) { if (f.asesorId) m.set(f.asesorId, f.asesor!); if (f.auxiliarId) m.set(f.auxiliarId, f.auxiliar!); }
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [filas]);

  const nq = norm(q);
  // Base: filtros de arriba (buscar / área / persona / rol).
  const baseTop = useMemo(() => filas.filter((f) => {
    if (nq && ![f.empresa, f.area, f.asesor, f.auxiliar].some((x) => norm(x).includes(nq))) return false;
    if (area && f.areaId !== area) return false;
    if (persona) {
      const a = f.asesorId === persona, x = f.auxiliarId === persona;
      if (rol === 'asesor' ? !a : rol === 'auxiliar' ? !x : !(a || x)) return false;
    }
    return true;
  }), [filas, nq, area, persona, rol]);

  // Valores distintos por columna para el embudo (sobre la base de arriba).
  const COLS: ColKey[] = ['empresa', 'area', 'asesor', 'auxiliar'];
  const valores = useMemo(() => {
    const out = {} as Record<ColKey, string[]>;
    for (const c of COLS) out[c] = [...new Set(baseTop.map((f) => valDe(f, c)))].sort((a, b) => a.localeCompare(b, 'es'));
    return out;
  }, [baseTop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resultado final: base + filtros de embudo por columna.
  const filtradas = useMemo(
    () => baseTop.filter((f) => COLS.every((c) => { const s = colFil[c]; return s == null || s.has(valDe(f, c)); })),
    [baseTop, colFil], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const met = useMemo(() => {
    const emp = new Set<string>(), ar = new Set<string>(), ase = new Set<string>(), aux = new Set<string>();
    let sinAsesor = 0, sinAux = 0;
    for (const f of filtradas) {
      emp.add(f.empresaId); if (f.areaId) ar.add(f.areaId);
      if (f.asesorId) ase.add(f.asesorId); else sinAsesor++;
      if (f.auxiliarId) aux.add(f.auxiliarId); else sinAux++;
    }
    return { clientes: emp.size, areas: ar.size, asesores: ase.size, auxiliares: aux.size, sinAsesor, sinAux };
  }, [filtradas]);

  const porPersona = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; ase: Set<string>; aux: Set<string> }>();
    const get = (id: string, nombre: string) => { let p = m.get(id); if (!p) { p = { id, nombre, ase: new Set(), aux: new Set() }; m.set(id, p); } return p; };
    for (const f of filtradas) {
      if (f.asesorId) get(f.asesorId, f.asesor!).ase.add(f.empresaId);
      if (f.auxiliarId) get(f.auxiliarId, f.auxiliar!).aux.add(f.empresaId);
    }
    const arr = [...m.values()].map((p) => ({ id: p.id, nombre: p.nombre, asesor: p.ase.size, auxiliar: p.aux.size, total: new Set([...p.ase, ...p.aux]).size }));
    const { col, dir } = ordPer;
    arr.sort((a, b) => (col === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es') : a[col] - b[col]) * dir || a.nombre.localeCompare(b.nombre, 'es'));
    return arr;
  }, [filtradas, ordPer]);
  const maxCarga = useMemo(() => porPersona.reduce((m, p) => Math.max(m, p.asesor, p.auxiliar), 0), [porPersona]);

  const porArea = useMemo(() => {
    const m = new Map<string, { areaId: string; area: string; orden: number; filas: FilaAsignacion[] }>();
    for (const f of filtradas) {
      const k = f.areaId ?? '__sin__';
      const g = m.get(k) ?? { areaId: k, area: f.area, orden: f.areaOrden, filas: [] };
      g.filas.push(f); m.set(k, g);
    }
    const arr = [...m.values()].sort((a, b) => a.orden - b.orden || a.area.localeCompare(b.area, 'es'));
    for (const g of arr) g.filas.sort((a, b) => a.empresa.localeCompare(b.empresa, 'es'));
    return arr;
  }, [filtradas]);

  const porCliente = useMemo(() => {
    const { col, dir } = ordCli;
    return [...filtradas].sort((a, b) => (String(a[col] ?? '~').localeCompare(String(b[col] ?? '~'), 'es')) * dir || a.empresa.localeCompare(b.empresa, 'es'));
  }, [filtradas, ordCli]);

  const hayColFil = COLS.some((c) => colFil[c] != null);
  const hayFiltro = !!(q || area || persona) || hayColFil;
  const limpiar = () => { setQ(''); setArea(''); setPersona(''); setRol('todos'); setColFil(SIN_COL); };
  const setCol = (c: ColKey, s: Set<string> | null) => setColFil((p) => ({ ...p, [c]: s }));
  // Embudo estilo Excel en el encabezado de una columna (detiene el clic para no ordenar).
  const embudo = (c: ColKey) => (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      <FiltroColumna valores={valores[c]} seleccion={colFil[c]} onCambio={(s) => setCol(c, s)} buscar={c !== 'area'} />
    </span>
  );
  // Encabezado de "Por cliente": ordena al hacer clic y trae su embudo.
  const thCli = (col: ColKey, txt: string) => (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => setOrdCli({ col, dir: ordCli.col === col ? (ordCli.dir === 1 ? -1 : 1) : 1 })}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {txt}{ordCli.col === col ? <span style={{ opacity: 0.7 }}>{ordCli.dir === 1 ? ' ▲' : ' ▼'}</span> : ''}
        {embudo(col)}
      </span>
    </th>
  );
  // Encabezado de "Por área": solo etiqueta + embudo (sin orden).
  const thArea = (c: ColKey, txt: string) => (
    <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>{txt}{embudo(c)}</span></th>
  );
  const detallePersona = (id: string) => filtradas.filter((f) => f.asesorId === id || f.auxiliarId === id).sort((a, b) => a.area.localeCompare(b.area, 'es') || a.empresa.localeCompare(b.empresa, 'es'));

  const tabBtn = (v: Vista, txt: string) => (
    <button onClick={() => setVista(v)} className="dbtn" style={{ fontSize: 13, fontWeight: 700, ...(vista === v ? { background: 'var(--navy)', borderColor: 'var(--navy)', color: '#fff' } : {}) }}>{txt}</button>
  );
  const thSort = <T extends string>(actual: { col: T; dir: 1 | -1 }, set: (v: { col: T; dir: 1 | -1 }) => void, col: T, txt: string, extra?: React.CSSProperties) => (
    <th style={{ cursor: 'pointer', userSelect: 'none', ...extra }} onClick={() => set({ col, dir: actual.col === col ? (actual.dir === 1 ? -1 : 1) : 1 })}>
      {txt}{actual.col === col ? <span style={{ opacity: 0.7 }}>{actual.dir === 1 ? ' ▲' : ' ▼'}</span> : ''}
    </th>
  );

  const Tile = ({ k, v, s, color, alerta }: { k: string; v: number; s: string; color?: string; alerta?: boolean }) => (
    <div className="tile" style={alerta && v > 0 ? { borderColor: `${tinte(C_ALERTA, 40)}` } : undefined}>
      <div className="k">{k}</div>
      <div className="v" style={{ color: color ?? 'var(--navy)' }}>{v}</div>
      <div className="s">{s}</div>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{esCoordinacion ? 'Asignaciones del equipo' : 'Mis asignaciones'}</h1>
        {esCoordinacion && <SyncResponsablesBoton />}
      </div>
      <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 13 }}>
        {esCoordinacion
          ? 'Asesor y auxiliar responsables por cliente y área. Filtra, mira la carga por persona y detecta clientes sin responsable. Tras cambiar asignaciones, usa “Sincronizar responsables”.'
          : 'Las empresas que tienes asignadas, por área, como asesor o auxiliar.'}
      </p>

      {filas.length === 0 ? (
        <div className="panel" style={{ padding: 26, color: 'var(--muted)' }}>
          {esCoordinacion ? 'Aún no hay asignaciones cargadas. Ve a Administración → Plan por cliente para asignar asesor y auxiliar por área (o importar el Excel).' : 'Todavía no tienes empresas asignadas. Cuando coordinación te asigne clientes por área, aparecerán aquí.'}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 16 }}>
            <Tile k="Clientes" v={met.clientes} s="con asignación" />
            <Tile k="Áreas" v={met.areas} s="con trabajo" />
            <Tile k="Asesores" v={met.asesores} s="activos" color={C_ASESOR} />
            <Tile k="Auxiliares" v={met.auxiliares} s="activos" color={C_AUX} />
            {esCoordinacion && <Tile k="Sin asesor" v={met.sinAsesor} s="cliente·área a cubrir" color={met.sinAsesor ? C_ALERTA : 'var(--neutro)'} alerta />}
            {esCoordinacion && <Tile k="Sin auxiliar" v={met.sinAux} s="cliente·área a cubrir" color={met.sinAux ? C_ALERTA : 'var(--neutro)'} alerta />}
          </div>

          <div className="panel" style={{ padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, alignItems: 'end' }}>
              <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Buscar</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, área o persona…" style={{ ...sel, width: '100%' }} />
              </label>
              <label><span style={lbl}>Área</span>
                <select value={area} onChange={(e) => setArea(e.target.value)} style={{ ...sel, width: '100%' }}>
                  <option value="">Todas</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </label>
              <label><span style={lbl}>Persona</span>
                <select value={persona} onChange={(e) => { setPersona(e.target.value); if (!e.target.value) setRol('todos'); }} style={{ ...sel, width: '100%' }}>
                  <option value="">Todas</option>{personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              {persona && (
                <label><span style={lbl}>Rol</span>
                  <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} style={{ ...sel, width: '100%' }}>
                    <option value="todos">Cualquiera</option><option value="asesor">Como asesor</option><option value="auxiliar">Como auxiliar</option>
                  </select>
                </label>
              )}
              {hayFiltro && <button className="dbtn" onClick={limpiar} style={{ fontSize: 13, height: 38 }}>Limpiar</button>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {esCoordinacion && tabBtn('persona', 'Por persona')}
            {tabBtn('area', 'Por área')}
            {tabBtn('cliente', 'Por cliente')}
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>{filtradas.length} asignación(es){hayFiltro ? ` · de ${filas.length}` : ''}</span>
          </div>

          {vista === 'persona' && esCoordinacion && (
            <div className="panel">
              <div className="dt-wrap dt-alta">
                <table className="dt">
                  <thead><tr>
                    {thSort(ordPer, setOrdPer, 'nombre', 'Persona')}
                    {thSort(ordPer, setOrdPer, 'asesor', 'Como asesor', { minWidth: 160 })}
                    {thSort(ordPer, setOrdPer, 'auxiliar', 'Como auxiliar', { minWidth: 160 })}
                    {thSort(ordPer, setOrdPer, 'total', 'Total', { textAlign: 'right', whiteSpace: 'nowrap' })}
                  </tr></thead>
                  <tbody>
                    {porPersona.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: 22, textAlign: 'center', color: 'var(--muted)' }}>Nadie cumple los filtros.</td></tr>
                    ) : porPersona.map((p) => {
                      const abierta = expandida === p.id;
                      return (
                        <Fragment key={p.id}>
                          <tr onClick={() => setExpandida(abierta ? null : p.id)} style={{ cursor: 'pointer', background: abierta ? 'var(--panel)' : undefined }}>
                            <td style={{ fontWeight: 600 }}><span style={{ color: 'var(--muted)', marginRight: 6 }}>{abierta ? '▾' : '▸'}</span>{p.nombre}</td>
                            <td><Barra valor={p.asesor} max={maxCarga} color={C_ASESOR} /></td>
                            <td><Barra valor={p.auxiliar} max={maxCarga} color={C_AUX} /></td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{p.total}</td>
                          </tr>
                          {abierta && (
                            <tr>
                              <td colSpan={4} style={{ background: 'var(--bg, transparent)', padding: '4px 12px 12px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {detallePersona(p.id).map((f, i) => (
                                    <span key={i} className="chip" style={{ fontSize: 11, borderColor: 'var(--line)' }}>
                                      <b>{f.empresa}</b> · {f.area} · <span style={{ color: f.asesorId === p.id ? C_ASESOR : C_AUX, fontWeight: 700 }}>{f.asesorId === p.id ? 'asesor' : 'auxiliar'}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {vista === 'area' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {porArea.length === 0 ? (
                <div className="panel" style={{ padding: 22, textAlign: 'center', color: 'var(--muted)' }}>Nada cumple los filtros.</div>
              ) : porArea.map((g) => (
                <div key={g.areaId}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>{g.area}</h3>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{g.filas.length} cliente(s)</span>
                  </div>
                  <div className="panel"><div className="dt-wrap">
                    <table className="dt">
                      <thead><tr>{thArea('empresa', 'Cliente')}{thArea('asesor', 'Asesor')}{thArea('auxiliar', 'Auxiliar')}</tr></thead>
                      <tbody>
                        {g.filas.map((f) => (
                          <tr key={f.empresaId + (f.areaId ?? '')}>
                            <td style={{ fontWeight: 600 }}>{f.empresa}</td>
                            <td>{f.asesor ?? <SinChip texto="Sin asesor" />}</td>
                            <td>{f.auxiliar ?? <SinChip texto="Sin auxiliar" />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div></div>
                </div>
              ))}
            </div>
          )}

          {vista === 'cliente' && (
            <div className="panel"><div className="dt-wrap dt-alta">
              <table className="dt">
                <thead><tr>
                  {thCli('empresa', 'Cliente')}
                  {thCli('area', 'Área')}
                  {thCli('asesor', 'Asesor')}
                  {thCli('auxiliar', 'Auxiliar')}
                </tr></thead>
                <tbody>
                  {porCliente.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: 22, textAlign: 'center', color: 'var(--muted)' }}>Nada cumple los filtros.</td></tr>
                  ) : porCliente.map((f, i) => (
                    <tr key={f.empresaId + (f.areaId ?? '') + i}>
                      <td style={{ fontWeight: 600 }}>{f.empresa}</td>
                      <td style={{ color: 'var(--muted)' }}>{f.area}</td>
                      <td>{f.asesor ?? <SinChip texto="Sin asesor" />}</td>
                      <td>{f.auxiliar ?? <SinChip texto="Sin auxiliar" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          )}
        </>
      )}
    </>
  );
}
