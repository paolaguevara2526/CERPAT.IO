'use client';
// Captura del día (F1.3 — "Mi día del auxiliar"). Muestra todas las tareas de
// "Captura de documentos" del usuario (todos sus clientes del período) y permite
// registrar lotes en línea, sin entrar cliente por cliente al calendario.

import { Fragment, useEffect, useState } from 'react';
import { contarConsecutivos } from '../consecutivos';
import PanelPlegable from '@/app/_components/PanelPlegable';

// Los tipos vienen del catálogo (Administración → Tipos de documento). Estaban
// escritos acá: agregar uno exigía un despliegue, y como el campo era de texto
// libre entraban "Egresos", "egresos" y "Egreso" como cosas distintas.

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
  /** 'ejecuta' = le toca capturar · 'observa' = es de su auxiliar, solo mira. */
  rol: 'ejecuta' | 'observa';
  auxiliar: string | null;
};
type Resp = { periodo: string | null; hoy: string | null; total: number; totalObservadas: number; capturadosHoy: number; tareas: Fila[] };
type NuevoLote = { tipoDocumento: string; prefijo: string; desde: string; hasta: string; cantidad: string; fecha: string };
type Lote = { id: string; tipoDocumento: string; prefijo: string | null; desde: string | null; hasta: string | null; cantidad: number | null; fecha: string };

// El día de HOY según el reloj de quien captura, no según UTC. Con
// toISOString() el formulario proponía el día siguiente a partir de las 7 p. m.
// en Colombia, porque a esa hora en UTC ya es mañana.
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const loteVacio = (): NuevoLote => ({ tipoDocumento: '', prefijo: '', desde: '', hasta: '', cantidad: '', fecha: hoyISO() });

// La fecha del lote es un DÍA DEL CALENDARIO y se guarda a medianoche UTC, así
// que se muestra en UTC. Sin el timeZone, el navegador la pasaba a la hora local
// (Colombia, UTC−5): medianoche del 11 son las 7 p. m. del 10, y lo capturado
// hoy aparecía con la fecha de ayer.
function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' }); } catch { return '—'; }
}
// "2026-08-11" para el <input type="date"> al editar: la misma fecha guardada,
// sin pasar por la zona horaria.
const isoDeFecha = (iso: string) => (iso ?? '').slice(0, 10);

