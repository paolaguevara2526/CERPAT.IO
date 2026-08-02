'use client';
// Modal de detalle de una tarea del plan, abierto desde el calendario.
// Pestañas General / Fiscal / Auditoría. Lo esencial editable en línea: estado,
// fecha de vencimiento y el LINK DE SOPORTE DOCUMENTAL (donde va quedando el
// trabajo). "Editar" abre el formulario completo; "Eliminar" borra la tarea.

import { useEffect, useState } from 'react';
import { EditarTareaBoton } from '../TareaModal';

const ESTADO_META: Record<string, { label: string; color: string }> = {
  por_iniciar: { label: 'Por iniciar', color: '#5b6a82' },
  en_curso: { label: 'En curso', color: '#2f6fd0' },
  en_revision: { label: 'En revisión', color: '#c67c00' },
  terminado: { label: 'Terminado', color: '#22a670' },
  auditado: { label: 'Auditado', color: '#1c8a5e' },
  no_realizado: { label: 'No realizado', color: '#cf4436' },
};
const PRIORIDAD_META: Record<string, { label: string; color: string }> = {
  alta: { label: 'Alta', color: '#cf4436' }, media: { label: 'Media', color: '#22a670' }, baja: { label: 'Baja', color: '#5b6a82' },
};
const PAGO_META: Record<string, string> = {
  pendiente: 'Pendiente', presentado_sin_pago: 'Presentado (sin pago)', presentado_pagado: 'Presentado y pagado',
  presentado_cero: 'Presentado en $0', no_presentado: 'No presentado', no_obligado: 'No obligado',
};
const AUDITORIA_META: Record<string, string> = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };

type Detalle = {
  id: string; titulo: string; estado: string; prioridad: string; auditoria: string;
  empresa: string | null; area: string | null; creadoPor: string | null; asesor: string | null; auxiliar: string | null;
  asignados: string[]; etiquetas: string[];
  fechaInicio: string; fechaVencimiento: string; createdAt: string;
  soporteLink: string | null; requiereSoporte: boolean; observaciones: string | null;
  estadoPago: string; valorPago: number | null; generaPago: boolean; requiereRevisionTecnica: boolean;
  comprobanteDesde: string | null; comprobanteHasta: string | null; cantidadRegistros: number | null; esRegistroSoftware: boolean;
};

