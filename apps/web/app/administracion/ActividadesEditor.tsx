'use client';
// Cat. Tareas: catálogo de actividades del plan (ActividadPlan) + sus subtareas
// plantilla. Maestro-detalle: lista a la izquierda, formulario a la derecha.
// Todo contra la API (proxy /api/admin/...), permisos validados en el backend.

import { useEffect, useState, useCallback } from 'react';

type ActLista = {
  id: string; codigo: string; nombre: string; area: string | null; areaId: string | null;
  grupo: string | null; periodicidad: string | null; orden: number; activo: boolean;
  esRegistroSoftware: boolean; requiereAuditoria: boolean; generaPago: boolean;
  subtareas: number; tareas: number;
};
type Sub = { id: string; texto: string; orden: number };
type Area = { id: string; nombre: string };
type Form = {
  codigo: string; nombre: string; areaId: string; grupo: string; periodicidad: string;
  documentoFormato: string; descripcion: string; orden: string;
  generaPago: boolean; requiereAuditoria: boolean; esRegistroSoftware: boolean; activo: boolean;
  obligacionVencimiento: string; fase: string;
};

const VACIO: Form = {
  codigo: '', nombre: '', areaId: '', grupo: '', periodicidad: '', documentoFormato: '', descripcion: '', orden: '0',
  generaPago: false, requiereAuditoria: false, esRegistroSoftware: false, activo: true,
  obligacionVencimiento: '', fase: '',
};

// Fase en la cadena del cierre (la captura del auxiliar habilita el procesamiento del asesor).
const FASES: { key: string; label: string }[] = [
  { key: '', label: 'Sin clasificar' },
  { key: 'captura', label: 'Captura (insumo · auxiliar)' },
  { key: 'procesamiento', label: 'Procesamiento (asesor)' },
  { key: 'revision', label: 'Revisión' },
];

// Vincula el checklist de una actividad a un vencimiento tributario. La clave
// (value) se guarda en ActividadPlan.obligacionVencimiento; el generador la usa
// para heredar las subtareas al vencimiento. Debe coincidir con VINCULOS_VENCIMIENTO
// del backend (apps/api/src/vencimientos/vinculos.ts).
const VINCULOS: { key: string; label: string }[] = [
  { key: '', label: 'Ninguno (no es un vencimiento)' },
  { key: 'retencion_fuente', label: 'Retención en la fuente' },
  { key: 'iva', label: 'IVA' },
  { key: 'consumo', label: 'Impuesto al consumo' },
  { key: 'anticipo_rst', label: 'Anticipo RST' },
  { key: 'renta', label: 'Declaración de renta (PJ / GC / PN)' },
  { key: 'consolidada_rst', label: 'Consolidada RST (Renta)' },
  { key: 'fopat', label: 'FOPAT' },
  { key: 'nomina_electronica', label: 'Nómina electrónica' },
  { key: 'pila', label: 'Seguridad social (PILA)' },
  { key: 'rub', label: 'RUB (Registro Único de Beneficiarios)' },
  { key: 'ica', label: 'ICA (Industria y comercio)' },
  { key: 'reteica', label: 'ReteICA' },
  { key: 'autoica', label: 'AutoICA' },
];

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };

