'use client';
// Editor del "acta" de una visita. Incluye datos de la visita, actividades
// realizadas, recomendaciones y observaciones (listas enumeradas) y compromisos
// (cada uno con responsable de la FIRMA o del CLIENTE, fecha límite, área y
// estado). Sirve para agendar (crear) y editar el acta. Reutilizable en la vista
// de Visitas y en el Calendario.

import { useEffect, useState, useCallback } from 'react';
import ModalMarco from '@/app/_components/ModalMarco';
import { logoCerpat } from '@/app/_components/logo-impresion';
import { duracionTexto } from '@/lib/duracion';

type Opcion = { id: string; nombre: string };
export const VISITA_ESTADOS: { k: string; label: string; color: string }[] = [
  { k: 'programada', label: 'Programada', color: 'var(--info)' },
  { k: 'realizada', label: 'Realizada', color: 'var(--exito)' },
  { k: 'cancelada', label: 'Cancelada', color: 'var(--neutro)' },
];
export const COMPROMISO_ESTADOS: { k: string; label: string; color: string }[] = [
  { k: 'pendiente', label: 'Pendiente', color: 'var(--alerta)' },
  { k: 'cumplido', label: 'Cumplido', color: 'var(--exito)' },
  { k: 'cancelado', label: 'Cancelado', color: 'var(--neutro)' },
];

type Compromiso = { id?: string; descripcion: string; fechaLimite: string; responsableTipo: 'firma' | 'cliente'; responsableId: string; responsableExterno: string; area: string; estado: string };
type Form = { empresaId: string; responsableId: string; fecha: string; hora: string; horaSalida: string; lugar: string; area: string; objetivo: string; estado: string };
const VACIO: Form = { empresaId: '', responsableId: '', fecha: '', hora: '', horaSalida: '', lugar: '', area: '', objetivo: '', estado: 'programada' };
const compromisoVacio = (): Compromiso => ({ descripcion: '', fechaLimite: '', responsableTipo: 'firma', responsableId: '', responsableExterno: '', area: '', estado: 'pendiente' });

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };
const inputMini: React.CSSProperties = { ...input, padding: '5px 7px', fontSize: 12 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };
const secTitle: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' };

