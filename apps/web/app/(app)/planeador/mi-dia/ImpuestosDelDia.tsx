'use client';
// Los impuestos del asesor, dentro de Mi Día.
//
// Antes el área de Impuestos no tenía dónde trabajar: los vencimientos viven en
// una pantalla que el rol Asesor no puede abrir, y las actividades de impuestos
// no generan tarea a propósito (se controlan como vencimiento, no se duplican).
// Resultado: al asesor de impuestos no le aparecía nada.
//
// Aquí trabaja sobre el vencimiento MISMO, no sobre una copia: el chulo que
// marca, el valor que digita y el estado que pone son los de esa obligación, así
// que el calendario y Pagos quedan al día solos y no hay dos verdades.

import { Fragment, useEffect, useState } from 'react';
import PanelPlegable from '@/app/_components/PanelPlegable';

type Fila = {
  id: string; obligacion: string; periodo: string | null; fechaVencimiento: string;
  empresa: string; municipio: string | null;
  estadoRevision: string; observacionRevision: string | null; revisor: string | null;
  valorPago: number | null; checklistTotal: number; checklistHechas: number;
  liberado: boolean; liberadoEn: string | null; vencido: boolean;
};
type Resp = { total: number; listos: number; esperando: number; impuestos: Fila[] };
type Sub = { id: string; texto: string; estado: string };

const REVISION: Record<string, { label: string; color: string; fondo: string }> = {
  sin_iniciar: { label: 'Sin iniciar', color: 'var(--muted)', fondo: 'transparent' },
  en_proceso: { label: 'En proceso', color: 'var(--info-fuerte)', fondo: 'var(--info-suave)' },
  en_revision: { label: 'En revisión', color: 'var(--alerta-fuerte)', fondo: 'var(--alerta-suave)' },
  devuelto: { label: 'Devuelto', color: 'var(--peligro-fuerte)', fondo: 'var(--peligro-suave)' },
  aprobado: { label: 'Aprobado', color: 'var(--exito-fuerte)', fondo: 'var(--exito-suave)' },
};
// Los estados con los que el asesor da por presentada la obligación. 'pendiente'
// no está: se sale de pendiente presentando, no eligiéndolo de una lista.
const ESTADOS_PRESENTAR = [
  { v: 'presentado_sin_pago', label: 'Presentado sin pago' },
  { v: 'presentado_pagado', label: 'Presentado y pagado' },
  { v: 'presentado_cero', label: 'Presentado en ceros' },
  { v: 'no_obligado', label: 'No obligado' },
];

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return '—'; }
};
const pesos = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }));