export default function ActividadesEditor() {
  const [lista, setLista] = useState<ActLista[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [sel, setSel] = useState<string | 'nueva' | null>(null);
  const [form, setForm] = useState<Form>(VACIO);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [q, setQ] = useState('');
  const [areaFiltro, setAreaFiltro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nuevaSub, setNuevaSub] = useState('');

  const cargarLista = useCallback(async () => {
    const res = await fetch('/api/admin/actividades', { cache: 'no-store' });
    const data = await res.json();
    if (res.ok) setLista(data.items ?? []);
    else setError(data.error || 'No se pudo cargar el catálogo.');
  }, []);

  useEffect(() => {
    cargarLista();
    fetch('/api/admin/catalogos/areas', { cache: 'no-store' }).then((r) => r.json()).then((d) => setAreas(d.items ?? [])).catch(() => {});
  }, [cargarLista]);

  async function seleccionar(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/actividades/${id}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'No se pudo cargar.'); return; }
    const a = data.actividad;
    setSel(id);
    setForm({
      codigo: a.codigo ?? '', nombre: a.nombre ?? '', areaId: a.areaId ?? '', grupo: a.grupo ?? '',
      periodicidad: a.periodicidad ?? '', documentoFormato: a.documentoFormato ?? '', descripcion: a.descripcion ?? '',
      orden: String(a.orden ?? 0), generaPago: !!a.generaPago, requiereAuditoria: !!a.requiereAuditoria,
      esRegistroSoftware: !!a.esRegistroSoftware, activo: a.activo !== false,
      obligacionVencimiento: a.obligacionVencimiento ?? '', fase: a.fase ?? '',
    });
    setSubs(a.subtareas ?? []);
  }

  function nueva() { setSel('nueva'); setForm(VACIO); setSubs([]); setError(null); }

  async function guardar() {
    if (!form.codigo.trim() || !form.nombre.trim()) { setError('Código y nombre son obligatorios.'); return; }
    setGuardando(true); setError(null);
    const payload = { ...form, orden: form.orden === '' ? 0 : Number(form.orden) };
    try {
      if (sel === 'nueva') {
        const res = await fetch('/api/admin/actividades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'No se pudo crear.'); setGuardando(false); return; }
        await cargarLista();
        await seleccionar(data.id);
      } else if (sel) {
        const res = await fetch(`/api/admin/actividades/${sel}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'No se pudo guardar.'); setGuardando(false); return; }
        await cargarLista();
      }
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  async function eliminar() {
    if (sel === 'nueva' || !sel) return;
    if (!confirm(`¿Eliminar la actividad "${form.codigo} — ${form.nombre}"?`)) return;
    const res = await fetch(`/api/admin/actividades/${sel}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'No se pudo eliminar.'); return; }
    setSel(null); await cargarLista();
  }

  async function addSub() {
    const texto = nuevaSub.trim();
    if (!texto || sel === 'nueva' || !sel) return;
    const res = await fetch(`/api/admin/actividades/${sel}/subtareas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, orden: subs.length }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'No se pudo agregar la subtarea.'); return; }
    setSubs((p) => [...p, data.subtarea]); setNuevaSub('');
  }
  async function editSub(s: Sub, texto: string) {
    if (!sel || sel === 'nueva' || texto.trim() === s.texto || !texto.trim()) return;
    const res = await fetch(`/api/admin/actividades/${sel}/subtareas/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: texto.trim() }) });
    if (res.ok) setSubs((p) => p.map((x) => (x.id === s.id ? { ...x, texto: texto.trim() } : x)));
  }
  async function delSub(s: Sub) {
    if (!sel || sel === 'nueva') return;
    const res = await fetch(`/api/admin/actividades/${sel}/subtareas/${s.id}`, { method: 'DELETE' });
    if (res.ok) setSubs((p) => p.filter((x) => x.id !== s.id));
  }

  const filtrada = lista.filter((a) =>
    (!areaFiltro || a.areaId === areaFiltro) &&
    (!q || `${a.codigo} ${a.nombre}`.toLowerCase().includes(q.toLowerCase())));

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'start' }}>
      {/* Lista */}
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input style={{ ...input, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código o nombre…" />
          <button className="dbtn primary" onClick={nueva} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>＋ Nueva</button>
        </div>
        <select style={{ ...input, marginBottom: 8 }} value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)}>
          <option value="">Todas las áreas</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <div className="panel" style={{ maxHeight: 460, overflowY: 'auto' }}>
          {filtrada.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>Sin actividades.</div>
          ) : filtrada.map((a) => (
            <button key={a.id} onClick={() => seleccionar(a.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--line)', background: sel === a.id ? 'rgba(46,80,144,0.10)' : 'transparent', cursor: 'pointer', padding: '9px 12px', fontFamily: 'var(--ui)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)' }}>{a.codigo}</span>
                {!a.activo && <span style={{ fontSize: 9.5, color: '#cf4436', fontWeight: 700 }}>inactiva</span>}
                {a.generaPago && <span title="Genera pago" style={{ marginLeft: 'auto', fontSize: 11 }}>💲</span>}
                {a.requiereAuditoria && <span title="Requiere auditoría" style={{ fontSize: 11 }}>🛡</span>}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{a.nombre}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{a.area ?? 'Sin área'} · {a.subtareas} subt. · {a.tareas} tareas</div>
            </button>
          ))}
        </div>
      </div>

      {/* Detalle */}
      <div>
        {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
        {sel == null ? (
          <div className="panel" style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Selecciona una actividad o crea una nueva para editar sus datos y subtareas.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
              <label style={{ gridColumn: '1 / 2' }}><span style={lbl}>Código</span><input style={input} value={form.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="IN-01" /></label>
              <label style={{ gridColumn: '2 / 3' }}><span style={lbl}>Nombre</span><input style={input} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Nombre de la actividad" /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label><span style={lbl}>Área</span>
                <select style={input} value={form.areaId} onChange={(e) => set('areaId', e.target.value)}>
                  <option value="">Sin área</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </label>
              <label><span style={lbl}>Grupo</span><input style={input} value={form.grupo} onChange={(e) => set('grupo', e.target.value)} placeholder="Impuestos DIAN…" /></label>
              <label><span style={lbl}>Periodicidad</span><input style={input} value={form.periodicidad} onChange={(e) => set('periodicidad', e.target.value)} placeholder="Mensual…" /></label>
              <label><span style={lbl}>Documento / formato</span><input style={input} value={form.documentoFormato} onChange={(e) => set('documentoFormato', e.target.value)} /></label>
            </div>
            <label><span style={lbl}>Descripción</span><textarea rows={2} style={{ ...input, resize: 'vertical' }} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></label>

            <label>
              <span style={lbl}>Fase en el flujo del cierre</span>
              <select style={input} value={form.fase} onChange={(e) => set('fase', e.target.value)}>
                {FASES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                La <b>captura</b> (auxiliar) habilita el <b>procesamiento</b> (asesor). Sin clasificar = no participa del bloqueo del flujo.
              </span>
            </label>

            <label>
              <span style={lbl}>Vincular al vencimiento (hereda el checklist)</span>
              <select style={input} value={form.obligacionVencimiento} onChange={(e) => set('obligacionVencimiento', e.target.value)}>
                {VINCULOS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Si eliges un vencimiento, sus subtareas se copiarán al abrirlo en el calendario para darles ✔. La declaración se controla en Vencimientos (no se duplica como tarea del plan).
              </span>
            </label>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={chk}><input type="checkbox" checked={form.generaPago} onChange={(e) => set('generaPago', e.target.checked)} /> Genera pago</label>
              <label style={chk}><input type="checkbox" checked={form.requiereAuditoria} onChange={(e) => set('requiereAuditoria', e.target.checked)} /> Requiere auditoría</label>
              <label style={chk}><input type="checkbox" checked={form.esRegistroSoftware} onChange={(e) => set('esRegistroSoftware', e.target.checked)} /> Registro en software</label>
              <label style={chk}><input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} /> Activa</label>
              <label style={{ ...chk, marginLeft: 'auto' }}>Orden <input type="number" style={{ ...input, width: 70, padding: '5px 8px' }} value={form.orden} onChange={(e) => set('orden', e.target.value)} /></label>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : sel === 'nueva' ? 'Crear actividad' : 'Guardar cambios'}</button>
              {sel !== 'nueva' && <button className="dbtn" onClick={eliminar} style={{ fontSize: 13, color: '#cf4436' }}>Eliminar</button>}
            </div>

            {/* Subtareas plantilla */}
            <div style={{ marginTop: 6 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: '0 0 8px' }}>Subtareas plantilla</h3>
              {sel === 'nueva' ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Guarda la actividad primero para agregarle subtareas.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input style={{ ...input, flex: 1 }} value={nuevaSub} onChange={(e) => setNuevaSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSub(); }} placeholder="Nueva subtarea…" />
                    <button className="dbtn" onClick={addSub} disabled={!nuevaSub.trim()} style={{ fontSize: 12.5 }}>＋ Agregar</button>
                  </div>
                  {subs.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Sin subtareas plantilla.</p>
                  ) : (
                    <div className="panel">
                      {subs.map((s, i) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: i < subs.length - 1 ? '1px solid var(--line)' : 'none' }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)', width: 18 }}>{i + 1}</span>
                          <input defaultValue={s.texto} onBlur={(e) => editSub(s, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={{ ...input, flex: 1, padding: '5px 8px' }} />
                          <button onClick={() => delSub(s)} title="Eliminar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cf4436', fontSize: 14 }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };
const chk: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
