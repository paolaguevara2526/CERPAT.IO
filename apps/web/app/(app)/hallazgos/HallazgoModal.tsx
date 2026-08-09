'use client';
// Modal para crear/editar un hallazgo (solo revisor). Guarda contra /api/portal.

import { useState } from 'react';
import type { Hallazgo } from './PortalHallazgos';

type Form = {
  titulo: string; area: string; descripcion: string; normatividad: string; riesgo: string; riesgoDescripcion: string; prioridad: string;
  responsable: string; planAccion: string; plazo: string; estado: string; observaciones: string;
};
const iso = (s?: string | null) => (s ? s.slice(0, 10) : '');
const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };

export default function HallazgoModal({ hallazgo, empresaId, onClose, onGuardado, onError }: {
  hallazgo: Hallazgo | 'nuevo'; empresaId: string; onClose: () => void; onGuardado: () => void; onError: (m: string) => void;
}) {
  const nuevo = hallazgo === 'nuevo';
  const h = nuevo ? null : hallazgo;
  const [form, setForm] = useState<Form>({
    titulo: h?.titulo ?? '', area: h?.area ?? '', descripcion: h?.descripcion ?? '', normatividad: h?.normatividad ?? '',
    riesgo: h?.riesgo ?? 'medio', riesgoDescripcion: h?.riesgoDescripcion ?? '', prioridad: h?.prioridad ?? 'media', responsable: h?.responsable ?? '',
    planAccion: h?.planAccion ?? '', plazo: iso(h?.plazo), estado: h?.estado ?? 'pendiente', observaciones: h?.observaciones ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    if (!form.titulo.trim()) { onError('El título del hallazgo es obligatorio.'); return; }
    setGuardando(true);
    try {
      const url = nuevo ? '/api/portal' : `/api/portal/${(hallazgo as Hallazgo).id}`;
      const res = await fetch(url, { method: nuevo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevo ? { ...form, empresaId } : form) });
      const d = await res.json();
      if (!res.ok) { onError(d.error || 'No se pudo guardar.'); setGuardando(false); return; }
      onGuardado();
    } catch { onError('Error de red.'); setGuardando(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="win-bar"><span className="win-title">{nuevo ? 'Nuevo hallazgo' : 'Editar hallazgo'}</span>
          <div className="win-ctl"><button className="close" onClick={onClose} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
        </div>
        <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Hallazgo (título) *</span><input style={input} value={form.titulo} onChange={(e) => set('titulo', e.target.value)} /></label>
            <label><span style={lbl}>Área / proceso</span><input style={input} value={form.area} onChange={(e) => set('area', e.target.value)} /></label>
            <label><span style={lbl}>Responsable</span><input style={input} value={form.responsable} onChange={(e) => set('responsable', e.target.value)} /></label>
          </div>
          <label><span style={lbl}>Descripción de la situación</span><textarea rows={2} style={{ ...input, resize: 'vertical' }} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></label>
          <label><span style={lbl}>Normatividad</span><input style={input} value={form.normatividad} onChange={(e) => set('normatividad', e.target.value)} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <label><span style={lbl}>Riesgo</span>
              <select style={input} value={form.riesgo} onChange={(e) => set('riesgo', e.target.value)}>
                <option value="alto">Alto</option><option value="medio">Medio</option><option value="bajo">Bajo</option>
              </select>
            </label>
            <label><span style={lbl}>Prioridad</span>
              <select style={input} value={form.prioridad} onChange={(e) => set('prioridad', e.target.value)}>
                <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
              </select>
            </label>
            <label><span style={lbl}>Estado</span>
              <select style={input} value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                <option value="pendiente">Pendiente</option><option value="en_gestion">En gestión</option><option value="resuelto">Resuelto</option>
              </select>
            </label>
          </div>
          <label><span style={lbl}>Descripción del riesgo (impacto / consecuencia)</span><textarea rows={2} style={{ ...input, resize: 'vertical' }} value={form.riesgoDescripcion} onChange={(e) => set('riesgoDescripcion', e.target.value)} /></label>
          <label><span style={lbl}>Acción o plan de remediación</span><textarea rows={2} style={{ ...input, resize: 'vertical' }} value={form.planAccion} onChange={(e) => set('planAccion', e.target.value)} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
            <label><span style={lbl}>Plazo</span><input type="date" style={input} value={form.plazo} onChange={(e) => set('plazo', e.target.value)} /></label>
            <label><span style={lbl}>Observaciones de seguimiento</span><input style={input} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} /></label>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="dbtn" onClick={onClose} style={{ fontSize: 13 }}>Cancelar</button>
            <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : nuevo ? 'Crear hallazgo' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
