'use client';
// Modal para crear / editar una tarea (y sus subtareas). Solo coordinación.
// Guarda contra la API vía el proxy /api/planeador/gestion/...; las reglas y
// permisos se validan en el backend.

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Opcion = { id: string; nombre: string };
type Sub = { id: string; texto: string; estado: string };
type Form = {
  titulo: string; empresaId: string; areaId: string; asesorId: string; auxiliarId: string;
  prioridad: string; periodo: string; fechaInicio: string; fechaVencimiento: string;
  observaciones: string; generaPago: boolean; requiereRevisionTecnica: boolean;
};
const VACIO: Form = {
  titulo: '', empresaId: '', areaId: '', asesorId: '', auxiliarId: '',
  prioridad: 'media', periodo: '', fechaInicio: '', fechaVencimiento: '',
  observaciones: '', generaPago: false, requiereRevisionTecnica: false,
};
const iso = (s?: string) => (s ? s.slice(0, 10) : '');
// Cuenta registros a partir del rango de comprobantes (dígitos finales):
// CE-1045 → CE-1290 = 246 (final − inicial + 1). '' si no se puede calcular.
function contarRegistros(desde: string, hasta: string): string {
  const a = desde.match(/(\d+)\s*$/); const b = hasta.match(/(\d+)\s*$/);
  if (!a || !b) return '';
  const na = parseInt(a[1], 10), nb = parseInt(b[1], 10);
  return nb >= na ? String(nb - na + 1) : '';
}
const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };

