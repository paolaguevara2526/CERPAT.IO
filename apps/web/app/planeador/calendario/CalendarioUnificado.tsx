'use client';
// Calendario unificado del planeador: fusiona TAREAS del plan de trabajo y
// VENCIMIENTOS tributarios en un solo mes. Filtro por etiqueta (Vencimientos /
// áreas del plan), arrastrar una tarjeta a otro día para reprogramar su fecha,
// clic para ver el detalle e imprimir el mes. Todo contra los proxies /api.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TareaDetalleModal from './TareaDetalleModal';

const AREAS = ['Impuestos', 'Informes', 'Cumplimiento', 'Nómina', 'Tesorería'];

// Estados de una TAREA del plan.
const TAREA_META: Record<string, { label: string; color: string }> = {
  por_iniciar: { label: 'Por iniciar', color: '#5b6a82' },
  en_curso: { label: 'En curso', color: '#2f6fd0' },
  en_revision: { label: 'En revisión', color: '#c67c00' },
  terminado: { label: 'Terminado', color: '#22a670' },
  auditado: { label: 'Auditado', color: '#1c8a5e' },
  no_realizado: { label: 'No realizado', color: '#cf4436' },
};
// Estados de un VENCIMIENTO tributario (enum EstadoPago).
const VENC_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#5b6a82' },
  presentado_sin_pago: { label: 'Presentado (sin pago)', color: '#2f6fd0' },
  presentado_pagado: { label: 'Presentado y pagado', color: '#22a670' },
  presentado_cero: { label: 'Presentado en $0', color: '#14a8a0' },
  no_presentado: { label: 'No presentado', color: '#cf4436' },
  no_obligado: { label: 'No obligado', color: '#9aa3b2' },
};
// Color de cada etiqueta (para el punto/tag que distingue la fuente en "Todas").
const ETIQUETA_COLOR: Record<string, string> = {
  Vencimientos: '#7a5bd0',
  Impuestos: '#2f6fd0',
  Informes: '#c67c00',
  Cumplimiento: '#1c8a5e',
  Nómina: '#cf4436',
  Tesorería: '#0d8f8f',
};

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type Evento = {
  key: string; tipo: 'vencimiento' | 'tarea'; id: string; fecha: string;
  titulo: string; empresa: string | null; etiqueta: string;
  estado: string; estadoLabel: string; color: string; vencido: boolean;
  // Extras de vencimiento (para su detalle):
  municipio?: string | null; periodo?: string | null; soporteLink?: string | null; createdAt?: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
function mesValido(v?: string): string {
  if (v && /^\d{4}-\d{2}$/.test(v)) return v;
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`;
}
function desplazarMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
function mesActual(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`;
}
function hoyISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// ---- Festivos de Colombia (calculados: fijos + Ley Emiliani + Pascua) ----
function isoUTC(d: Date): string { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
function pascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mes - 1, dia));
}
// Traslada al lunes siguiente (Ley Emiliani); si ya es lunes, se queda.
function proximoLunes(d: Date): Date {
  const r = new Date(d), dow = r.getUTCDay();
  r.setUTCDate(r.getUTCDate() + (dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow));
  return r;
}
function festivosColombia(y: number): Set<string> {
  const s = new Set<string>();
  const fijo = (mo: number, da: number) => s.add(`${y}-${pad(mo)}-${pad(da)}`);
  const emiliani = (mo: number, da: number) => s.add(isoUTC(proximoLunes(new Date(Date.UTC(y, mo - 1, da)))));
  fijo(1, 1); fijo(5, 1); fijo(7, 20); fijo(8, 7); fijo(12, 8); fijo(12, 25);
  emiliani(1, 6); emiliani(3, 19); emiliani(6, 29); emiliani(8, 15); emiliani(10, 12); emiliani(11, 1); emiliani(11, 11);
  const p = pascua(y);
  const rel = (off: number) => { const d = new Date(p); d.setUTCDate(d.getUTCDate() + off); return isoUTC(d); };
  s.add(rel(-3)); s.add(rel(-2)); // Jueves y Viernes Santo
  s.add(rel(43)); s.add(rel(64)); s.add(rel(71)); // Ascensión, Corpus Christi, Sagrado Corazón (ya caen en lunes)
  return s;
}

