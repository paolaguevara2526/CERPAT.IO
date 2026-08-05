'use client';
// Editor del "acta" de una visita: cliente, responsable, fecha/hora, objetivo,
// recomendaciones y la lista de compromisos (descripción, fecha límite,
// responsable, estado). Sirve para agendar (crear) y para editar el acta.
// Reutilizable en la vista de Visitas y en el Calendario.

import { useEffect, useState, useCallback } from 'react';

type Opcion = { id: string; nombre: string };
export const VISITA_ESTADOS: { k: string; label: string; color: string }[] = [
  { k: 'programada', label: 'Programada', color: '#2f6fd0' },
  { k: 'realizada', label: 'Realizada', color: '#22a670' },
  { k: 'cancelada', label: 'Cancelada', color: '#9aa3b2' },
];
export const COMPROMISO_ESTADOS: { k: string; label: string; color: string }[] = [
  { k: 'pendiente', label: 'Pendiente', color: '#c67c00' },
  { k: 'cumplido', label: 'Cumplido', color: '#22a670' },
  { k: 'cancelado', label: 'Cancelado', color: '#9aa3b2' },
];

type Compromiso = { id?: string; descripcion: string; fechaLimite: string; responsableId: string; estado: string };
type Form = { empresaId: string; responsableId: string; fecha: string; hora: string; objetivo: string; recomendaciones: string; estado: string; observaciones: string };
const VACIO: Form = { empresaId: '', responsableId: '', fecha: '', hora: '', objetivo: '', recomendaciones: '', estado: 'programada', observaciones: '' };
const compromisoVacio = (): Compromiso => ({ descripcion: '', fechaLimite: '', responsableId: '', estado: 'pendiente' });

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };

