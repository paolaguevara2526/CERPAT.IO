'use client';
// Captura del día (F1.3 — "Mi día del auxiliar"). Muestra todas las tareas de
// "Captura de documentos" del usuario (todos sus clientes del período) y permite
// registrar lotes en línea, sin entrar cliente por cliente al calendario.

import { Fragment, useEffect, useState } from 'react';

const TIPOS_DOC = ['Egresos', 'Facturas de compra', 'Facturas de venta', 'Documento equivalente', 'Notas contables', 'Nómina', 'Ingresos'];

const ESTADOS: Record<string, { label: string; color: string }> = {
  por_iniciar: { label: 'Por iniciar', color: 'var(--muted)' },
  en_curso: { label: 'En curso', color: 'var(--info)' },
  en_revision: { label: 'En revisión', color: 'var(--alerta)' },
  terminado: { label: 'Terminado', color: 'var(--exito)' },
  auditado: { label: 'Auditado', color: 'var(--green-edge)' },
  no_realizado: { label: 'No realizado', color: 'var(--peligro)' },
};
// Estados que el ejecutor puede fijar desde aquí (auditado lo pone Auditoría).
const ESTADOS_EDIT = ['por_iniciar', 'en_curso', 'en_revision', 'terminado', 'no_realizado'];

type Fila = {
  id: string; estado: string; empresa: string; area: string | null;
  totalLotes: number; lotesHoy: number; ultimaFecha: string | null;
};
type Resp = { periodo: string | null; hoy: string | null; total: number; capturadosHoy: number; tareas: Fila[] };
type NuevoLote = { tipoDocumento: string; desde: string; hasta: string; cantidad: string; fecha: string };

const hoyISO = () => new Date().toISOString().slice(0, 10);
const loteVacio = (): NuevoLote => ({ tipoDocumento: '', desde: '', hasta: '', cantidad: '', fecha: hoyISO() });

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return '—'; }
}