export default function CalendarioUnificado({ mesInicial }: { mesInicial?: string }) {
  const [mes, setMes] = useState(() => mesValido(mesInicial));
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [cumpl, setCumpl] = useState('');
  const [mostrarEstados, setMostrarEstados] = useState(true);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobreDia, setSobreDia] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Evento | null>(null);
  const reqId = useRef(0);

  const cargar = useCallback(async (m: string) => {
    const mine = ++reqId.current;
    setCargando(true);
    setError(null);
    const [y, mm] = m.split('-').map(Number);
    const ultimoDia = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    try {
      const [rv, rt] = await Promise.all([
        fetch(`/api/vencimientos?anio=${y}&mes=${mm}`, { cache: 'no-store' }),
        // Tareas cuya fecha de vencimiento cae en el mes visible (no por período).
        fetch(`/api/planeador/gestion/tareas?venceDesde=${m}-01&venceHasta=${m}-${pad(ultimoDia)}`, { cache: 'no-store' }),
      ]);
      const dv = await rv.json().catch(() => ({}));
      const dt = await rt.json().catch(() => ({}));
      if (mine !== reqId.current) return; // llegó una carga más nueva
      const evs: Evento[] = [];
      for (const v of (dv.vencimientos ?? [])) {
        const em = VENC_META[v.estado] ?? { label: v.estado, color: '#5b6a82' };
        evs.push({
          key: `v-${v.id}`, tipo: 'vencimiento', id: v.id, fecha: (v.fechaVencimiento || '').slice(0, 10),
          titulo: v.obligacion, empresa: v.empresa ?? null, etiqueta: 'Vencimientos',
          estado: v.estado, estadoLabel: em.label, color: em.color, vencido: !!v.vencido,
          municipio: v.municipio ?? null, periodo: v.periodo ?? null, soporteLink: v.soporteLink ?? null, createdAt: v.createdAt ?? null,
        });
      }
      const hoy = hoyISO();
      for (const t of (dt.tareas ?? [])) {
        const em = TAREA_META[t.estado] ?? { label: t.estado, color: '#5b6a82' };
        const f = (t.fechaVencimiento || '').slice(0, 10);
        const pend = ['por_iniciar', 'en_curso', 'en_revision'].includes(t.estado);
        evs.push({
          key: `t-${t.id}`, tipo: 'tarea', id: t.id, fecha: f,
          titulo: t.titulo, empresa: t.empresa ?? null, etiqueta: t.area || 'Sin área',
          estado: t.estado, estadoLabel: em.label, color: em.color, vencido: pend && f < hoy,
        });
      }
      setEventos(evs);
    } catch {
      if (mine === reqId.current) setError('No se pudo cargar el calendario.');
    } finally {
      if (mine === reqId.current) setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(mes); }, [mes, cargar]);

  // Clientes presentes en el mes (para el filtro), sin repetir.
  const clientes = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventos) if (e.empresa) set.add(e.empresa);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [eventos]);

  const visibles = useMemo(
    () => eventos.filter((e) =>
      (etiquetas.length === 0 || etiquetas.includes(e.etiqueta)) &&
      (clientesSel.length === 0 || (e.empresa != null && clientesSel.includes(e.empresa))) &&
      (!cumpl || clasificar(e) === cumpl),
    ),
    [eventos, etiquetas, clientesSel, cumpl],
  );
  const hayFiltro = etiquetas.length > 0 || clientesSel.length > 0 || !!cumpl;
  const porDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const e of visibles) {
      if (!e.fecha.startsWith(mes)) continue;
      const arr = map.get(e.fecha);
      if (arr) arr.push(e); else map.set(e.fecha, [e]);
    }
    // vencimientos primero, luego por título
    for (const arr of map.values()) arr.sort((a, b) => (a.tipo === b.tipo ? a.titulo.localeCompare(b.titulo) : a.tipo === 'vencimiento' ? -1 : 1));
    return map;
  }, [visibles, mes]);

  const [y, m] = mes.split('-').map(Number);
  const primerDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const diasEnMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const celdas: (number | null)[] = [...Array(primerDow).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const hoy = hoyISO();

  // Reprograma la fecha de un evento (arrastrar a otro día).
  async function reprogramar(ev: Evento, nuevaFecha: string) {
    if (ev.fecha === nuevaFecha) return;
    const prev = eventos;
    setEventos((list) => list.map((e) => (e.key === ev.key ? { ...e, fecha: nuevaFecha } : e)));
    setAviso(null);
    const url = ev.tipo === 'vencimiento'
      ? `/api/vencimientos/${encodeURIComponent(ev.id)}`
      : `/api/planeador/gestion/tareas/${encodeURIComponent(ev.id)}`;
    try {
      const r = await fetch(url, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaVencimiento: nuevaFecha }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setEventos(prev);
        setAviso(d.error || 'No se pudo reprogramar.');
      }
    } catch {
      setEventos(prev);
      setAviso('Error de red al reprogramar.');
    }
  }

  function imprimir() {
    const w = window.open('', '_blank');
    if (!w) return;
    const titulo = `${MESES[m - 1]} ${y}`;
    const filas: string[] = [];
    for (let i = 0; i < celdas.length; i += 7) {
      const semana = celdas.slice(i, i + 7).map((dia) => {
        if (!dia) return '<td class="empty"></td>';
        const items = porDia.get(`${mes}-${pad(dia)}`) ?? [];
        const cards = items.map((e) => `<div class="c" style="border-left:3px solid ${e.color}"><b>${escapar(e.titulo)}</b>${e.empresa ? `<span>${escapar(e.empresa)}</span>` : ''}${mostrarEstados ? `<i style="color:${e.color}">${escapar(e.vencido ? 'Vencido' : e.estadoLabel)}</i>` : ''}</div>`).join('');
        return `<td><div class="dn">${dia}</div>${cards}</td>`;
      }).join('');
      filas.push(`<tr>${semana}</tr>`);
    }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Calendario ${titulo}</title>
    <style>
      *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;}
      h1{font-size:18px;margin:0 0 4px;} .sub{color:#667;font-size:12px;margin:0 0 12px;}
      table{width:100%;border-collapse:collapse;table-layout:fixed;}
      th{background:#f1f3f7;font-size:10px;text-transform:uppercase;letter-spacing:.4px;padding:6px 4px;border:1px solid #d6dae2;}
      td{border:1px solid #d6dae2;vertical-align:top;height:96px;padding:4px;}
      td.empty{background:#fafbfc;} .dn{font-size:11px;font-weight:700;color:#556;margin-bottom:3px;}
      .c{font-size:9px;padding:2px 4px;margin-bottom:3px;background:#f7f8fa;border-radius:3px;}
      .c b{display:block;} .c span{display:block;color:#667;} .c i{font-style:normal;font-size:8px;}
      @media print{@page{size:landscape;margin:10mm;}}
    </style></head><body>
      <h1>Calendario — ${titulo}${etiquetas.length ? ` · ${etiquetas.join(', ')}` : ''}</h1>
      <div class="sub">Plan de trabajo y vencimientos tributarios · CERPAT</div>
      <table><thead><tr>${DIAS.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const festivos = festivosColombia(y);
  const totalMes = [...porDia.values()].reduce((n, a) => n + a.length, 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Calendario</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMes(desplazarMes(mes, -1))} className="dbtn" style={{ fontSize: 13 }}>‹</button>
          <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>{MESES[m - 1]} {y}</span>
          <button onClick={() => setMes(desplazarMes(mes, 1))} className="dbtn" style={{ fontSize: 13 }}>›</button>
          <button onClick={() => setMes(mesActual())} className="dbtn" style={{ fontSize: 12.5 }}>Hoy</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }} title="Mostrar u ocultar los estados en las tarjetas">
            <input type="checkbox" checked={mostrarEstados} onChange={(e) => setMostrarEstados(e.target.checked)} style={{ accentColor: '#2E5090' }} /> Estados
          </label>
          <button onClick={imprimir} className="dbtn" style={{ fontSize: 12.5 }}>🖨 Imprimir</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <MultiSelect label="Etiquetas" opciones={['Vencimientos', ...AREAS]} sel={etiquetas} onChange={setEtiquetas}
          etiquetar={(o) => (o === 'Vencimientos' ? '🧾 ' : '📋 ') + o} color={(o) => ETIQUETA_COLOR[o]} />
        <MultiSelect label="Clientes" opciones={clientes} sel={clientesSel} onChange={setClientesSel} anchoMenu={260} />
        <select value={cumpl} onChange={(e) => setCumpl(e.target.value)} style={selStyle} title="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="vencido">Vencidos</option>
          <option value="cumplido">Cumplidos</option>
        </select>
        {hayFiltro && <button onClick={() => { setEtiquetas([]); setClientesSel([]); setCumpl(''); }} className="dbtn" style={{ fontSize: 12 }}>Limpiar</button>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: 'var(--muted)' }}>
          {(etiquetas.length ? etiquetas : ['Vencimientos', ...AREAS]).map((et) => (
            <span key={et} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: ETIQUETA_COLOR[et] ?? '#9aa3b2' }} /> {et}
            </span>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>
          {cargando ? 'Cargando…' : `${totalMes} este mes`}
        </span>
      </div>

      {aviso && (
        <div className="panel" style={{ padding: '9px 12px', marginBottom: 10, color: '#b42318', fontWeight: 600, fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{aviso}</span><button onClick={() => setAviso(null)} className="dbtn" style={{ fontSize: 11 }}>Cerrar</button>
        </div>
      )}

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>{error}</div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden', opacity: cargando ? 0.6 : 1, transition: 'opacity .15s' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {DIAS.map((d, idx) => (
              <div key={d} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: idx >= 5 ? '#8a94a6' : 'var(--muted)', borderBottom: '1px solid var(--line)', background: idx >= 5 ? 'rgba(91,106,130,0.12)' : 'var(--panel-2)' }}>{d}</div>
            ))}
            {celdas.map((dia, i) => {
              const diaISO = dia ? `${mes}-${pad(dia)}` : '';
              const items = dia ? (porDia.get(diaISO) ?? []) : [];
              const esHoy = diaISO === hoy;
              const activo = sobreDia === diaISO && arrastrando;
              const finde = !!dia && (i % 7) >= 5;            // sábado/domingo
              const festivo = !!dia && festivos.has(diaISO);  // festivo de Colombia
              return (
                <div key={i}
                  onDragOver={(e) => { if (arrastrando && dia) { e.preventDefault(); setSobreDia(diaISO); } }}
                  onDragLeave={() => { if (sobreDia === diaISO) setSobreDia(null); }}
                  onDrop={(e) => {
                    e.preventDefault(); setSobreDia(null);
                    const key = e.dataTransfer.getData('text/plain') || arrastrando;
                    const ev = eventos.find((x) => x.key === key);
                    setArrastrando(null);
                    if (ev && dia) reprogramar(ev, diaISO);
                  }}
                  style={{
                    minHeight: 104, padding: 6, borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--line)', borderBottom: '1px solid var(--line)',
                    background: !dia ? 'var(--panel-2)'
                      : activo ? 'rgba(46,80,144,0.10)'
                      : esHoy ? 'rgba(52,201,139,0.10)'
                      : festivo ? 'rgba(207,68,54,0.16)'
                      : finde ? 'rgba(91,106,130,0.16)'
                      : 'var(--panel)',
                    outline: activo ? '2px dashed var(--brand, #2E5090)' : 'none', outlineOffset: -2,
                    display: 'flex', flexDirection: 'column', gap: 3,
                  }}>
                  {dia && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: esHoy ? 800 : 600, color: esHoy ? '#1c8a5e' : festivo ? '#cf4436' : finde ? '#8a94a6' : 'var(--muted)' }}>{dia}</span>
                      {festivo && <span title="Día festivo — no se labora" style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: '#cf4436', background: '#cf443618', borderRadius: 10, padding: '0 5px' }}>Festivo</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', maxHeight: 200 }}>
                    {items.map((ev) => {
                      const col = ev.vencido ? '#cf4436' : ev.color;
                      return (
                        <div key={ev.key} draggable
                          onDragStart={(e) => { setArrastrando(ev.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ev.key); }}
                          onDragEnd={() => { setArrastrando(null); setSobreDia(null); }}
                          onClick={() => setDetalle(ev)}
                          title={`${ev.titulo}${ev.empresa ? ' · ' + ev.empresa : ''} · ${ev.estadoLabel}`}
                          style={{ borderLeft: `3px solid ${col}`, background: `${col}12`, borderRadius: 4, padding: '3px 6px', cursor: 'grab' }}>
                          {mostrarEstados && (
                            <span style={{ display: 'inline-block', fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: col, background: `${col}22`, borderRadius: 20, padding: '0 6px', marginBottom: 2 }}>
                              {ev.vencido ? 'Vencido' : ev.estadoLabel}
                            </span>
                          )}
                          <div style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.2, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.titulo}
                          </div>
                          {ev.empresa && (
                            <div style={{ fontSize: 9.5, lineHeight: 1.2, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ev.empresa}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', margin: '10px 2px 0', fontSize: 11, color: 'var(--muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(52,201,139,0.25)', border: '1px solid #34C98B' }} /> Hoy</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(91,106,130,0.16)' }} /> Sáb/Dom (no se labora)</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(207,68,54,0.15)' }} /> Festivo (no se labora)</span>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '6px 2px 0' }}>
        Cada tarjeta es una tarea o un vencimiento en su fecha. Arrástrala a otro día para reprogramarla; haz clic para ver el detalle. El color de la tarjeta indica el estado (rojo = vencido).
      </p>

      {detalle && (detalle.tipo === 'tarea'
        ? <TareaDetalleModal id={detalle.id} onClose={() => setDetalle(null)} onChanged={() => cargar(mes)} />
        : <DetalleModal ev={detalle} onClose={() => setDetalle(null)} onChanged={() => cargar(mes)} />
      )}
    </>
  );
}

// Desplegable de selección múltiple con casillas (cierra al hacer clic fuera).
function MultiSelect({ label, opciones, sel, onChange, etiquetar, color, anchoMenu }: {
  label: string; opciones: string[]; sel: string[]; onChange: (v: string[]) => void;
  etiquetar?: (o: string) => string; color?: (o: string) => string | undefined; anchoMenu?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [abierto]);
  const resumen = sel.length === 0 ? 'Todos' : sel.length === 1 ? sel[0] : `${sel.length} seleccionados`;
  const toggle = (o: string) => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} title={`Filtrar por ${label.toLowerCase()}`}
        style={{ ...selStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, maxWidth: 240, minWidth: 150 }}>
        <span style={{ fontWeight: 700 }}>{label}:</span>
        <span style={{ color: sel.length ? 'var(--ink)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumen}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>▾</span>
      </button>
      {abierto && (
        <div className="panel" style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, minWidth: anchoMenu ?? 190, maxHeight: 300, overflowY: 'auto', padding: 6, boxShadow: '0 8px 26px rgba(10,18,34,0.20)' }}>
          {opciones.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 8px' }}>Sin opciones este mes</div>}
          {opciones.map((o) => {
            const activo = sel.includes(o);
            const col = color?.(o);
            return (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12.5, background: activo ? 'var(--panel-2)' : 'transparent' }}>
                <input type="checkbox" checked={activo} onChange={() => toggle(o)} style={{ accentColor: '#2E5090' }} />
                {col && <span style={{ width: 9, height: 9, borderRadius: 3, background: col, flex: '0 0 auto' }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etiquetar ? etiquetar(o) : o}</span>
              </label>
            );
          })}
          {sel.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="dbtn" style={{ fontSize: 11.5, width: '100%', marginTop: 4 }}>Quitar selección</button>
          )}
        </div>
      )}
    </div>
  );
}

function DetalleModal({ ev, onClose, onChanged }: { ev: Evento; onClose: () => void; onChanged: () => void }) {
  const [estado, setEstado] = useState(ev.estado);
  const [fecha, setFecha] = useState(ev.fecha);
  const [link, setLink] = useState(ev.soporteLink ?? '');
  const [guardandoLink, setGuardandoLink] = useState(false);
  const [linkOk, setLinkOk] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setAviso(null);
    const r = await fetch(`/api/vencimientos/${encodeURIComponent(ev.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setAviso(d.error || 'No se pudo guardar.'); return false; }
    return true;
  }
  async function cambiarEstado(nuevo: string) {
    const prev = estado; setEstado(nuevo);
    if (await patch({ estado: nuevo })) onChanged(); else setEstado(prev);
  }
  async function reprogramar(f: string) {
    if (!f) return; const prev = fecha; setFecha(f);
    if (await patch({ fechaVencimiento: f })) onChanged(); else setFecha(prev);
  }
  async function guardarLink() {
    setGuardandoLink(true); setLinkOk(false);
    if (await patch({ soporteLink: link })) { setLinkOk(true); onChanged(); setTimeout(() => setLinkOk(false), 2000); }
    setGuardandoLink(false);
  }
  const fFecha = (iso?: string | null) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '—'; } };

  const em = VENC_META[estado] ?? { label: estado, color: '#5b6a82' };
  const vencido = ev.vencido && estado === 'pendiente';
  const col = vencido ? '#cf4436' : em.color;
  const ec = ETIQUETA_COLOR['Vencimientos'];
  const lbl2: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ maxWidth: 430, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: ec, background: `${ec}18`, borderRadius: 20, padding: '3px 10px' }}>🧾 Vencimiento</span>
          <button onClick={onClose} className="dbtn" style={{ fontSize: 12 }}>✕</button>
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 3px' }}>{ev.titulo}</h3>
          {ev.empresa && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{ev.empresa}</div>}
          {(ev.municipio || ev.periodo) && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{[ev.municipio, ev.periodo].filter(Boolean).join(' · ')}</div>}
        </div>

        <div>
          <div style={{ ...lbl2, marginBottom: 4 }}>Estado</div>
          <select value={estado} onChange={(e) => cambiarEstado(e.target.value)}
            style={{ fontSize: 12.5, fontWeight: 800, color: col, background: `${col}18`, border: `1px solid ${col}55`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontFamily: 'var(--ui)' }}>
            {Object.entries(VENC_META).map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v.label}</option>)}
          </select>
        </div>

        {aviso && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{aviso}</div>}

        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div style={lbl2}>Creación</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{fFecha(ev.createdAt)}</div></div>
          <div><div style={{ ...lbl2, marginBottom: 3 }}>Vencimiento</div>
            <input type="date" value={fecha} onChange={(e) => reprogramar(e.target.value)} style={{ ...selStyle, width: '100%' }} />
          </div>
        </div>

        <div style={{ border: '1px solid color-mix(in srgb, var(--brand, #2E5090) 40%, var(--line))', borderRadius: 8, padding: '11px 13px' }}>
          <div style={{ ...lbl2, marginBottom: 6 }}>🔗 Soporte documental</div>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.4 }}>Pega el link (Drive / OneDrive) donde va quedando el trabajo de esta obligación.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={link} onChange={(e) => { setLink(e.target.value); setLinkOk(false); }} placeholder="https://drive.google.com/… o link de OneDrive" style={{ ...selStyle, flex: 1, minWidth: 200 }} />
            <button onClick={guardarLink} disabled={guardandoLink} className="dbtn primary" style={{ fontSize: 12.5 }}>{guardandoLink ? 'Guardando…' : linkOk ? '✓ Guardado' : 'Guardar'}</button>
          </div>
          {ev.soporteLink && <a href={ev.soporteLink} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--brand, #2E5090)', wordBreak: 'break-all' }}>↗ Abrir soporte actual</a>}
        </div>

        <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>Los cambios se guardan contra el vencimiento (requiere Administrador).</p>
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

// Cumplimiento unificado de un evento (para el filtro por estado).
function clasificar(e: Evento): 'vencido' | 'pendiente' | 'cumplido' | 'otro' {
  if (e.vencido) return 'vencido';
  if (e.tipo === 'vencimiento') {
    if (['presentado_sin_pago', 'presentado_pagado', 'presentado_cero'].includes(e.estado)) return 'cumplido';
    if (e.estado === 'no_presentado') return 'vencido';
    if (e.estado === 'no_obligado') return 'otro';
    return 'pendiente';
  }
  if (['terminado', 'auditado'].includes(e.estado)) return 'cumplido';
  if (e.estado === 'no_realizado') return 'vencido';
  return 'pendiente';
}

function escapar(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
