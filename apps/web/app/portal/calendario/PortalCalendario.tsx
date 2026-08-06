'use client';
// Calendario del cliente (solo lectura): sus visitas y sus vencimientos tributarios
// en la rejilla mensual. Datos aislados por NIT/grupo (GET /visitas/portal y
// GET /vencimientos/portal). Sin arrastrar ni editar.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DIAS, MESES, pad, mesActual, desplazarMes, festivosColombia } from '@/lib/calendario';

type Evento = { key: string; tipo: 'visita' | 'vencimiento'; fecha: string; titulo: string; empresa: string | null; color: string; vencido: boolean; estadoLabel: string };

const VISITA_META: Record<string, { label: string; color: string }> = {
  programada: { label: 'Programada', color: '#2f6fd0' }, realizada: { label: 'Realizada', color: '#22a670' }, cancelada: { label: 'Cancelada', color: '#9aa3b2' },
};
const VENC_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#5b6a82' }, presentado_sin_pago: { label: 'Presentado (sin pago)', color: '#2f6fd0' },
  presentado_pagado: { label: 'Presentado y pagado', color: '#22a670' }, presentado_cero: { label: 'Presentado en $0', color: '#14a8a0' },
  no_presentado: { label: 'No presentado', color: '#cf4436' }, no_obligado: { label: 'No obligado', color: '#9aa3b2' },
};

export default function PortalCalendario() {
  const [mes, setMes] = useState(mesActual());
  const [visitas, setVisitas] = useState<any[]>([]);
  const [vencs, setVencs] = useState<any[]>([]);
  const [mostrarFinde, setMostrarFinde] = useState(true);
  const [mostrarEstados, setMostrarEstados] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Las visitas del cliente se cargan una vez (son pocas) y se filtran por mes.
  useEffect(() => {
    fetch('/api/visitas/portal', { cache: 'no-store' }).then((r) => r.json()).then((d) => setVisitas(d.visitas ?? [])).catch(() => {});
  }, []);

  const cargarVencs = useCallback(async (m: string) => {
    setCargando(true); setError(null);
    const [y, mm] = m.split('-').map(Number);
    try {
      const r = await fetch(`/api/vencimientos/portal?anio=${y}&mes=${mm}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setVencs(d.vencimientos ?? []); else setError(d.error || 'No se pudo cargar el calendario.');
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);
  useEffect(() => { cargarVencs(mes); }, [mes, cargarVencs]);

  const [y, m] = mes.split('-').map(Number);

  const eventos = useMemo<Evento[]>(() => {
    const evs: Evento[] = [];
    for (const v of visitas) {
      const f = (v.fecha || '').slice(0, 10);
      if (!f.startsWith(mes)) continue;
      const em = VISITA_META[v.estado] ?? { label: v.estado, color: '#5b6a82' };
      evs.push({ key: `vi-${v.id}`, tipo: 'visita', fecha: f, titulo: v.objetivo?.trim() ? v.objetivo : 'Visita', empresa: v.empresa ?? null, color: em.color, vencido: false, estadoLabel: em.label });
    }
    for (const v of vencs) {
      const f = (v.fechaVencimiento || '').slice(0, 10);
      const em = VENC_META[v.estado] ?? { label: v.estado, color: '#5b6a82' };
      evs.push({ key: `v-${v.id}`, tipo: 'vencimiento', fecha: f, titulo: v.obligacion, empresa: v.empresa ?? null, color: em.color, vencido: !!v.vencido, estadoLabel: em.label });
    }
    return evs;
  }, [visitas, vencs, mes]);

  const porDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const e of eventos) { const arr = map.get(e.fecha) ?? []; arr.push(e); map.set(e.fecha, arr); }
    for (const arr of map.values()) arr.sort((a, b) => (a.tipo === b.tipo ? a.titulo.localeCompare(b.titulo) : a.tipo === 'visita' ? -1 : 1));
    return map;
  }, [eventos]);

  const primerDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const diasEnMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const celdas: (number | null)[] = [...Array(primerDow).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const cols = mostrarFinde ? 7 : 5;
  const celdasVis = mostrarFinde ? celdas : celdas.filter((_, i) => i % 7 < 5);
  const festivos = festivosColombia(y);
  const hoyISO = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Calendario</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMes(desplazarMes(mes, -1))} className="dbtn" style={{ fontSize: 13 }}>‹</button>
          <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>{MESES[m - 1]} {y}</span>
          <button onClick={() => setMes(desplazarMes(mes, 1))} className="dbtn" style={{ fontSize: 13 }}>›</button>
          <button onClick={() => setMes(mesActual())} className="dbtn" style={{ fontSize: 12.5 }}>Hoy</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }} title="Mostrar u ocultar el estado en cada tarjeta">
            <input type="checkbox" checked={mostrarEstados} onChange={(e) => setMostrarEstados(e.target.checked)} style={{ accentColor: '#2E5090' }} /> Estados
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={mostrarFinde} onChange={(e) => setMostrarFinde(e.target.checked)} style={{ accentColor: '#2E5090' }} /> Sáb/Dom
          </label>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>Tus visitas (🤝) y las fechas de tus obligaciones tributarias (🧾). Solo consulta.</p>

      {error && <div className="panel" style={{ padding: '10px 14px', color: '#b42318', fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: mostrarFinde ? 760 : 560 }}>
          <thead><tr>{DIAS.slice(0, cols).map((d) => <th key={d} style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', padding: '6px 4px', borderBottom: '1px solid var(--line)' }}>{d}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: Math.ceil(celdasVis.length / cols) }, (_, w) => (
              <tr key={w}>
                {celdasVis.slice(w * cols, w * cols + cols).map((dia, idx) => {
                  if (!dia) return <td key={idx} style={{ border: '1px solid var(--line)', background: 'var(--panel-2)', height: 92 }} />;
                  const diaISO = `${mes}-${pad(dia)}`;
                  const esFestivo = festivos.has(diaISO);
                  const esHoy = diaISO === hoyISO;
                  const items = porDia.get(diaISO) ?? [];
                  return (
                    <td key={idx} style={{ border: '1px solid var(--line)', verticalAlign: 'top', height: 92, padding: 4, background: esFestivo ? 'rgba(207,68,54,0.06)' : undefined }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: esFestivo ? '#cf4436' : 'var(--muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ ...(esHoy ? { background: '#2E5090', color: '#fff', borderRadius: 10, padding: '0 6px' } : {}) }}>{dia}</span>
                        {esFestivo && <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', color: '#cf4436' }}>Festivo</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {items.map((e) => (
                          <div key={e.key} title={`${e.titulo}${e.empresa ? ' · ' + e.empresa : ''} · ${e.vencido ? 'Vencido' : e.estadoLabel}`}
                            style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: 'var(--panel-2)', borderLeft: `3px solid ${e.vencido ? '#cf4436' : e.color}` }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ marginRight: 3 }}>{e.tipo === 'visita' ? '🤝' : '🧾'}</span>{e.titulo}</div>
                            {mostrarEstados && <div style={{ fontSize: 9, fontWeight: 700, color: e.vencido ? '#cf4436' : e.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.vencido ? 'Vencido' : e.estadoLabel}</div>}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 11.5, color: 'var(--muted)' }}>
        <span>🤝 Visita</span><span>🧾 Vencimiento</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#cf4436' }} /> Vencido</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(207,68,54,0.15)' }} /> Festivo</span>
        {cargando && <span>· Cargando…</span>}
      </div>
    </>
  );
}