export default function VisitaModal({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved?: () => void }) {
  const editar = !!id;
  const [form, setForm] = useState<Form>(VACIO);
  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);
  const [datos, setDatos] = useState<{ empresas: Opcion[]; usuarios: Opcion[] }>({ empresas: [], usuarios: [] });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const cargarDetalle = useCallback(async (vid: string) => {
    const r = await fetch(`/api/visitas/${vid}`, { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok) { setError(d.error || 'No se pudo cargar la visita.'); return; }
    const v = d.visita;
    setForm({
      empresaId: v.empresaId ?? '', responsableId: v.responsableId ?? '', fecha: v.fecha ?? '', hora: v.hora ?? '',
      objetivo: v.objetivo ?? '', recomendaciones: v.recomendaciones ?? '', estado: v.estado ?? 'programada', observaciones: v.observaciones ?? '',
    });
    setCompromisos((v.compromisos ?? []).map((c: any) => ({ id: c.id, descripcion: c.descripcion, fechaLimite: c.fechaLimite ?? '', responsableId: c.responsableId ?? '', estado: c.estado })));
  }, []);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const fd = await fetch('/api/planeador/gestion/form-datos', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
      setDatos({ empresas: fd.empresas ?? [], usuarios: fd.usuarios ?? [] });
      if (id) await cargarDetalle(id);
      setCargando(false);
    })();
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [id, cargarDetalle, onClose]);

  // ----- Compromisos (en edición se guardan de una contra la API) -----
  function addCompromisoLocal() { setCompromisos((cs) => [...cs, compromisoVacio()]); }
  function setCompromisoLocal(i: number, campo: keyof Compromiso, v: string) {
    setCompromisos((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: v } : c)));
  }
  function quitarCompromisoLocal(i: number) { setCompromisos((cs) => cs.filter((_, j) => j !== i)); }

  async function guardarCompromisoExistente(i: number) {
    if (!editar) return;
    const c = compromisos[i];
    if (!c.descripcion.trim()) return;
    const body = { descripcion: c.descripcion, fechaLimite: c.fechaLimite || null, responsableId: c.responsableId || null, estado: c.estado };
    if (c.id) {
      const r = await fetch(`/api/visitas/compromisos/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo guardar el compromiso.'); }
    } else {
      const r = await fetch(`/api/visitas/${id}/compromisos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo agregar el compromiso.'); return; }
      setCompromisos((cs) => cs.map((x, j) => (j === i ? { ...x, id: d.id } : x)));
    }
  }
  async function eliminarCompromiso(i: number) {
    const c = compromisos[i];
    if (editar && c.id) {
      const r = await fetch(`/api/visitas/compromisos/${c.id}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar el compromiso.'); return; }
    }
    quitarCompromisoLocal(i);
  }

  async function guardar() {
    if (!form.empresaId) { setError('El cliente es obligatorio.'); return; }
    if (!form.fecha) { setError('La fecha de la visita es obligatoria.'); return; }
    setGuardando(true); setError(null);
    try {
      if (editar) {
        const r = await fetch(`/api/visitas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setError(d.error || 'No se pudo guardar.'); setGuardando(false); return; }
        // Compromisos con descripción que aún no tienen id se crean; los que tienen id se actualizan.
        for (let i = 0; i < compromisos.length; i++) if (compromisos[i].descripcion.trim()) await guardarCompromisoExistente(i);
      } else {
        const payload = { ...form, compromisos: compromisos.filter((c) => c.descripcion.trim()).map((c) => ({ descripcion: c.descripcion, fechaLimite: c.fechaLimite || null, responsableId: c.responsableId || null })) };
        const r = await fetch('/api/visitas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setError(d.error || 'No se pudo agendar la visita.'); setGuardando(false); return; }
      }
      onSaved?.();
      onClose();
    } catch { setError('Error de red.'); setGuardando(false); }
  }

  async function eliminarVisita() {
    if (!editar || !confirm('¿Eliminar esta visita y su acta?')) return;
    setGuardando(true);
    const r = await fetch(`/api/visitas/${id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); setGuardando(false); return; }
    onSaved?.(); onClose();
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 620, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="win-bar">
          <span className="win-title">{editar ? 'Acta de visita' : 'Agendar visita'}</span>
          <div className="win-ctl"><button className="close" onClick={onClose} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
        </div>
        <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
          {cargando ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: 8 }}>Cargando…</div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label><span style={lbl}>Cliente *</span>
                  <select style={input} value={form.empresaId} onChange={(e) => set('empresaId', e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {datos.empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </label>
                <label><span style={lbl}>Responsable (asesor / auditor)</span>
                  <select style={input} value={form.responsableId} onChange={(e) => set('responsableId', e.target.value)}>
                    <option value="">— Sin asignar —</option>
                    {datos.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label><span style={lbl}>Fecha *</span><input type="date" style={input} value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></label>
                <label><span style={lbl}>Hora</span><input type="time" style={input} value={form.hora} onChange={(e) => set('hora', e.target.value)} /></label>
                <label><span style={lbl}>Estado</span>
                  <select style={input} value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                    {VISITA_ESTADOS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              <label><span style={lbl}>Objetivo / motivo</span><input style={input} value={form.objetivo} onChange={(e) => set('objetivo', e.target.value)} placeholder="Motivo de la visita…" /></label>

              {/* Compromisos del acta */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>🤝 Compromisos ({compromisos.length})</span>
                  <button type="button" className="dbtn" onClick={addCompromisoLocal} style={{ fontSize: 12 }}>＋ Agregar</button>
                </div>
                {compromisos.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aún no hay compromisos. Agrega los acuerdos con su fecha y responsable.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {compromisos.map((c, i) => (
                    <div key={c.id ?? `n${i}`} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input style={input} value={c.descripcion} onChange={(e) => setCompromisoLocal(i, 'descripcion', e.target.value)} onBlur={() => guardarCompromisoExistente(i)} placeholder="Compromiso acordado…" />
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px 30px', gap: 6, alignItems: 'center' }}>
                        <input type="date" style={{ ...input, padding: '5px 7px', fontSize: 12 }} value={c.fechaLimite} onChange={(e) => setCompromisoLocal(i, 'fechaLimite', e.target.value)} onBlur={() => guardarCompromisoExistente(i)} title="Fecha límite" />
                        <select style={{ ...input, padding: '5px 7px', fontSize: 12 }} value={c.responsableId} onChange={(e) => { setCompromisoLocal(i, 'responsableId', e.target.value); }} onBlur={() => guardarCompromisoExistente(i)} title="Responsable del compromiso">
                          <option value="">— Responsable —</option>
                          {datos.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                        </select>
                        <select style={{ ...input, padding: '5px 7px', fontSize: 12 }} value={c.estado} onChange={(e) => { setCompromisoLocal(i, 'estado', e.target.value); }} onBlur={() => guardarCompromisoExistente(i)} title="Estado">
                          {COMPROMISO_ESTADOS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
                        </select>
                        <button type="button" onClick={() => eliminarCompromiso(i)} title="Quitar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cf4436', fontSize: 15 }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label><span style={lbl}>Recomendaciones / sugerencias</span><textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={form.recomendaciones} onChange={(e) => set('recomendaciones', e.target.value)} placeholder="Recomendaciones del acta…" /></label>
              <label><span style={lbl}>Observaciones</span><textarea style={{ ...input, minHeight: 48, resize: 'vertical' }} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} /></label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                {editar ? <button className="dbtn" onClick={eliminarVisita} disabled={guardando} style={{ fontSize: 13, color: '#cf4436', borderColor: '#f3d4d0' }}>Eliminar</button> : <span />}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="dbtn" onClick={onClose} style={{ fontSize: 13 }}>Cancelar</button>
                  <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : editar ? 'Guardar acta' : 'Agendar visita'}</button>
                </div>
              </div>
              {editar && <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>Los compromisos se guardan al salir de cada campo; el resto del acta, con “Guardar acta”.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