// Lista enumerada editable (actividades / recomendaciones / observaciones).
function ListaEnumerada({ titulo, hint, icono, items, onChange, placeholder }: { titulo: string; hint: string; icono: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: items.length ? 8 : 4 }}>
        <span style={secTitle}>{icono} {titulo} <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· {hint}</span></span>
        <button type="button" className="dbtn" onClick={() => onChange([...items, ''])} style={{ fontSize: 12 }}>＋ Agregar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: 6, background: 'var(--panel-2)', color: 'var(--muted)', fontWeight: 800, fontSize: 11.5, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
            <input style={input} value={it} onChange={(e) => set(i, e.target.value)} placeholder={placeholder} />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} title="Quitar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--peligro)', fontSize: 15 }}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VisitaModal({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved?: () => void }) {
  const editar = !!id;
  const [form, setForm] = useState<Form>(VACIO);
  // Se recalcula sola cada vez que cambian las horas.
  const duracion = duracionTexto(form.hora, form.horaSalida);
  const [actividades, setActividades] = useState<string[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState<string[]>([]);
  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);
  const [datos, setDatos] = useState<{ empresas: Opcion[]; usuarios: Opcion[]; areas: Opcion[] }>({ empresas: [], usuarios: [], areas: [] });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Foto del acta tal como se cargó. Cerrar sin guardar cuesta el trabajo de
  // media hora, así que antes de cerrar hay que saber si hay algo que perder.
  const [base, setBase] = useState<string | null>(null);
  const foto = JSON.stringify({ form, actividades, recomendaciones, observaciones, compromisos });
  // Se toma cuando termina de cargar, no antes: si se tomara al montar, todo lo
  // que llega del servidor contaría como "cambios del usuario".
  useEffect(() => { if (!cargando) setBase(foto); }, [cargando]); // eslint-disable-line react-hooks/exhaustive-deps
  const haycambios = base !== null && base !== foto;
  const cerrar = () => { if (haycambios && !confirm('El acta tiene cambios sin guardar. ¿Salir y perderlos?')) return; onClose(); };

  const cargarDetalle = useCallback(async (vid: string) => {
    const r = await fetch(`/api/visitas/${vid}`, { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok) { setError(d.error || 'No se pudo cargar la visita.'); return; }
    const v = d.visita;
    setForm({ empresaId: v.empresaId ?? '', responsableId: v.responsableId ?? '', fecha: v.fecha ?? '', hora: v.hora ?? '', horaSalida: v.horaSalida ?? '', lugar: v.lugar ?? '', area: v.area ?? '', objetivo: v.objetivo ?? '', estado: v.estado ?? 'programada' });
    setActividades(v.actividades ?? []);
    setRecomendaciones(v.recomendaciones ?? []);
    setObservaciones(v.observaciones ?? []);
    setCompromisos((v.compromisos ?? []).map((c: any) => ({ id: c.id, descripcion: c.descripcion, fechaLimite: c.fechaLimite ?? '', responsableTipo: c.responsableTipo ?? 'firma', responsableId: c.responsableId ?? '', responsableExterno: c.responsableExterno ?? '', area: c.area ?? '', estado: c.estado })));
  }, []);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const fd = await fetch('/api/planeador/gestion/form-datos', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
      setDatos({ empresas: fd.empresas ?? [], usuarios: fd.usuarios ?? [], areas: fd.areas ?? [] });
      if (id) await cargarDetalle(id);
      setCargando(false);
    })();
  }, [id, cargarDetalle]);

  // ----- Compromisos -----
  function setCompromiso(i: number, campo: keyof Compromiso, v: string) {
    setCompromisos((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: v } : c)));
  }
  const bodyCompromiso = (c: Compromiso) => ({ descripcion: c.descripcion, fechaLimite: c.fechaLimite || null, responsableTipo: c.responsableTipo, responsableId: c.responsableTipo === 'firma' ? c.responsableId || null : null, responsableExterno: c.responsableTipo === 'cliente' ? c.responsableExterno || null : null, area: c.area || null, estado: c.estado });

  async function guardarCompromisoExistente(i: number) {
    if (!editar) return;
    const c = compromisos[i];
    if (!c.descripcion.trim()) return;
    if (c.id) {
      const r = await fetch(`/api/visitas/compromisos/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyCompromiso(c)) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo guardar el compromiso.'); }
    } else {
      const r = await fetch(`/api/visitas/${id}/compromisos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyCompromiso(c)) });
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
    setCompromisos((cs) => cs.filter((_, j) => j !== i));
  }

  const itemsPayload = () => [
    ...actividades.filter((t) => t.trim()).map((texto) => ({ tipo: 'actividad', texto })),
    ...recomendaciones.filter((t) => t.trim()).map((texto) => ({ tipo: 'recomendacion', texto })),
    ...observaciones.filter((t) => t.trim()).map((texto) => ({ tipo: 'observacion', texto })),
  ];

  async function guardar() {
    if (!form.empresaId) { setError('El cliente es obligatorio.'); return; }
    if (!form.fecha) { setError('La fecha de la visita es obligatoria.'); return; }
    setGuardando(true); setError(null);
    try {
      if (editar) {
        const r = await fetch(`/api/visitas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, items: itemsPayload() }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setError(d.error || 'No se pudo guardar.'); setGuardando(false); return; }
        for (let i = 0; i < compromisos.length; i++) if (compromisos[i].descripcion.trim()) await guardarCompromisoExistente(i);
      } else {
        const payload = { ...form, items: itemsPayload(), compromisos: compromisos.filter((c) => c.descripcion.trim()).map(bodyCompromiso) };
        const r = await fetch('/api/visitas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setError(d.error || 'No se pudo agendar la visita.'); setGuardando(false); return; }
      }
      onSaved?.();
      onClose();
    } catch { setError('Error de red.'); setGuardando(false); }
  }

  // ----- Acta imprimible (Fase 2): abre una ventana lista para imprimir/PDF -----
  function imprimirActa() {
    const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const nombre = (arr: Opcion[], id: string) => arr.find((x) => x.id === id)?.nombre ?? '';
    const fechaLarga = (iso: string) => { if (!iso) return '—'; try { return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return iso; } };
    const cliente = nombre(datos.empresas, form.empresaId) || '—';
    const asesor = nombre(datos.usuarios, form.responsableId) || '—';
    const estadoLabel = VISITA_ESTADOS.find((s) => s.k === form.estado)?.label ?? form.estado;

    const lista = (items: string[]) => items.filter((t) => t.trim()).map((t, i) => `<li>${esc(t)}</li>`).join('') || '<li class="vacio">—</li>';
    const compromisoFilas = compromisos.filter((c) => c.descripcion.trim()).map((c) => {
      const resp = c.responsableTipo === 'cliente' ? (esc(c.responsableExterno) || '—') : (esc(nombre(datos.usuarios, c.responsableId)) || '—');
      const dir = c.responsableTipo === 'cliente' ? 'Cliente' : 'Firma';
      const est = COMPROMISO_ESTADOS.find((s) => s.k === c.estado)?.label ?? c.estado;
      return `<tr><td>${esc(c.descripcion)}</td><td>${resp}<br><span class="mini">${dir}</span></td><td>${esc(c.area) || '—'}</td><td>${c.fechaLimite ? fechaLarga(c.fechaLimite) : '—'}</td><td>${est}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="vacio">Sin compromisos.</td></tr>';

    const w = window.open('', '_blank');
    if (!w) { setError('Habilita las ventanas emergentes para imprimir el acta.'); return; }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Acta de visita — ${esc(cliente)}</title>
    <style>
      *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#16233b;}
      body{margin:0;padding:0;}
      .doc{max-width:720px;margin:0 auto;padding:26px 30px;}
      .head{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2.5px solid #23406e;padding-bottom:10px;margin-bottom:16px;}
      .brand svg{display:block;}
      .brand small{display:block;font-size:9.5px;font-weight:600;color:#5b6a82;letter-spacing:2px;text-transform:uppercase;margin-top:5px;}
      h1{font-size:16px;margin:0;text-align:right;color:#23406e;} h1 small{display:block;font-size:10.5px;color:#5b6a82;font-weight:600;}
      .datos{display:grid;grid-template-columns:1fr 1fr;gap:6px 22px;font-size:12px;margin-bottom:6px;}
      .datos div{padding:4px 0;border-bottom:1px solid #eef1f6;}
      .datos b{color:#5b6a82;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;display:block;}
      h2{font-size:11.5px;text-transform:uppercase;letter-spacing:.6px;color:#23406e;border-bottom:1px solid #e2e7ef;padding-bottom:4px;margin:18px 0 8px;}
      ol{margin:0;padding-left:20px;} ol li{font-size:12px;margin:3px 0;} .vacio{color:#9aa3b2;list-style:none;margin-left:-16px;}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px;}
      th{background:#f1f3f7;text-align:left;padding:6px 8px;border:1px solid #d6dae2;font-size:10px;text-transform:uppercase;letter-spacing:.3px;color:#5b6a82;}
      td{padding:6px 8px;border:1px solid #d6dae2;vertical-align:top;} .mini{font-size:9px;color:#7a5bd0;font-weight:700;text-transform:uppercase;}
      .firmas{display:grid;grid-template-columns:1fr 1fr;gap:44px;margin-top:46px;}
      .firma{border-top:1.5px solid #16233b;padding-top:7px;text-align:center;}
      .firma b{display:block;font-size:12px;} .firma span{font-size:10.5px;color:#5b6a82;}
      .foot{margin-top:26px;font-size:9.5px;color:#9aa3b2;text-align:center;}
      @media print{@page{size:A4 portrait;margin:14mm;} .doc{padding:0;}}
    </style></head><body><div class="doc">
      <div class="head">
        <div class="brand">${logoCerpat(30)}<small>Planeador contable</small></div>
        <h1>ACTA DE VISITA<small>${fechaLarga(form.fecha)}</small></h1>
      </div>
      <div class="datos">
        <div><b>Cliente</b>${esc(cliente)}</div>
        <div><b>Responsable (asesor/auditor)</b>${esc(asesor)}</div>
        <div><b>Fecha</b>${fechaLarga(form.fecha)}</div>
        <div><b>Horario</b>${form.hora || form.horaSalida
          ? `${esc(form.hora) || '—'} a ${esc(form.horaSalida) || '—'}${duracion ? ` · <b style="color:#16294A">${esc(duracion)}</b>` : ''}`
          : '—'}</div>
        <div><b>Estado</b>${esc(estadoLabel)}</div>
        <div><b>Área / proceso</b>${esc(form.area) || '—'}</div>
        <div><b>Lugar</b>${esc(form.lugar) || '—'}</div>
      </div>
      <div style="font-size:12px;padding:6px 0;"><b style="color:#5b6a82;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;display:block;">Objetivo / motivo</b>${esc(form.objetivo) || '—'}</div>

      <h2>Actividades realizadas</h2><ol>${lista(actividades)}</ol>
      <h2>Compromisos adquiridos</h2>
      <table><thead><tr><th>Compromiso</th><th>Responsable</th><th>Área</th><th>Fecha límite</th><th>Estado</th></tr></thead><tbody>${compromisoFilas}</tbody></table>
      <h2>Recomendaciones / sugerencias</h2><ol>${lista(recomendaciones)}</ol>
      <h2>Observaciones</h2><ol>${lista(observaciones)}</ol>

      <div class="firmas">
        <div class="firma"><b>${esc(asesor)}</b><span>Asesor / Auditor · CERPAT</span></div>
        <div class="firma"><b>&nbsp;</b><span>Representante del cliente · ${esc(cliente)}</span></div>
      </div>
      <div class="foot">Documento generado desde el Planeador CERPAT.</div>
    </div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  }

  async function eliminarVisita() {
    if (!editar || !confirm('¿Eliminar esta visita y su acta?')) return;
    setGuardando(true);
    const r = await fetch(`/api/visitas/${id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); setGuardando(false); return; }
    onSaved?.(); onClose();
  }

  return (
    <ModalMarco onClose={onClose} zIndex={60} haycambios={haycambios}
      aviso="El acta tiene cambios sin guardar. ¿Salir y perderlos?"
      style={{ width: '100%', maxWidth: 660, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="win-bar">
          <span className="win-title">{editar ? 'Acta de visita' : 'Agendar visita'}</span>
          <div className="win-ctl"><button className="close" onClick={cerrar} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
        </div>
        <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 10 }}>
                <label><span style={lbl}>Fecha *</span><input type="date" style={input} value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></label>
                <label><span style={lbl}>Hora de ingreso</span><input type="time" style={input} value={form.hora} onChange={(e) => set('hora', e.target.value)} /></label>
                <label><span style={lbl}>Hora de salida</span><input type="time" style={input} value={form.horaSalida} onChange={(e) => set('horaSalida', e.target.value)} /></label>
                <label><span style={lbl}>Estado</span>
                  <select style={input} value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                    {VISITA_ESTADOS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              {/* La duración se CALCULA, no se escribe: dos datos que digan lo
                  mismo terminan contradiciéndose. Solo aparece cuando las dos
                  horas están puestas; si la salida quedó antes de la entrada no
                  se muestra nada (ver lib/duracion.ts) y el dedazo se ve. */}
              {(form.hora || form.horaSalida) && (
                <div style={{ fontSize: 12.5, color: duracion ? 'var(--ink)' : 'var(--muted)', marginTop: -2 }}>
                  {duracion
                    ? <>Duración de la visita: <b>{duracion}</b></>
                    : form.hora && form.horaSalida
                      ? <span style={{ color: 'var(--peligro-fuerte)', fontWeight: 600 }}>La hora de salida es anterior a la de ingreso: revisa cuál de las dos quedó mal.</span>
                      : 'Marca las dos horas para calcular la duración.'}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label><span style={lbl}>Área / proceso</span>
                  <input style={input} list="areas-acta" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="Ej. Contabilidad, Tesorería…" />
                  <datalist id="areas-acta">{datos.areas.map((a) => <option key={a.id} value={a.nombre} />)}</datalist>
                </label>
                <label><span style={lbl}>Lugar</span><input style={input} value={form.lugar} onChange={(e) => set('lugar', e.target.value)} placeholder="Oficina del cliente, virtual…" /></label>
              </div>
              <label><span style={lbl}>Objetivo / motivo</span><input style={input} value={form.objetivo} onChange={(e) => set('objetivo', e.target.value)} placeholder="Motivo de la visita…" /></label>

              <ListaEnumerada titulo="Actividades realizadas" hint="lo que hizo el asesor" icono="✅" items={actividades} onChange={setActividades} placeholder="Actividad realizada…" />

              {/* Compromisos */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={secTitle}>🤝 Compromisos ({compromisos.length}) <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· de la firma o del cliente</span></span>
                  <button type="button" className="dbtn" onClick={() => setCompromisos((cs) => [...cs, compromisoVacio()])} style={{ fontSize: 12 }}>＋ Agregar</button>
                </div>
                {compromisos.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Agrega los acuerdos con su responsable, fecha y estado.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {compromisos.map((c, i) => {
                    const esCliente = c.responsableTipo === 'cliente';
                    return (
                      <div key={c.id ?? `n${i}`} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 7, background: 'var(--panel-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input style={input} value={c.descripcion} onChange={(e) => setCompromiso(i, 'descripcion', e.target.value)} onBlur={() => guardarCompromisoExistente(i)} placeholder="Compromiso acordado…" />
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap', color: esCliente ? '#7a5bd0' : 'var(--navy)', background: esCliente ? '#efeafb' : 'var(--info-suave)', borderRadius: 20, padding: '3px 8px' }}>{esCliente ? 'del cliente' : 'de la firma'}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 7, alignItems: 'center' }}>
                          <div style={{ display: 'inline-flex', border: '1px solid var(--edge-strong)', borderRadius: 6, overflow: 'hidden' }}>
                            {(['firma', 'cliente'] as const).map((t) => (
                              <button key={t} type="button" onClick={() => { setCompromiso(i, 'responsableTipo', t); }} onBlur={() => guardarCompromisoExistente(i)}
                                style={{ border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '6px 10px', fontFamily: 'var(--ui)', background: c.responsableTipo === t ? 'var(--navy)' : 'var(--panel)', color: c.responsableTipo === t ? '#fff' : 'var(--muted)' }}>
                                {t === 'firma' ? 'Firma' : 'Cliente'}
                              </button>
                            ))}
                          </div>
                          {esCliente ? (
                            <input style={inputMini} value={c.responsableExterno} onChange={(e) => setCompromiso(i, 'responsableExterno', e.target.value)} onBlur={() => guardarCompromisoExistente(i)} placeholder="Nombre y cargo (externo)…" />
                          ) : (
                            <select style={inputMini} value={c.responsableId} onChange={(e) => setCompromiso(i, 'responsableId', e.target.value)} onBlur={() => guardarCompromisoExistente(i)}>
                              <option value="">— Responsable de la firma —</option>
                              {datos.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                            </select>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px 30px', gap: 7, alignItems: 'center' }}>
                          <input type="date" style={inputMini} value={c.fechaLimite} onChange={(e) => setCompromiso(i, 'fechaLimite', e.target.value)} onBlur={() => guardarCompromisoExistente(i)} title="Fecha límite" />
                          <input style={inputMini} list="areas-acta" value={c.area} onChange={(e) => setCompromiso(i, 'area', e.target.value)} onBlur={() => guardarCompromisoExistente(i)} placeholder="Área" title="Área" />
                          <select style={inputMini} value={c.estado} onChange={(e) => setCompromiso(i, 'estado', e.target.value)} onBlur={() => guardarCompromisoExistente(i)} title="Estado">
                            {COMPROMISO_ESTADOS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
                          </select>
                          <button type="button" onClick={() => eliminarCompromiso(i)} title="Quitar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--peligro)', fontSize: 15 }}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ListaEnumerada titulo="Recomendaciones / sugerencias" hint="enumeradas" icono="💡" items={recomendaciones} onChange={setRecomendaciones} placeholder="Recomendación…" />
              <ListaEnumerada titulo="Observaciones" hint="enumeradas" icono="📝" items={observaciones} onChange={setObservaciones} placeholder="Observación…" />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                {editar ? <button className="dbtn" onClick={eliminarVisita} disabled={guardando} style={{ fontSize: 13, color: 'var(--peligro)', borderColor: 'var(--peligro-suave)' }}>Eliminar</button> : <span />}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="dbtn" onClick={cerrar} style={{ fontSize: 13 }}>Cancelar</button>
                  <button className="dbtn" onClick={imprimirActa} style={{ fontSize: 13 }}>🖨 Imprimir acta</button>
                  <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : editar ? 'Guardar acta' : 'Agendar visita'}</button>
                </div>
              </div>
              {editar && <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>Los compromisos se guardan al salir de cada campo; las listas del acta, con “Guardar acta”. Guarda antes de imprimir para el acta definitiva.</p>}
            </>
          )}
        </div>
    </ModalMarco>
  );
}
