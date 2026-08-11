'use client';
// Cola compartida de revisión de impuestos.
//
// No hay asignación fija por cliente ni por mes: los dos revisores ven lo mismo
// y toman por orden de llegada, que es como trabajan hoy. Quién revisó qué queda
// en el rastro de todos modos, así que los indicadores por revisor no dependen
// de repartir la cola.

import { Fragment, useEffect, useState } from 'react';
import { etiquetaDeConteos } from '@/lib/checklist';

type Fila = {
  id: string; obligacion: string; periodo: string | null; fechaVencimiento: string;
  empresa: string; municipio: string | null; asesor: string | null;
  valorPago: number | null; enviadoRevisionEn: string | null;
  checklistTotal: number; checklistHechas: number; checklistAplicables: number; vencido: boolean; propio: boolean;
};
type Sub = { id: string; texto: string; estado: string };

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return '—'; }
};
const pesos = (n: number | null) => (n == null ? 'sin valor' : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }));
function espera(iso: string | null): string {
  if (!iso) return '—';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return 'recién';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

export default function ColaRevision() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function cargar() {
    try {
      const r = await fetch('/api/vencimientos/revision/cola', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { setError(d?.error ?? `La API respondió ${r.status}`); return; }
      setFilas(d.impuestos ?? []); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red'); }
    finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);

  async function abrir(f: Fila) {
    if (abierta === f.id) { setAbierta(null); return; }
    setAbierta(f.id); setSubs([]); setObs(''); setMsg(null);
    try {
      const r = await fetch(`/api/vencimientos/${f.id}/detalle`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setSubs(d?.vencimiento?.subtareas ?? []);
    } catch { /* el checklist es de apoyo; las acciones no dependen de él */ }
  }

  async function accion(id: string, acc: 'aprobar' | 'devolver') {
    if (acc === 'devolver' && !obs.trim()) { setMsg('Escribe qué hay que corregir antes de devolverlo.'); return; }
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch(`/api/vencimientos/${id}/revision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: acc, observaciones: obs.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo completar la acción.'); return; }
      setAbierta(null); setObs(''); await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  if (cargando) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando la cola…</div>;
  if (error) return <div style={{ color: 'var(--peligro-fuerte)', fontWeight: 600 }}>No se pudo cargar la cola: {error}.</div>;
  if (filas.length === 0) {
    return (
      <div className="panel" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>No hay nada esperando revisión</div>
        <div style={{ fontSize: 13 }}>Cuando un asesor envíe un impuesto, aparece aquí — el más antiguo primero.</div>
      </div>
    );
  }

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '9px 11px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 11px', fontSize: 13, borderBottom: '1px solid var(--line)', verticalAlign: 'middle' };

  return (
    <div className="panel" style={{ overflow: 'hidden' }}>
      {msg && <div style={{ margin: 12, background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{msg}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr>
              <th style={th}>Esperando</th>
              <th style={th}>Cliente</th>
              <th style={th}>Obligación</th>
              <th style={th}>Período</th>
              <th style={th}>Asesor</th>
              <th style={th}>Valor</th>
              <th style={th}>Vence</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const activa = abierta === f.id;
              return (
                <Fragment key={f.id}>
                  <tr style={{ background: activa ? 'var(--panel-2)' : undefined }}>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12 }}>{espera(f.enviadoRevisionEn)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{f.empresa}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{f.obligacion}{f.municipio ? ` · ${f.municipio}` : ''}</td>
                    <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{f.periodo ?? '—'}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{f.asesor ?? '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontFamily: 'var(--mono)', fontSize: 12.5, color: f.valorPago == null ? 'var(--alerta-fuerte)' : 'var(--ink)' }}>{pesos(f.valorPago)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: f.vencido ? 'var(--peligro-fuerte)' : 'var(--muted)', fontWeight: f.vencido ? 700 : 400 }}>{fmt(f.fechaVencimiento)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button className="dbtn" onClick={() => abrir(f)} style={{ fontSize: 12, padding: '5px 10px' }}>{activa ? 'Cerrar' : 'Revisar'}</button>
                    </td>
                  </tr>

                  {activa && (
                    <tr>
                      <td colSpan={8} style={{ padding: '6px 14px 16px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line)' }}>
                        {/* Nadie aprueba su propio trabajo: si el revisor es
                            además el asesor de este cliente, el backend lo
                            rechaza — se dice acá para no hacerlo descubrir con
                            un error. */}
                        {f.propio && (
                          <div style={{ background: 'var(--alerta-suave)', color: 'var(--alerta-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
                            Este impuesto es tuyo como asesor. Tiene que revisarlo otra persona.
                          </div>
                        )}

                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 6 }}>
                          Checklist del asesor {f.checklistTotal > 0 && <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>({etiquetaDeConteos(f.checklistHechas, f.checklistAplicables, f.checklistTotal)})</span>}
                        </div>
                        {subs.length === 0
                          ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>Esta obligación no tiene checklist configurado.</div>
                          : (
                            <div style={{ marginBottom: 12 }}>
                              {subs.map((s) => (
                                <div key={s.id} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '2px 0' }}>
                                  <span style={{ color: s.estado === 'realizada' ? 'var(--exito-fuerte)' : s.estado === 'no_aplica' ? 'var(--neutro)' : 'var(--alerta-fuerte)', fontWeight: 700 }}>
                                    {s.estado === 'realizada' ? '✓' : s.estado === 'no_aplica' ? '–' : '○'}
                                  </span>
                                  <span style={{ color: 'var(--muted)' }}>{s.texto}</span>
                                  {/* Lo marcado "no aplica" se señala: validar
                                      que de verdad no aplicaba es parte de lo
                                      que el revisor tiene que mirar. */}
                                  {s.estado === 'no_aplica' && <span style={{ fontSize: 10.5, color: 'var(--neutro)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>no aplica</span>}
                                </div>
                              ))}
                            </div>
                          )}

                        <label style={{ display: 'block', marginBottom: 10 }}>
                          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 }}>Observación</span>
                          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
                            placeholder="Qué hay que corregir. Obligatorio para devolver."
                            style={{ width: '100%', maxWidth: 620, padding: '8px 10px', border: '1px solid var(--edge-strong)', borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--ui)', background: 'var(--panel)', color: 'var(--ink)', resize: 'vertical' }} />
                        </label>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="dbtn success" disabled={trabajando || f.propio} onClick={() => accion(f.id, 'aprobar')} style={{ fontSize: 13 }}>
                            {trabajando ? '…' : '✓ Aprobar'}
                          </button>
                          <button className="dbtn" disabled={trabajando || f.propio} onClick={() => accion(f.id, 'devolver')} style={{ fontSize: 13 }}>
                            ↩ Devolver al asesor
                          </button>
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
  );
}