function fFecha(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '—'; }
}
function fFechaHora(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}
function iniciales(n: string): string {
  const p = n.trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' };
const box: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', background: 'var(--panel)' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', borderRadius: 6, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

export default function TareaDetalleModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged?: () => void }) {
  const [t, setT] = useState<Detalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tab, setTab] = useState<'general' | 'fiscal' | 'auditoria'>('general');
  const [link, setLink] = useState('');
  const [guardandoLink, setGuardandoLink] = useState(false);
  const [linkOk, setLinkOk] = useState(false);

  async function cargar() {
    setCargando(true); setError(null);
    try {
      const r = await fetch(`/api/planeador/gestion/tareas/${id}/detalle`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo cargar la tarea.'); return; }
      const tt = d.tarea ?? {};
      // Defensivo: si la API aún no trae los campos nuevos, no romper el render.
      setT({ ...tt, asignados: Array.isArray(tt.asignados) ? tt.asignados : [], etiquetas: Array.isArray(tt.etiquetas) ? tt.etiquetas : [] });
      setLink(tt.soporteLink ?? '');
    } catch { setError('Error de red.'); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function cambiarEstado(nuevo: string) {
    if (!t) return; const prev = t.estado; setT({ ...t, estado: nuevo }); setAviso(null);
    const r = await fetch('/api/planeador/tarea-estado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estado: nuevo }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setT({ ...t, estado: prev }); setAviso(d.error || 'No se pudo cambiar el estado.'); }
    else onChanged?.();
  }
  async function reprogramar(fecha: string) {
    if (!t || !fecha) return; const prev = t.fechaVencimiento; setT({ ...t, fechaVencimiento: fecha }); setAviso(null);
    const r = await fetch(`/api/planeador/gestion/tareas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fechaVencimiento: fecha }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setT({ ...t, fechaVencimiento: prev }); setAviso(d.error || 'No se pudo reprogramar.'); }
    else onChanged?.();
  }
  async function guardarLink() {
    setGuardandoLink(true); setLinkOk(false); setAviso(null);
    try {
      const r = await fetch(`/api/planeador/gestion/tareas/${id}/soporte`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ soporteLink: link }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAviso(d.error || 'No se pudo guardar el link.'); return; }
      setLinkOk(true); if (t) setT({ ...t, soporteLink: link.trim() || null }); setTimeout(() => setLinkOk(false), 2000);
    } catch { setAviso('Error de red.'); } finally { setGuardandoLink(false); }
  }
  async function eliminar() {
    if (!confirm('¿Eliminar esta tarea? No se puede deshacer.')) return;
    const r = await fetch(`/api/planeador/gestion/tareas/${id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setAviso(d.error || 'No se pudo eliminar.'); return; }
    onChanged?.(); onClose();
  }

  const em = t ? (ESTADO_META[t.estado] ?? { label: t.estado, color: '#5b6a82' }) : null;
  const pm = t ? (PRIORIDAD_META[t.prioridad] ?? { label: t.prioridad, color: '#5b6a82' }) : null;
  const asignados = t ? [...new Set([t.asesor, t.auxiliar, ...t.asignados].filter(Boolean) as string[])] : [];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'auto', padding: 0 }}>
        {cargando ? (
          <div style={{ padding: 26, color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
        ) : error ? (
          <div style={{ padding: 22 }}>
            <div style={{ color: '#b42318', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{error}</div>
            <button onClick={onClose} className="dbtn" style={{ fontSize: 13 }}>Cerrar</button>
          </div>
        ) : t && em && pm ? (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Encabezado */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1.25 }}>{t.titulo}</h2>
              <button onClick={onClose} aria-label="Cerrar" className="dbtn" style={{ fontSize: 13, flex: '0 0 auto' }}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select value={t.estado} onChange={(e) => cambiarEstado(e.target.value)} title="Cambiar estado"
                style={{ fontSize: 12.5, fontWeight: 800, color: em.color, background: `${em.color}18`, border: `1px solid ${em.color}55`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontFamily: 'var(--ui)' }}>
                {Object.entries(ESTADO_META).map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v.label}</option>)}
              </select>
              <span style={{ fontSize: 12, fontWeight: 800, color: pm.color, background: `${pm.color}18`, borderRadius: 20, padding: '4px 12px' }}>{pm.label}</span>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <EditarTareaBoton id={t.id} />
              <button onClick={() => setAviso('Duplicar estará disponible pronto.')} className="dbtn" style={{ fontSize: 12.5 }}>⧉ Duplicar</button>
              <button onClick={eliminar} className="dbtn" style={{ fontSize: 12.5, color: '#cf4436' }}>🗑 Eliminar</button>
            </div>

            {aviso && (
              <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{aviso}</span><button onClick={() => setAviso(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#B42318' }}>✕</button>
              </div>
            )}

            {/* Pestañas */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--panel-2)', borderRadius: 8, padding: 4 }}>
              {([['general', '📄 General'], ['fiscal', '🧾 Fiscal'], ['auditoria', '✔ Auditoría']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: 'none', borderRadius: 6, padding: '7px 8px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--ui)', background: tab === k ? 'var(--panel)' : 'transparent', color: tab === k ? 'var(--ink)' : 'var(--muted)', boxShadow: tab === k ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>{label}</button>
              ))}
            </div>

            {tab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div><div style={lbl}>Creada por</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{t.creadoPor ?? '—'}</div></div>
                  <div><div style={lbl}>Asignados</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {asignados.length ? asignados.map((n) => (
                        <span key={n} title={n} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--verde, #34C98B)', color: '#08301f', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{iniciales(n)}</span>
                      )) : <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Sin asignar</span>}
                    </div>
                  </div>
                </div>

                <div><div style={lbl}>Empresa</div>
                  <div style={{ marginTop: 4, background: 'color-mix(in srgb, var(--brand, #2E5090) 12%, var(--panel))', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 13px', fontSize: 13.5, fontWeight: 700 }}>
                    {t.empresa ?? '—'}{t.area ? <span style={{ fontWeight: 500, color: 'var(--muted)' }}> · {t.area}</span> : null}
                  </div>
                </div>

                <div style={box}>
                  <div style={{ ...lbl, marginBottom: 8 }}>📅 Fechas</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Campo k="Creación" v={fFechaHora(t.createdAt)} />
                    <Campo k="Inicio" v={fFecha(t.fechaInicio)} />
                    <div>
                      <div style={{ ...lbl, marginBottom: 3 }}>Vencimiento</div>
                      <input type="date" defaultValue={t.fechaVencimiento.slice(0, 10)} onChange={(e) => reprogramar(e.target.value)} style={inp} title="Reprogramar" />
                    </div>
                    <Campo k="Finalización" v={t.estado === 'terminado' || t.estado === 'auditado' ? fFecha(t.fechaVencimiento) : '—'} />
                  </div>
                </div>

                <div style={box}>
                  <div style={{ ...lbl, marginBottom: 8 }}>🏷 Etiquetas</div>
                  {t.etiquetas.length ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {t.etiquetas.map((e) => <span key={e} style={{ fontSize: 12, fontWeight: 700, color: '#1c8a5e', background: '#1c8a5e18', borderRadius: 20, padding: '3px 11px' }}>● {e}</span>)}
                    </div>
                  ) : <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Sin etiquetas</span>}
                </div>

                {/* SOPORTE DOCUMENTAL */}
                <div style={{ ...box, borderColor: 'color-mix(in srgb, var(--brand, #2E5090) 40%, var(--line))' }}>
                  <div style={{ ...lbl, marginBottom: 6 }}>🔗 Soporte documental</div>
                  <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.4 }}>Pega el link (Drive / OneDrive) donde va quedando el desarrollo de la actividad.</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input value={link} onChange={(e) => { setLink(e.target.value); setLinkOk(false); }} placeholder="https://drive.google.com/… o link de OneDrive" style={{ ...inp, flex: 1, minWidth: 200 }} />
                    <button onClick={guardarLink} disabled={guardandoLink} className="dbtn primary" style={{ fontSize: 12.5 }}>{guardandoLink ? 'Guardando…' : linkOk ? '✓ Guardado' : 'Guardar'}</button>
                  </div>
                  {t.soporteLink && (
                    <a href={t.soporteLink} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--brand, #2E5090)', wordBreak: 'break-all' }}>↗ Abrir soporte actual</a>
                  )}
                </div>
              </div>
            )}

            {tab === 'fiscal' && (
              <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Campo k="Estado de pago" v={PAGO_META[t.estadoPago] ?? t.estadoPago} />
                  <Campo k="Valor" v={t.valorPago != null ? t.valorPago.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '—'} />
                  <Campo k="¿Genera pago?" v={t.generaPago ? 'Sí' : 'No'} />
                </div>
                {t.esRegistroSoftware && (
                  <div>
                    <div style={{ ...lbl, marginBottom: 6 }}>Registro en el software</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <Campo k="Desde" v={t.comprobanteDesde ?? '—'} />
                      <Campo k="Hasta" v={t.comprobanteHasta ?? '—'} />
                      <Campo k="Registros" v={t.cantidadRegistros != null ? String(t.cantidadRegistros) : '—'} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'auditoria' && (
              <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Campo k="Estado de auditoría" v={AUDITORIA_META[t.auditoria] ?? t.auditoria} />
                  <Campo k="Requiere revisión técnica" v={t.requiereRevisionTecnica ? 'Sí' : 'No'} />
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>Observaciones</div>
                  <div style={{ fontSize: 12.5, color: t.observaciones ? 'var(--ink)' : 'var(--muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.observaciones || 'Sin observaciones.'}</div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Campo({ k, v }: { k: string; v: string }) {
  return <div><div style={lbl}>{k}</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{v}</div></div>;
}