function Modal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const router = useRouter();
  const editar = !!id;
  const [form, setForm] = useState<Form>(VACIO);
  const [datos, setDatos] = useState<{ empresas: Opcion[]; areas: Opcion[]; usuarios: Opcion[] }>({ empresas: [], areas: [], usuarios: [] });
  const [subs, setSubs] = useState<Sub[]>([]);
  const [subsCrear, setSubsCrear] = useState<string[]>([]);
  const [nuevaSub, setNuevaSub] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  // Registro en el software (comprobantes). cantidadManual = el usuario ajustó el conteo.
  const [esRegistro, setEsRegistro] = useState(false);
  const [reg, setReg] = useState({ desde: '', hasta: '', cantidad: '' });
  const [cantidadManual, setCantidadManual] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setDesde = (v: string) => setReg((r) => ({ ...r, desde: v, cantidad: cantidadManual ? r.cantidad : contarRegistros(v, r.hasta) }));
  const setHasta = (v: string) => setReg((r) => ({ ...r, hasta: v, cantidad: cantidadManual ? r.cantidad : contarRegistros(r.desde, v) }));
  const setCantidad = (v: string) => { setCantidadManual(true); setReg((r) => ({ ...r, cantidad: v })); };
  const recalcular = () => { setCantidadManual(false); setReg((r) => ({ ...r, cantidad: contarRegistros(r.desde, r.hasta) })); };

  const cargarSubs = useCallback(async (tid: string) => {
    const r = await fetch(`/api/planeador/gestion/tareas/${tid}/subtareas`, { cache: 'no-store' });
    const d = await r.json(); if (r.ok) setSubs(d.subtareas ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const fd = await fetch('/api/planeador/gestion/form-datos', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
      setDatos({ empresas: fd.empresas ?? [], areas: fd.areas ?? [], usuarios: fd.usuarios ?? [] });
      if (id) {
        const r = await fetch(`/api/planeador/gestion/tareas/${id}/detalle`, { cache: 'no-store' });
        const d = await r.json();
        if (r.ok) {
          const t = d.tarea;
          setForm({
            titulo: t.titulo ?? '', empresaId: t.empresaId ?? '', areaId: t.areaId ?? '', asesorId: t.asesorId ?? '', auxiliarId: t.auxiliarId ?? '',
            prioridad: t.prioridad ?? 'media', periodo: t.periodo ?? '', fechaInicio: iso(t.fechaInicio), fechaVencimiento: iso(t.fechaVencimiento),
            observaciones: t.observaciones ?? '', generaPago: !!t.generaPago, requiereRevisionTecnica: !!t.requiereRevisionTecnica,
          });
          setEsRegistro(!!t.esRegistroSoftware);
          setReg({ desde: t.comprobanteDesde ?? '', hasta: t.comprobanteHasta ?? '', cantidad: t.cantidadRegistros != null ? String(t.cantidadRegistros) : '' });
          setCantidadManual(false);
          await cargarSubs(id);
        } else setError(d.error || 'No se pudo cargar la tarea.');
      }
      setCargando(false);
    })();
  }, [id, cargarSubs]);

  async function guardar() {
    if (!form.titulo.trim() || !form.empresaId) { setError('Título y cliente son obligatorios.'); return; }
    if (!form.fechaVencimiento) { setError('La fecha de vencimiento es obligatoria.'); return; }
    setGuardando(true); setError(null);
    try {
      if (editar) {
        const r = await fetch(`/api/planeador/gestion/tareas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        const d = await r.json();
        if (!r.ok) { setError(d.error || 'No se pudo guardar.'); setGuardando(false); return; }
        if (esRegistro) {
          const rr = await fetch(`/api/planeador/gestion/tareas/${id}/registro`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comprobanteDesde: reg.desde, comprobanteHasta: reg.hasta, cantidadRegistros: reg.cantidad === '' ? null : Number(reg.cantidad) }) });
          if (!rr.ok) { const dd = await rr.json(); setError(dd.error || 'No se pudo guardar el registro en software.'); setGuardando(false); return; }
        }
      } else {
        const r = await fetch('/api/planeador/gestion/tareas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, subtareas: subsCrear }) });
        const d = await r.json();
        if (!r.ok) { setError(d.error || 'No se pudo crear.'); setGuardando(false); return; }
      }
      router.refresh(); onClose();
    } catch { setError('Error de red.'); setGuardando(false); }
  }

  async function addSub() {
    const texto = nuevaSub.trim(); if (!texto) return;
    if (editar && id) {
      const r = await fetch(`/api/planeador/gestion/tareas/${id}/subtareas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) });
      const d = await r.json(); if (r.ok) setSubs((p) => [...p, d.subtarea]); else setError(d.error || 'No se pudo agregar.');
    } else setSubsCrear((p) => [...p, texto]);
    setNuevaSub('');
  }
  async function toggleSub(s: Sub) {
    const nuevo = s.estado === 'realizada' ? 'pendiente' : 'realizada';
    const r = await fetch(`/api/planeador/gestion/tareas/${id}/subtareas/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevo }) });
    if (r.ok) setSubs((p) => p.map((x) => (x.id === s.id ? { ...x, estado: nuevo } : x)));
  }
  async function delSub(s: Sub) {
    const r = await fetch(`/api/planeador/gestion/tareas/${id}/subtareas/${s.id}`, { method: 'DELETE' });
    if (r.ok) setSubs((p) => p.filter((x) => x.id !== s.id));
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="win-bar"><span className="win-title">{editar ? 'Editar tarea' : 'Nueva tarea'}</span>
          <div className="win-ctl"><button className="close" onClick={onClose} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
        </div>
        <div className="win-body" style={{ padding: 18 }}>
          {cargando ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>Cargando…</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
              <label><span style={lbl}>Título *</span><input style={input} value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Actividad" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label><span style={lbl}>Cliente *</span>
                  <select style={input} value={form.empresaId} onChange={(e) => set('empresaId', e.target.value)}>
                    <option value="">— Selecciona —</option>{datos.empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </label>
                <label><span style={lbl}>Área</span>
                  <select style={input} value={form.areaId} onChange={(e) => set('areaId', e.target.value)}>
                    <option value="">— Sin área —</option>{datos.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </label>
                <label><span style={lbl}>Asesor</span>
                  <select style={input} value={form.asesorId} onChange={(e) => set('asesorId', e.target.value)}>
                    <option value="">— Sin asignar —</option>{datos.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </label>
                <label><span style={lbl}>Auxiliar</span>
                  <select style={input} value={form.auxiliarId} onChange={(e) => set('auxiliarId', e.target.value)}>
                    <option value="">— Sin asignar —</option>{datos.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </label>
                <label><span style={lbl}>Prioridad</span>
                  <select style={input} value={form.prioridad} onChange={(e) => set('prioridad', e.target.value)}>
                    <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                  </select>
                </label>
                <label><span style={lbl}>Período</span><input style={input} value={form.periodo} onChange={(e) => set('periodo', e.target.value)} placeholder="YYYY-MM" /></label>
                <label><span style={lbl}>Inicio</span><input type="date" style={input} value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} /></label>
                <label><span style={lbl}>Vence *</span><input type="date" style={input} value={form.fechaVencimiento} onChange={(e) => set('fechaVencimiento', e.target.value)} /></label>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <label style={chk}><input type="checkbox" checked={form.generaPago} onChange={(e) => set('generaPago', e.target.checked)} /> Genera pago</label>
                <label style={chk}><input type="checkbox" checked={form.requiereRevisionTecnica} onChange={(e) => set('requiereRevisionTecnica', e.target.checked)} /> Requiere revisión técnica</label>
              </div>
              <label><span style={lbl}>Observaciones</span><textarea rows={2} style={{ ...input, resize: 'vertical' }} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} /></label>

              {/* Subtareas */}
              <div>
                <span style={lbl}>Subtareas</span>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input style={{ ...input, flex: 1 }} value={nuevaSub} onChange={(e) => setNuevaSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} placeholder="Agregar subtarea…" />
                  <button className="dbtn" onClick={addSub} disabled={!nuevaSub.trim()} style={{ fontSize: 12.5 }}>＋</button>
                </div>
                {editar ? (
                  subs.length === 0 ? <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Sin subtareas.</p> : (
                    <div className="panel">
                      {subs.map((s, i) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < subs.length - 1 ? '1px solid var(--line)' : 'none' }}>
                          <input type="checkbox" checked={s.estado === 'realizada'} onChange={() => toggleSub(s)} />
                          <span style={{ flex: 1, fontSize: 12.5, textDecoration: s.estado === 'realizada' ? 'line-through' : 'none', color: s.estado === 'realizada' ? 'var(--muted)' : 'var(--ink)' }}>{s.texto}</span>
                          <button onClick={() => delSub(s)} title="Eliminar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--peligro)', fontSize: 13 }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )
                ) : subsCrear.length > 0 && (
                  <div className="panel">
                    {subsCrear.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < subsCrear.length - 1 ? '1px solid var(--line)' : 'none' }}>
                        <span style={{ flex: 1, fontSize: 12.5 }}>{t}</span>
                        <button onClick={() => setSubsCrear((p) => p.filter((_, j) => j !== i))} title="Quitar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--peligro)', fontSize: 13 }}>🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Registro en el software (solo actividades de registro) */}
              {editar && esRegistro && (
                <div>
                  <span style={lbl}>Registro en el software</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label><span style={lbl}>Comprobante inicial</span><input style={input} value={reg.desde} onChange={(e) => setDesde(e.target.value)} placeholder="Ej: CE-1045" /></label>
                    <label><span style={lbl}>Comprobante final</span><input style={input} value={reg.hasta} onChange={(e) => setHasta(e.target.value)} placeholder="Ej: CE-1290" /></label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    <label style={{ width: 130 }}><span style={lbl}>Registros</span><input type="number" min={0} style={input} value={reg.cantidad} onChange={(e) => setCantidad(e.target.value)} /></label>
                    <button type="button" className="dbtn" onClick={recalcular} style={{ fontSize: 12.5 }} title="Volver a calcular desde el rango de comprobantes">↻ recalcular</button>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', paddingBottom: 9 }}>registros de este período · {cantidadManual ? 'ajustado a mano' : 'calculado del rango'}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="dbtn" onClick={onClose} style={{ fontSize: 13 }}>Cancelar</button>
                <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : editar ? 'Guardar cambios' : 'Crear tarea'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const chk: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };

export default function NuevaTareaBoton() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button className="dbtn primary" onClick={() => setAbierto(true)} style={{ fontSize: 13 }}>＋ Nueva tarea</button>
      {abierto && <Modal id={null} onClose={() => setAbierto(false)} />}
    </>
  );
}

export function EditarTareaBoton({ id }: { id: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button onClick={() => setAbierto(true)} title="Editar tarea" aria-label="Editar tarea"
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--navy)', fontSize: 13, padding: '2px 4px' }}>✎</button>
      {abierto && <Modal id={id} onClose={() => setAbierto(false)} />}
    </>
  );
}
