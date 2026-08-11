'use client';
// Calendario del planeador: reúne VISITAS y VENCIMIENTOS tributarios en un solo
// mes. El Plan de Trabajo NO va en el calendario (vive en Lista · Mi día ·
// Tablero, que son operación interna). Filtro por etiqueta (Vencimientos /
// Visitas) y cliente, arrastrar una tarjeta a otro día para reprogramar su fecha,
// clic para ver el detalle e imprimir el mes. Todo contra los proxies /api.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VisitaModal from '../visitas/VisitaModal';

import { tinte } from '@/app/_components/color';
import { progresoChecklist, etiquetaProgreso, siguienteEstado, ASPECTO } from '@/lib/checklist';
// Estados de un VENCIMIENTO tributario (enum EstadoPago).
const VENC_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'var(--muted)' },
  presentado_sin_pago: { label: 'Presentado (sin pago)', color: 'var(--info)' },
  presentado_pagado: { label: 'Presentado y pagado', color: 'var(--exito)' },
  presentado_cero: { label: 'Presentado en $0', color: 'var(--cero)' },
  no_presentado: { label: 'No presentado', color: 'var(--peligro)' },
  no_obligado: { label: 'No obligado', color: 'var(--neutro)' },
};
// Estados de una VISITA (asesor/auditor al cliente).
const VISITA_META: Record<string, { label: string; color: string }> = {
  programada: { label: 'Programada', color: 'var(--info)' },
  realizada: { label: 'Realizada', color: 'var(--exito)' },
  cancelada: { label: 'Cancelada', color: 'var(--neutro)' },
};
// Color de cada etiqueta (para el punto/tag que distingue la fuente en "Todas").
const ETIQUETA_COLOR: Record<string, string> = {
  Vencimientos: '#7a5bd0',
  Visitas: 'var(--peligro)',
};

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type Evento = {
  key: string; tipo: 'vencimiento' | 'visita'; id: string; fecha: string;
  titulo: string; empresa: string | null; etiqueta: string;
  estado: string; estadoLabel: string; color: string; vencido: boolean;
  // Extras de vencimiento (para su detalle):
  municipio?: string | null; periodo?: string | null; soporteLink?: string | null; createdAt?: string | null; valorPago?: number | null;
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
  const [mostrarFinde, setMostrarFinde] = useState(true);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobreDia, setSobreDia] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Evento | null>(null);
  const [visitaId, setVisitaId] = useState<string | null>(null);
  const reqId = useRef(0);

  const cargar = useCallback(async (m: string) => {
    const mine = ++reqId.current;
    setCargando(true);
    setError(null);
    const [y, mm] = m.split('-').map(Number);
    try {
      const [rv, rvi] = await Promise.all([
        fetch(`/api/vencimientos?anio=${y}&mes=${mm}`, { cache: 'no-store' }),
        fetch(`/api/visitas?anio=${y}&mes=${mm}`, { cache: 'no-store' }),
      ]);
      const dv = await rv.json().catch(() => ({}));
      const dvi = await rvi.json().catch(() => ({}));
      if (mine !== reqId.current) return; // llegó una carga más nueva
      const evs: Evento[] = [];
      for (const v of (dv.vencimientos ?? [])) {
        const em = VENC_META[v.estado] ?? { label: v.estado, color: 'var(--muted)' };
        evs.push({
          key: `v-${v.id}`, tipo: 'vencimiento', id: v.id, fecha: (v.fechaVencimiento || '').slice(0, 10),
          titulo: v.obligacion, empresa: v.empresa ?? null, etiqueta: 'Vencimientos',
          estado: v.estado, estadoLabel: em.label, color: em.color, vencido: !!v.vencido,
          municipio: v.municipio ?? null, periodo: v.periodo ?? null, soporteLink: v.soporteLink ?? null, createdAt: v.createdAt ?? null, valorPago: v.valorPago ?? null,
        });
      }
      for (const v of (dvi.visitas ?? [])) {
        const em = VISITA_META[v.estado] ?? { label: v.estado, color: 'var(--muted)' };
        const f = (v.fecha || '').slice(0, 10);
        const objetivo = v.objetivo && String(v.objetivo).trim() ? v.objetivo : 'Visita';
        evs.push({
          key: `vi-${v.id}`, tipo: 'visita', id: v.id, fecha: f,
          titulo: v.hora ? `${objetivo} · ${v.hora}` : objetivo,
          empresa: v.empresa ?? null, etiqueta: 'Visitas',
          estado: v.estado, estadoLabel: em.label, color: em.color, vencido: false,
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
  // Toggle de fin de semana: al ocultarlo mostramos 5 columnas (Lun–Vie) quitando
  // las celdas de sábado/domingo (posiciones 5 y 6 de cada semana de 7).
  const cols = mostrarFinde ? 7 : 5;
  const celdasVis = mostrarFinde ? celdas : celdas.filter((_, i) => i % 7 < 5);

  // Reprograma la fecha de un evento (arrastrar a otro día).
  async function reprogramar(ev: Evento, nuevaFecha: string) {
    if (ev.fecha === nuevaFecha) return;
    const prev = eventos;
    setEventos((list) => list.map((e) => (e.key === ev.key ? { ...e, fecha: nuevaFecha } : e)));
    setAviso(null);
    const url = ev.tipo === 'visita'
      ? `/api/visitas/${encodeURIComponent(ev.id)}`
      : `/api/vencimientos/${encodeURIComponent(ev.id)}`;
    // La visita guarda su día en "fecha"; el vencimiento en "fechaVencimiento".
    const cuerpo = ev.tipo === 'visita' ? { fecha: nuevaFecha } : { fechaVencimiento: nuevaFecha };
    try {
      const r = await fetch(url, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
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
    const festivosImp = festivosColombia(y); // festivos de Colombia del año visible
    const filas: string[] = [];
    for (let i = 0; i < celdas.length; i += 7) {
      const semanaCeldas = mostrarFinde ? celdas.slice(i, i + 7) : celdas.slice(i, i + 5);
      const semana = semanaCeldas.map((dia) => {
        if (!dia) return '<td class="empty"></td>';
        const diaISO = `${mes}-${pad(dia)}`;
        const esFestivo = festivosImp.has(diaISO);
        const items = porDia.get(diaISO) ?? [];
        const cards = items.map((e) => `<div class="c" style="border-left:3px solid ${e.color}">${e.tipo === 'visita' ? '<i style="color:#e11900;font-weight:800;text-transform:uppercase">🤝 Visita</i>' : ''}<b>${escapar(e.titulo)}</b>${e.empresa ? `<span>${escapar(e.empresa)}</span>` : ''}${e.municipio ? `<span class="muni">📍 ${escapar(e.municipio)}</span>` : ''}${mostrarEstados ? `<i style="color:${e.color}">${escapar(e.vencido ? 'Vencido' : e.estadoLabel)}</i>` : ''}</div>`).join('');
        return `<td${esFestivo ? ' class="fest"' : ''}><div class="dn${esFestivo ? ' festdn' : ''}">${dia}${esFestivo ? ' <span class="ftag">Festivo</span>' : ''}</div>${cards}</td>`;
      }).join('');
      filas.push(`<tr>${semana}</tr>`);
    }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Calendario ${titulo}</title>
    <style>
      *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h1{font-size:18px;margin:0 0 4px;} .sub{color:#667;font-size:12px;margin:0 0 12px;}
      table{width:100%;border-collapse:collapse;table-layout:fixed;}
      th{background:#f1f3f7;font-size:10px;text-transform:uppercase;letter-spacing:.4px;padding:6px 4px;border:1px solid #d6dae2;}
      td{border:1px solid #d6dae2;vertical-align:top;height:96px;padding:4px;}
      td.empty{background:#fafbfc;} .dn{font-size:11px;font-weight:700;color:#556;margin-bottom:3px;}
      td.fest{background:#fdf1f0;} .dn.festdn{color:#cf4436;}
      .ftag{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:#cf4436;background:#f6d7d2;border-radius:8px;padding:0 4px;margin-left:4px;}
      .c{font-size:9px;padding:2px 4px;margin-bottom:3px;background:#f7f8fa;border-radius:3px;}
      .c b{display:block;} .c span{display:block;color:#667;} .c i{font-style:normal;font-size:8px;}
      .c .muni{font-weight:700;color:#334;}
      @media print{@page{size:landscape;margin:10mm;}}
    </style></head><body>
      <h1>Calendario — ${titulo}${etiquetas.length ? ` · ${etiquetas.join(', ')}` : ''}</h1>
      <div class="sub">Visitas y vencimientos tributarios · CERPAT</div>
      <table><thead><tr>${DIAS.slice(0, cols).map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table>
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
            <input type="checkbox" checked={mostrarEstados} onChange={(e) => setMostrarEstados(e.target.checked)} style={{ accentColor: 'var(--navy)' }} /> Estados
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }} title="Mostrar u ocultar las columnas de sábado y domingo">
            <input type="checkbox" checked={mostrarFinde} onChange={(e) => setMostrarFinde(e.target.checked)} style={{ accentColor: 'var(--navy)' }} /> Sáb/Dom
          </label>
          <button onClick={imprimir} className="dbtn" style={{ fontSize: 12.5 }}>🖨 Imprimir</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <MultiSelect label="Etiquetas" opciones={['Vencimientos', 'Visitas']} sel={etiquetas} onChange={setEtiquetas}
          etiquetar={(o) => (o === 'Vencimientos' ? '🧾 ' : '🤝 ') + o} color={(o) => ETIQUETA_COLOR[o]} />
        <MultiSelect label="Clientes" opciones={clientes} sel={clientesSel} onChange={setClientesSel} anchoMenu={260} />
        <select value={cumpl} onChange={(e) => setCumpl(e.target.value)} style={selStyle} title="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="vencido">Vencidos</option>
          <option value="cumplido">Cumplidos</option>
        </select>
        {hayFiltro && <button onClick={() => { setEtiquetas([]); setClientesSel([]); setCumpl(''); }} className="dbtn" style={{ fontSize: 12 }}>Limpiar</button>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: 'var(--muted)' }}>
          {(etiquetas.length ? etiquetas : ['Vencimientos', 'Visitas']).map((et) => (
            <span key={et} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: ETIQUETA_COLOR[et] ?? 'var(--neutro)' }} /> {et}
            </span>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>
          {cargando ? 'Cargando…' : `${totalMes} este mes`}
        </span>
      </div>

      {aviso && (
        <div className="panel" style={{ padding: '9px 12px', marginBottom: 10, color: 'var(--peligro-fuerte)', fontWeight: 600, fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{aviso}</span><button onClick={() => setAviso(null)} className="dbtn" style={{ fontSize: 11 }}>Cerrar</button>
        </div>
      )}

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: 'var(--peligro-fuerte)', fontWeight: 600 }}>{error}</div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden', opacity: cargando ? 0.6 : 1, transition: 'opacity .15s' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)` }}>
            {DIAS.slice(0, cols).map((d, idx) => (
              <div key={d} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: idx >= 5 ? 'var(--neutro)' : 'var(--muted)', borderBottom: '1px solid var(--line)', background: idx >= 5 ? 'rgba(91,106,130,0.12)' : 'var(--panel-2)' }}>{d}</div>
            ))}
            {celdasVis.map((dia, i) => {
              const diaISO = dia ? `${mes}-${pad(dia)}` : '';
              const items = dia ? (porDia.get(diaISO) ?? []) : [];
              const esHoy = diaISO === hoy;
              const activo = sobreDia === diaISO && arrastrando;
              const colIdx = i % cols;
              const finde = !!dia && mostrarFinde && colIdx >= 5;  // sábado/domingo (solo si se muestran)
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
                    minHeight: 104, padding: 6, borderRight: colIdx === cols - 1 ? 'none' : '1px solid var(--line)', borderBottom: '1px solid var(--line)',
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
                      <span style={{ fontSize: 11.5, fontWeight: esHoy ? 800 : 600, color: esHoy ? 'var(--green-edge)' : festivo ? 'var(--peligro)' : finde ? 'var(--neutro)' : 'var(--muted)' }}>{dia}</span>
                      {festivo && <span title="Día festivo — no se labora" style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--peligro)', background: '#cf443618', borderRadius: 10, padding: '0 5px' }}>Festivo</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', maxHeight: 200 }}>
                    {items.map((ev) => {
                      const col = ev.vencido ? 'var(--peligro)' : ev.color;
                      return (
                        <div key={ev.key} draggable
                          onDragStart={(e) => { setArrastrando(ev.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ev.key); }}
                          onDragEnd={() => { setArrastrando(null); setSobreDia(null); }}
                          onClick={() => (ev.tipo === 'visita' ? setVisitaId(ev.id) : setDetalle(ev))}
                          title={`${ev.titulo}${ev.empresa ? ' · ' + ev.empresa : ''} · ${ev.estadoLabel}`}
                          style={{ borderLeft: `3px solid ${col}`, background: `${tinte(col, 8)}`, borderRadius: 4, padding: '3px 6px', cursor: 'grab' }}>
                          {ev.tipo === 'visita' && (
                            <span style={{ display: 'inline-block', fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: '#fff', background: 'var(--peligro-solido)', borderRadius: 20, padding: '0 6px', marginBottom: 2, marginRight: 3 }}>
                              🤝 Visita
                            </span>
                          )}
                          {mostrarEstados && (
                            <span style={{ display: 'inline-block', fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: col, background: `${tinte(col, 14)}`, borderRadius: 20, padding: '0 6px', marginBottom: 2 }}>
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
                          {ev.municipio && (
                            <div style={{ fontSize: 9.5, lineHeight: 1.2, fontWeight: 700, color: col, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`Municipio: ${ev.municipio}`}>
                              📍 {ev.municipio}
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
        Cada tarjeta es una visita o un vencimiento en su fecha. Arrástrala a otro día para reprogramarla; haz clic para ver el detalle. El color de la tarjeta indica el estado (rojo = vencido).
      </p>

      {detalle && <DetalleModal ev={detalle} onClose={() => setDetalle(null)} onChanged={() => cargar(mes)} />}

      {visitaId && <VisitaModal id={visitaId} onClose={() => setVisitaId(null)} onSaved={() => cargar(mes)} />}
    </>
  );
}

// Desplegable de selección múltiple con casillas (cierra al hacer clic fuera).
function MultiSelect({ label, opciones, sel, onChange, etiquetar, color, anchoMenu }: {
  label: string; opciones: string[]; sel: string[]; onChange: (v: string[]) => void;
  etiquetar?: (o: string) => string; color?: (o: string) => string | undefined; anchoMenu?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) { setBusqueda(''); return; }
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [abierto]);
  const resumen = sel.length === 0 ? 'Todos' : sel.length === 1 ? sel[0] : `${sel.length} seleccionados`;
  const toggle = (o: string) => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]);
  // Buscador (para listas largas, p. ej. clientes): filtra por texto sin acentos.
  const conBuscador = opciones.length > 8;
  const normb = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const visibles = busqueda.trim() ? opciones.filter((o) => normb(etiquetar ? etiquetar(o) : o).includes(normb(busqueda.trim()))) : opciones;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} title={`Filtrar por ${label.toLowerCase()}`}
        style={{ ...selStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, maxWidth: 240, minWidth: 150 }}>
        <span style={{ fontWeight: 700 }}>{label}:</span>
        <span style={{ color: sel.length ? 'var(--ink)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumen}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>▾</span>
      </button>
      {abierto && (
        <div className="panel" style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, minWidth: anchoMenu ?? 190, maxHeight: 320, overflowY: 'auto', padding: 6, boxShadow: '0 8px 26px rgba(10,18,34,0.20)' }}>
          {conBuscador && (
            <input autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={`Buscar ${label.toLowerCase()}…`}
              style={{ ...selStyle, width: '100%', marginBottom: 6, position: 'sticky', top: -6, cursor: 'text' }} />
          )}
          {opciones.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 8px' }}>Sin opciones este mes</div>}
          {opciones.length > 0 && visibles.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 8px' }}>Sin resultados para “{busqueda}”</div>}
          {visibles.map((o) => {
            const activo = sel.includes(o);
            const col = color?.(o);
            return (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12.5, background: activo ? 'var(--panel-2)' : 'transparent' }}>
                <input type="checkbox" checked={activo} onChange={() => toggle(o)} style={{ accentColor: 'var(--navy)' }} />
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
  const [valor, setValor] = useState(ev.valorPago != null ? String(ev.valorPago) : '');
  const [guardandoVal, setGuardandoVal] = useState(false);
  const [valOk, setValOk] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  type Det = { subtareas: { id: string; texto: string; estado: string; orden: number }[]; asesor: { nombre: string } | null; auxiliar: { nombre: string } | null; sinPago?: boolean };
  const [det, setDet] = useState<Det | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/vencimientos/${encodeURIComponent(ev.id)}/detalle`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => { if (vivo && d.vencimiento) setDet(d.vencimiento); }).catch(() => {});
    return () => { vivo = false; };
  }, [ev.id]);

  const sinPago = det?.sinPago === true;

  // Gira el estado de una subtarea (optimista; revierte si falla).
  // pendiente → realizada → no aplica → pendiente. Ver lib/checklist.ts.
  async function toggleSub(s: { id: string; estado: string }) {
    const nuevo = siguienteEstado(s.estado);
    setDet((d) => d ? { ...d, subtareas: d.subtareas.map((x) => x.id === s.id ? { ...x, estado: nuevo } : x) } : d);
    setAviso(null);
    const r = await fetch(`/api/vencimientos/subtareas/${encodeURIComponent(s.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevo }),
    });
    if (!r.ok) {
      const dd = await r.json().catch(() => ({}));
      setAviso(dd.error || 'No se pudo marcar la subtarea.');
      setDet((d) => d ? { ...d, subtareas: d.subtareas.map((x) => x.id === s.id ? { ...x, estado: s.estado } : x) } : d);
    }
  }

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
  // Al guardar el valor se cierra el modal. Antes quedaba abierto y con el mismo
  // aspecto: no había forma de saber si había guardado, y la duda lleva a darle
  // otra vez o a irse sin estar seguro.
  //
  // El "✓ Guardado" se alcanza a ver medio segundo antes de cerrar: si la
  // ventana se desvaneciera de golpe parecería un error, no una confirmación.
  // Si falla, NO se cierra: el error queda a la vista y el valor no se pierde.
  async function guardarValor() {
    setGuardandoVal(true); setValOk(false);
    const ok = await patch({ valorPago: valor === '' ? null : Number(valor) });
    setGuardandoVal(false);
    if (!ok) return;
    setValOk(true); onChanged();
    setTimeout(() => onClose(), 500);
  }
  const fFecha = (iso?: string | null) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '—'; } };

  const em = VENC_META[estado] ?? { label: estado, color: 'var(--muted)' };
  const vencido = ev.vencido && estado === 'pendiente';
  const col = vencido ? 'var(--peligro)' : em.color;
  const ec = ETIQUETA_COLOR['Vencimientos'];
  const lbl2: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ maxWidth: 430, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: ec, background: `${tinte(ec, 12)}`, borderRadius: 20, padding: '3px 10px' }}>🧾 Vencimiento</span>
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
            style={{ fontSize: 12.5, fontWeight: 800, color: col, background: `${tinte(col, 12)}`, border: `1px solid ${tinte(col, 35)}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontFamily: 'var(--ui)' }}>
            {Object.entries(VENC_META).map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v.label}</option>)}
          </select>
          {sinPago && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Obligación de solo presentación: no lleva valor a pagar.</div>}
        </div>

        {det && (det.asesor || det.auxiliar) && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {det.asesor && <div><div style={lbl2}>Asesor</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{det.asesor.nombre}</div></div>}
            {det.auxiliar && <div><div style={lbl2}>Auxiliar</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{det.auxiliar.nombre}</div></div>}
          </div>
        )}

        {det && det.subtareas.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px' }}>
            <div style={{ ...lbl2, marginBottom: 8 }}>✔️ Checklist ({etiquetaProgreso(progresoChecklist(det.subtareas))})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {det.subtareas.map((s) => {
                const a = ASPECTO[s.estado] ?? ASPECTO.pendiente;
                return (
                  <button key={s.id} onClick={() => toggleSub(s)} title={a.titulo}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--ui)', width: '100%' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${a.borde}`, background: a.fondo, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, flexShrink: 0, fontWeight: 800 }}>{a.marca}</span>
                    <span style={{ fontSize: 12.5, color: a.color, textDecoration: a.tacha ? 'line-through' : 'none' }}>{s.texto}</span>
                  </button>
                );
              })}
            </div>
            {/* Sin esta línea nadie descubre el tercer estado: el control gira,
                no se ve que gire. */}
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 7 }}>
              Clic para cambiar: pendiente → <b>hecha</b> → <b>no aplica</b>. Lo que no aplica no cuenta para la medición.
            </div>
          </div>
        )}

        {!sinPago && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px' }}>
          <div style={{ ...lbl2, marginBottom: 6 }}>💲 Valor a pagar</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 9, fontSize: 12, color: 'var(--muted)', pointerEvents: 'none' }}>$</span>
              <input type="number" min={0} inputMode="numeric" value={valor} onChange={(e) => { setValor(e.target.value); setValOk(false); }} placeholder="0"
                style={{ ...selStyle, width: 150, paddingLeft: 20, textAlign: 'right' }} />
            </div>
            <button onClick={guardarValor} disabled={guardandoVal} className="dbtn" style={{ fontSize: 12.5 }}>{guardandoVal ? 'Guardando…' : valOk ? '✓ Guardado' : 'Guardar valor'}</button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.4 }}>Si el estado es <b>Presentado (sin pago)</b>, esta obligación aparece en <b>Pagos</b> con este valor.</p>
        </div>
        )}

        {aviso && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{aviso}</div>}

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