export default function ImpuestosDelDia() {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function cargar() {
    try {
      const r = await fetch('/api/vencimientos/mi-dia', { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setData(d as Resp);
    } catch { /* silencioso: el panel se oculta si no hay datos */ }
    finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);

  async function abrir(f: Fila) {
    if (abierta === f.id) { setAbierta(null); return; }
    setAbierta(f.id); setSubs([]); setMsg(null);
    setValor(f.valorPago != null ? String(f.valorPago) : '');
    try {
      const r = await fetch(`/api/vencimientos/${f.id}/detalle`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setSubs(d?.vencimiento?.subtareas ?? []);
    } catch { /* el detalle es complementario; las acciones no dependen de él */ }
  }

  async function marcarSub(id: string, estado: string) {
    setSubs((s) => s.map((x) => (x.id === id ? { ...x, estado } : x))); // respuesta inmediata
    const r = await fetch(`/api/vencimientos/subtareas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'No se pudo marcar.'); await abrirDeNuevo(); }
    else await cargar();
  }
  async function abrirDeNuevo() {
    const id = abierta; if (!id) return;
    const r = await fetch(`/api/vencimientos/${id}/detalle`, { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setSubs(d?.vencimiento?.subtareas ?? []);
  }

  async function accion(id: string, acc: string) {
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch(`/api/vencimientos/${id}/revision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: acc }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo completar la acción.'); return; }
      await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  async function guardarValor(id: string) {
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch(`/api/vencimientos/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valorPago: valor === '' ? null : Number(valor) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo guardar el valor.'); return; }
      setMsg('✓ Valor guardado.'); await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  async function presentar(id: string, estado: string) {
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch(`/api/vencimientos/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, ...(valor === '' ? {} : { valorPago: Number(valor) }) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo marcar como presentado.'); return; }
      setAbierta(null); await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  // Se oculta solo si el usuario no tiene impuestos a cargo.
  if (cargando || !data || data.total === 0) return null;

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '8px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, borderBottom: '1px solid var(--line)', verticalAlign: 'middle' };
  const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--edge-strong)', borderRadius: 6, fontSize: 12.5, background: 'var(--panel)', color: 'var(--ink)' };

  return (
    <PanelPlegable
      id="impuestos-del-dia" titulo="🧾 Mis impuestos"
      nota="Se trabajan sobre la obligación misma: el calendario y Pagos se actualizan solos."
      resumen={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, background: 'var(--exito-suave)', border: '1px solid var(--exito-borde)', borderRadius: 20, padding: '4px 12px' }}>
            <b style={{ fontSize: 14, color: 'var(--exito-fuerte)' }}>{data.listos}</b>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>por liquidar</span>
          </span>
          {data.esperando > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· {data.esperando} esperando insumo</span>
          )}
        </span>
      }
    >
      {msg && <div style={{ margin: '10px 14px 0', background: 'var(--info-suave)', color: 'var(--info-fuerte)', borderRadius: 6, padding: '7px 11px', fontSize: 12.5, fontWeight: 600 }}>{msg}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>Obligación</th>
              <th style={th}>Período</th>
              <th style={th}>Vence</th>
              <th style={th}>Insumo</th>
              <th style={th}>Estado</th>
              <th style={th}>Checklist</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {data.impuestos.map((f) => {
              const rev = REVISION[f.estadoRevision] ?? REVISION.sin_iniciar;
              const activa = abierta === f.id;
              return (
                <Fragment key={f.id}>
                  <tr style={{ background: activa ? 'var(--panel-2)' : undefined }}>
                    <td style={{ ...td, fontWeight: 600 }}>{f.empresa}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{f.obligacion}{f.municipio ? ` · ${f.municipio}` : ''}</td>
                    <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{f.periodo ?? '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: f.vencido ? 'var(--peligro-fuerte)' : 'var(--muted)', fontWeight: f.vencido ? 700 : 400 }}>{fmt(f.fechaVencimiento)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {f.liberado
                        ? <span title={f.liberadoEn ? `Liberado el ${fmt(f.liberadoEn)}` : 'Sin cierre mensual del que dependa'} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--exito-fuerte)' }}>✓ listo</span>
                        : <span title="El auxiliar aún no libera el mes de este cliente" style={{ fontSize: 11.5, color: 'var(--alerta-fuerte)', fontWeight: 700 }}>⏳ esperando</span>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: rev.color, background: rev.fondo, borderRadius: 20, padding: '2px 9px' }}>{rev.label}</span>
                    </td>
                    <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)', fontSize: 12 }}>
                      {f.checklistTotal > 0 ? `${f.checklistHechas}/${f.checklistTotal}` : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button className="dbtn" onClick={() => abrir(f)} style={{ fontSize: 12, padding: '5px 10px' }}>{activa ? 'Cerrar' : 'Abrir'}</button>
                    </td>
                  </tr>

                  {activa && (
                    <tr>
                      <td colSpan={8} style={{ padding: '4px 14px 16px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line)' }}>
                        {/* Lo devuelto va primero y en rojo: es lo único que el
                            asesor necesita leer para saber qué corregir. */}
                        {f.estadoRevision === 'devuelto' && f.observacionRevision && (
                          <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 12.5, marginBottom: 12 }}>
                            <b>Devuelto{f.revisor ? ` por ${f.revisor}` : ''}:</b> {f.observacionRevision}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 260, flex: '1 1 320px' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 6 }}>Checklist</div>
                            {subs.length === 0
                              ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Esta obligación no tiene checklist configurado.</div>
                              : subs.map((s) => (
                                <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, padding: '3px 0', cursor: 'pointer' }}>
                                  <input type="checkbox" checked={s.estado === 'realizada'} onChange={(e) => marcarSub(s.id, e.target.checked ? 'realizada' : 'pendiente')} style={{ marginTop: 2 }} />
                                  <span style={{ color: s.estado === 'realizada' ? 'var(--muted)' : 'var(--ink)', textDecoration: s.estado === 'realizada' ? 'line-through' : undefined }}>{s.texto}</span>
                                </label>
                              ))}
                          </div>

                          <div style={{ minWidth: 240 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 6 }}>Valor a pagar</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="numeric" placeholder="0" style={{ ...inp, width: 140, fontFamily: 'var(--mono)' }} />
                              <button className="dbtn" disabled={trabajando} onClick={() => guardarValor(f.id)} style={{ fontSize: 12, padding: '6px 10px' }}>Guardar</button>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Actual: {pesos(f.valorPago)} · va directo a Pagos.</div>
                          </div>
                        </div>

                        {/* Acciones según el punto del circuito. Solo aparece la
                            que corresponde: menos que decidir, menos que explicar. */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                          {!f.liberado && (
                            <span style={{ fontSize: 12, color: 'var(--alerta-fuerte)', fontWeight: 600 }}>
                              El auxiliar todavía no libera el mes — podés adelantar, pero el insumo no está confirmado.
                            </span>
                          )}
                          {f.estadoRevision === 'sin_iniciar' && (
                            <button className="dbtn" disabled={trabajando} onClick={() => accion(f.id, 'iniciar')} style={{ fontSize: 13 }}>Empezar a liquidar</button>
                          )}
                          {(f.estadoRevision === 'en_proceso' || f.estadoRevision === 'devuelto') && (
                            <button className="dbtn primary" disabled={trabajando} onClick={() => accion(f.id, 'enviar')} style={{ fontSize: 13 }}>Enviar a revisión</button>
                          )}
                          {f.estadoRevision === 'en_revision' && (
                            <span style={{ fontSize: 12.5, color: 'var(--alerta-fuerte)', fontWeight: 600 }}>En manos del revisor — no lo edites mientras tanto.</span>
                          )}
                          {f.estadoRevision === 'aprobado' && (
                            <>
                              <span style={{ fontSize: 12.5, color: 'var(--exito-fuerte)', fontWeight: 700 }}>✓ Aprobado{f.revisor ? ` por ${f.revisor}` : ''} — ya podés presentar:</span>
                              {ESTADOS_PRESENTAR.map((e) => (
                                <button key={e.v} className="dbtn" disabled={trabajando} onClick={() => presentar(f.id, e.v)} style={{ fontSize: 12.5 }}>{e.label}</button>
                              ))}
                            </>
                          )}
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
    </PanelPlegable>
  );
}