export default function CapturaDelDia({ puedeBorrar = false }: { puedeBorrar?: boolean }) {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null); // tareaId con el formulario abierto
  const [tipos, setTipos] = useState<string[]>([]);
  // tareaId cuyos lotes se están viendo, y los lotes cargados.
  const [viendo, setViendo] = useState<string | null>(null);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [cargandoLotes, setCargandoLotes] = useState(false);
  // Lote que se está corrigiendo (solo uno a la vez).
  const [edit, setEdit] = useState<(NuevoLote & { id: string }) | null>(null);
  const [nl, setNl] = useState<NuevoLote>(loteVacio());
  // La cantidad se calcula del rango, pero se puede corregir: hay lotes con
  // consecutivos anulados en medio, y ahí el conteo real no es el del rango.
  // Si el auxiliar la escribe, manda lo que escribió; si vacía el campo, el
  // cálculo vuelve a tomar el control.
  const [cantidadManual, setCantidadManual] = useState(false);
  const setDesde = (v: string) => setNl((p) => ({ ...p, desde: v, cantidad: cantidadManual ? p.cantidad : contarConsecutivos(v, p.hasta) }));
  const setHasta = (v: string) => setNl((p) => ({ ...p, hasta: v, cantidad: cantidadManual ? p.cantidad : contarConsecutivos(p.desde, v) }));
  const setCantidad = (v: string) => {
    setCantidadManual(v.trim() !== '');
    setNl((p) => ({ ...p, cantidad: v.trim() === '' ? contarConsecutivos(p.desde, p.hasta) : v }));
  };
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
  useEffect(() => {
    fetch('/api/admin/catalogos/tipos-documento', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setTipos((d.items ?? []).map((x: { nombre: string }) => x.nombre)))
      .catch(() => {});
  }, []);

  // Ver los lotes ya registrados de una tarea. El conteo decía "4" y no había
  // forma de saber cuáles: para corregir un error había que adivinar.
  async function verLotes(id: string) {
    if (viendo === id) { setViendo(null); setLotes([]); return; }
    setViendo(id); setLotes([]); setCargandoLotes(true);
    try {
      const r = await fetch(`/api/planeador/gestion/tareas/${id}/lotes`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setLotes(d.lotes ?? []);
    } catch { /* el detalle es complementario */ }
    finally { setCargandoLotes(false); }
  }

  // Corregir un lote ya registrado: el consecutivo mal escrito o la fecha
  // equivocada se arreglan donde se ven, sin borrar y volver a capturar.
  async function guardarEdicion(tareaId: string) {
    if (!edit) return;
    if (!edit.tipoDocumento.trim()) { setMsg({ id: tareaId, texto: 'Indica el tipo de documento.', ok: false }); return; }
    setGuardando(true);
    try {
      const r = await fetch(`/api/planeador/gestion/lotes/${edit.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoDocumento: edit.tipoDocumento, prefijo: edit.prefijo,
          desde: edit.desde, hasta: edit.hasta, cantidad: edit.cantidad, fecha: edit.fecha,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ id: tareaId, texto: d?.error ?? 'No se pudo guardar el cambio.', ok: false }); return; }
      setLotes((l) => l.map((x) => (x.id === edit.id ? d.lote : x)));
      setEdit(null);
      setMsg({ id: tareaId, texto: '✓ Lote corregido.', ok: true });
      await cargar();
    } finally { setGuardando(false); }
  }

  async function borrarLote(loteId: string, tareaId: string) {
    if (!confirm('¿Eliminar este lote? No se puede deshacer.')) return;
    const r = await fetch(`/api/planeador/gestion/lotes/${loteId}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg({ id: tareaId, texto: d.error ?? 'No se pudo eliminar.', ok: false }); return; }
    setLotes((l) => l.filter((x) => x.id !== loteId));
    await cargar();
  }

  function abrir(id: string) {
    if (abierto === id) { setAbierto(null); return; }
    setAbierto(id); setNl(loteVacio()); setCantidadManual(false); setMsg(null);
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
      setCantidadManual(false);
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
  // Sin nada que capturar NI que vigilar: se oculta para no meter ruido.
  if (!data || (data.total === 0 && data.totalObservadas === 0)) return null;
  const mias = data.tareas.filter((t) => t.rol === 'ejecuta');
  const deAuxiliares = data.tareas.filter((t) => t.rol === 'observa');

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
  const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5, background: 'var(--card, #fff)', color: 'inherit' };

  return (
    <>
    {mias.length > 0 && (
    <PanelPlegable
      id="captura-del-dia" titulo="📥 Captura del día"
      resumen={<>
        <Chip n={data.total} label="clientes por capturar" />
        <Chip n={data.capturadosHoy} label="con captura hoy" tono="#22a670" />
      </>}
    >

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
            {mias.map((t) => {
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
                    <td style={{ ...td, textAlign: 'center' }}>
                      {t.totalLotes > 0 ? (
                        <button onClick={() => verLotes(t.id)} title="Ver los lotes registrados"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--navy)', fontWeight: 700, textDecoration: 'underline' }}>
                          {t.totalLotes}
                        </button>
                      ) : <span style={{ color: 'var(--muted)' }}>0</span>}
                    </td>
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
                  {viendo === t.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: '4px 12px 14px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', margin: '8px 0 6px' }}>
                          Lotes registrados
                        </div>
                        {cargandoLotes ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Cargando…</div>
                          : lotes.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Sin lotes.</div>
                          : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                              <thead>
                                <tr>{['Fecha', 'Tipo de documento', 'Prefijo', 'Desde', 'Hasta', 'Cantidad', ''].map((h, i) => (
                                  <th key={h + i} style={{ textAlign: i >= 3 && i <= 5 ? 'right' : 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '5px 8px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                                ))}</tr>
                              </thead>
                              <tbody>
                                {lotes.map((l) => {
                                  const celda = { padding: '5px 8px', borderBottom: '1px solid var(--line)' } as React.CSSProperties;
                                  const editando = edit?.id === l.id;
                                  if (editando) {
                                    const ie = { ...inp, width: '100%', padding: '3px 5px', fontSize: 12 } as React.CSSProperties;
                                    return (
                                      <tr key={l.id} style={{ background: 'var(--hover, #f6f8fb)' }}>
                                        <td style={celda}><input type="date" value={edit.fecha} onChange={(e) => setEdit({ ...edit, fecha: e.target.value })} style={ie} /></td>
                                        <td style={celda}>
                                          <select value={edit.tipoDocumento} onChange={(e) => setEdit({ ...edit, tipoDocumento: e.target.value })} style={ie}>
                                            {/* El tipo guardado se ofrece aunque ya no esté en el catálogo: si no,
                                                corregir el consecutivo obligaría a cambiar también el tipo. */}
                                            {!tipos.includes(edit.tipoDocumento) && edit.tipoDocumento && <option value={edit.tipoDocumento}>{edit.tipoDocumento}</option>}
                                            {tipos.map((x) => <option key={x} value={x}>{x}</option>)}
                                          </select>
                                        </td>
                                        <td style={celda}><input value={edit.prefijo} onChange={(e) => setEdit({ ...edit, prefijo: e.target.value })} placeholder="FE, CE…" style={{ ...ie, fontFamily: 'var(--mono)' }} /></td>
                                        <td style={celda}><input value={edit.desde} onChange={(e) => setEdit({ ...edit, desde: e.target.value, cantidad: contarConsecutivos(e.target.value, edit.hasta) })} style={{ ...ie, fontFamily: 'var(--mono)', textAlign: 'right' }} /></td>
                                        <td style={celda}><input value={edit.hasta} onChange={(e) => setEdit({ ...edit, hasta: e.target.value, cantidad: contarConsecutivos(edit.desde, e.target.value) })} style={{ ...ie, fontFamily: 'var(--mono)', textAlign: 'right' }} /></td>
                                        <td style={celda}><input value={edit.cantidad} onChange={(e) => setEdit({ ...edit, cantidad: e.target.value })} style={{ ...ie, fontFamily: 'var(--mono)', textAlign: 'right' }} /></td>
                                        <td style={{ ...celda, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                          <button className="dbtn primary" disabled={guardando} onClick={() => guardarEdicion(t.id)} style={{ fontSize: 11.5, padding: '3px 9px' }}>Guardar</button>{' '}
                                          <button className="dbtn" disabled={guardando} onClick={() => setEdit(null)} style={{ fontSize: 11.5, padding: '3px 9px' }}>Cancelar</button>
                                        </td>
                                      </tr>
                                    );
                                  }
                                  return (
                                    <tr key={l.id}>
                                      <td style={{ ...celda, whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fmtFecha(l.fecha)}</td>
                                      <td style={{ ...celda, fontWeight: 600 }}>{l.tipoDocumento}</td>
                                      <td style={{ ...celda, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{l.prefijo ?? '—'}</td>
                                      <td style={{ ...celda, textAlign: 'right', fontFamily: 'var(--mono)' }}>{l.desde ?? '—'}</td>
                                      <td style={{ ...celda, textAlign: 'right', fontFamily: 'var(--mono)' }}>{l.hasta ?? '—'}</td>
                                      <td style={{ ...celda, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{l.cantidad ?? '—'}</td>
                                      <td style={{ ...celda, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {/* Corregir lo propio no necesita permiso especial: quien registra el
                                            lote es quien ve el error. Borrar sigue siendo de coordinación. */}
                                        <button onClick={() => setEdit({
                                          id: l.id, tipoDocumento: l.tipoDocumento, prefijo: l.prefijo ?? '',
                                          desde: l.desde ?? '', hasta: l.hasta ?? '',
                                          cantidad: l.cantidad != null ? String(l.cantidad) : '', fecha: isoDeFecha(l.fecha),
                                        })} title="Corregir este lote"
                                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--brand, #2E5090)', fontSize: 13 }}>✏️</button>
                                        {puedeBorrar && (
                                          <button onClick={() => borrarLote(l.id, t.id)} title="Eliminar este lote"
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--peligro)', fontSize: 14 }}>🗑</button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                      </td>
                    </tr>
                  )}
                  {abiertaAqui && (
                    <tr>
                      <td colSpan={6} style={{ padding: '4px 10px 14px', background: 'var(--hover, #f6f8fb)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <Campo label="Tipo de documento" w={200}>
                            <select value={nl.tipoDocumento} onChange={(e) => setNl({ ...nl, tipoDocumento: e.target.value })} style={{ ...inp, width: '100%' }}>
                              <option value="">— Elegir —</option>
                              {tipos.map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                          </Campo>
                          <Campo label="Prefijo" w={90}>
                            <input value={nl.prefijo} onChange={(e) => setNl({ ...nl, prefijo: e.target.value })} placeholder="FE, CE…"
                              title="Prefijo del consecutivo. Va aparte para que Desde/Hasta queden numéricos y la cantidad se siga calculando sola."
                              style={{ ...inp, width: '100%' }} />
                          </Campo>
                          <Campo label="Desde" w={110}><input value={nl.desde} onChange={(e) => setDesde(e.target.value)} placeholder="consec." style={{ ...inp, width: '100%' }} /></Campo>
                          <Campo label="Hasta" w={110}><input value={nl.hasta} onChange={(e) => setHasta(e.target.value)} placeholder="consec." style={{ ...inp, width: '100%' }} /></Campo>
                          <Campo label={cantidadManual ? 'Cantidad ·  a mano' : 'Cantidad · auto'} w={110}>
                            <input type="number" min={0} value={nl.cantidad} onChange={(e) => setCantidad(e.target.value)}
                              title={cantidadManual
                                ? 'Lo estás escribiendo tú. Borra el campo para que vuelva a calcularse del rango.'
                                : 'Se calcula del rango, contando los dos extremos: de 100 a 105 son 6 documentos.'}
                              style={{ ...inp, width: '100%', ...(cantidadManual ? {} : { color: 'var(--muted)' }) }} /></Campo>
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
      </div>
    </PanelPlegable>
    )}

    {deAuxiliares.length > 0 && <CapturaDeAuxiliares filas={deAuxiliares} />}
    </>
  );
}

// Lo que capturan los auxiliares del asesor: solo lectura.
//
// El asesor no captura, pero necesita ver cómo va: de que la captura quede
// terminada depende que se le libere el insumo y pueda arrancar. Antes esta
// misma información le llegaba con botón de "Registrar lote" y selector de
// estado — trabajo que no es suyo y que, si lo tocaba, tapaba que su auxiliar
// no lo había hecho.
function CapturaDeAuxiliares({ filas }: { filas: Fila[] }) {
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
  const pendientes = filas.filter((f) => f.estado !== 'terminado' && f.estado !== 'auditado').length;

  return (
    // Plegado por defecto: el asesor no lo ejecuta, lo consulta cuando quiere
    // saber por qué algo no se ha liberado. Abierto le empujaba su propio
    // trabajo fuera de la pantalla.
    <PanelPlegable
      id="captura-auxiliares" titulo="👀 Captura de mis auxiliares" abiertoPorDefecto={false}
      nota="Solo consulta — el insumo se libera cuando quede terminada."
      resumen={<Chip n={pendientes} label="sin terminar" tono={pendientes ? 'var(--alerta-fuerte)' : undefined} />}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>Auxiliar</th>
              <th style={{ ...th, textAlign: 'center' }}>Hoy</th>
              <th style={{ ...th, textAlign: 'center' }}>Lotes</th>
              <th style={th}>Última</th>
              <th style={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => {
              const em = ESTADOS[t.estado] ?? { label: t.estado, color: 'var(--muted)' };
              return (
                <tr key={t.id}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {t.empresa}
                    {t.area && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6, fontSize: 11.5 }}>· {t.area}</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{t.auxiliar ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {t.lotesHoy > 0
                      ? <span style={{ fontWeight: 800, color: 'var(--exito)' }}>{t.lotesHoy}</span>
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>{t.totalLotes}</td>
                  <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtFecha(t.ultimaFecha)}</td>
                  <td style={td}><span className="chip" style={{ color: em.color, borderColor: em.color }}>{em.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PanelPlegable>
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