export default function CapturaDelDia() {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null); // tareaId con el formulario abierto
  const [nl, setNl] = useState<NuevoLote>(loteVacio());
  const [msg, setMsg] = useState<{ id: string; texto: string; ok: boolean } | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      const r = await fetch('/api/planeador/gestion/mi-dia/captura', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { setError(d?.error ?? `La API respondió ${r.status}`); return; }
      setData(d as Resp); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);

  function abrir(id: string) {
    if (abierto === id) { setAbierto(null); return; }
    setAbierto(id); setNl(loteVacio()); setMsg(null);
  }

  async function agregarLote(id: string) {
    if (!nl.tipoDocumento.trim()) { setMsg({ id, texto: 'Indica el tipo de documento.', ok: false }); return; }
    setGuardando(true);
    try {
      const r = await fetch(`/api/planeador/gestion/tareas/${id}/lotes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nl),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ id, texto: d?.error ?? 'No se pudo registrar el lote.', ok: false }); return; }
      setMsg({ id, texto: `✓ ${nl.tipoDocumento} registrado.`, ok: true });
      setNl((p) => ({ ...loteVacio(), fecha: p.fecha })); // limpia campos, conserva la fecha para seguir capturando
      await cargar();
    } finally { setGuardando(false); }
  }

  async function cambiarEstado(id: string, estado: string) {
    try {
      const r = await fetch('/api/planeador/tarea-estado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estado }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ id, texto: d?.error ?? 'No se pudo cambiar el estado.', ok: false }); return; }
      await cargar();
    } catch { setMsg({ id, texto: 'Error de red al cambiar el estado.', ok: false }); }
  }

  if (cargando) return null; // silencioso mientras carga
  if (error) return <div className="panel" style={{ padding: 16, color: 'var(--peligro-fuerte)', fontWeight: 600 }}>No se pudo cargar la captura: {error}.</div>;
  // Sin captura asignada (p. ej. un asesor): se oculta para no meter ruido.
  if (!data || data.total === 0) return null;

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
  const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5, background: 'var(--card, #fff)', color: 'inherit' };

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>📥 Captura del día</h2>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip n={data.total} label="clientes por capturar" />
          <Chip n={data.capturadosHoy} label="con captura hoy" tono="#22a670" />
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={{ ...th, textAlign: 'center' }}>Hoy</th>
              <th style={{ ...th, textAlign: 'center' }}>Lotes</th>
              <th style={th}>Última</th>
              <th style={th}>Estado</th>
              <th style={{ ...th, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {data.tareas.map((t) => {
              const abiertaAqui = abierto === t.id;
              const em = ESTADOS[t.estado] ?? { label: t.estado, color: 'var(--muted)' };
              return (
                <Fragment key={t.id}>
                  <tr style={abiertaAqui ? { background: 'var(--hover, #f6f8fb)' } : undefined}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {t.empresa}
                      {t.area && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6, fontSize: 11.5 }}>· {t.area}</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {t.lotesHoy > 0
                        ? <span style={{ fontWeight: 800, color: 'var(--exito)' }}>{t.lotesHoy}</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>{t.totalLotes}</td>
                    <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtFecha(t.ultimaFecha)}</td>
                    <td style={td}>
                      <select
                        value={ESTADOS_EDIT.includes(t.estado) ? t.estado : ''}
                        onChange={(e) => cambiarEstado(t.id, e.target.value)}
                        style={{ ...inp, fontWeight: 700, color: em.color, cursor: 'pointer' }}
                      >
                        {!ESTADOS_EDIT.includes(t.estado) && <option value="">{em.label}</option>}
                        {ESTADOS_EDIT.map((e) => <option key={e} value={e}>{ESTADOS[e].label}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => abrir(t.id)} className="dbtn" style={{ fontSize: 12, fontWeight: 700 }}>
                        {abiertaAqui ? 'Cerrar' : '＋ Registrar lote'}
                      </button>
                    </td>
                  </tr>
                  {abiertaAqui && (
                    <tr>
                      <td colSpan={6} style={{ padding: '4px 10px 14px', background: 'var(--hover, #f6f8fb)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <Campo label="Tipo de documento" w={200}>
                            <input list="tipos-doc-midia" value={nl.tipoDocumento} onChange={(e) => setNl({ ...nl, tipoDocumento: e.target.value })} placeholder="Egresos, Facturas…" style={{ ...inp, width: '100%' }} />
                          </Campo>
                          <Campo label="Desde" w={110}><input value={nl.desde} onChange={(e) => setNl({ ...nl, desde: e.target.value })} placeholder="consec." style={{ ...inp, width: '100%' }} /></Campo>
                          <Campo label="Hasta" w={110}><input value={nl.hasta} onChange={(e) => setNl({ ...nl, hasta: e.target.value })} placeholder="consec." style={{ ...inp, width: '100%' }} /></Campo>
                          <Campo label="Cantidad" w={90}><input type="number" min={0} value={nl.cantidad} onChange={(e) => setNl({ ...nl, cantidad: e.target.value })} style={{ ...inp, width: '100%' }} /></Campo>
                          <Campo label="Fecha" w={140}><input type="date" value={nl.fecha} onChange={(e) => setNl({ ...nl, fecha: e.target.value })} style={{ ...inp, width: '100%' }} /></Campo>
                          <button onClick={() => agregarLote(t.id)} disabled={guardando} className="dbtn primary" style={{ fontSize: 12.5, fontWeight: 700, opacity: guardando ? 0.6 : 1 }}>＋ Agregar</button>
                        </div>
                        {msg && msg.id === t.id && (
                          <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: msg.ok ? 'var(--green-edge)' : 'var(--peligro-fuerte)' }}>{msg.texto}</div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <datalist id="tipos-doc-midia">{TIPOS_DOC.map((x) => <option key={x} value={x} />)}</datalist>
      </div>
    </div>
  );
}

function Chip({ n, label, tono }: { n: number; label: string; tono?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, background: 'var(--hover, #f2f5f9)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px' }}>
      <b style={{ fontSize: 14, color: tono ?? 'inherit' }}>{n}</b>
      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{label}</span>
    </span>
  );
}

function Campo({ label, w, children }: { label: string; w: number; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, width: w, maxWidth: '100%' }}>
      <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--muted)', fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}
