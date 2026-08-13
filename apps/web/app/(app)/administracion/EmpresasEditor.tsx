'use client';
// Empresas / Clientes: alta, edición (datos operativos y correos de contacto),
// activar/desactivar y borrado. Contra la API vía /api/admin/empresas.

import { useEffect, useState, useCallback } from 'react';
import { descargarXlsx, hoyISO } from './exportar';
import DocumentosCliente, { fmtBytes } from './DocumentosCliente';
import { useCierreDeFondo } from '@/app/_components/ModalMarco';

type Empresa = {
  id: string; nombre: string; nit: string | null; servicio: string | null; asesorNombre: string | null; activo: boolean; grupoId: string | null;
  tipoId: string | null; regimenId: string | null;
  tipo?: { nombre: string } | null; regimen?: { nombre: string } | null;
  emailRepresentante: string | null; emailAdministracion: string | null; emailContabilidad: string | null; emailTalentoHumano: string | null; emailTesoreria: string | null;
  almacenBytes?: number; almacenDocs?: number;
};
type Grupo = { id: string; nombre: string };
type Form = Omit<Empresa, 'id' | 'activo' | 'tipo' | 'regimen'> & { activo: boolean };

const EMAILS: { k: keyof Form; label: string }[] = [
  { k: 'emailRepresentante', label: 'Representante' },
  { k: 'emailAdministracion', label: 'Administración' },
  { k: 'emailContabilidad', label: 'Contabilidad' },
  { k: 'emailTalentoHumano', label: 'Talento humano' },
  { k: 'emailTesoreria', label: 'Tesorería' },
];
const vacio = (): Form => ({ nombre: '', nit: '', servicio: '', asesorNombre: '', activo: true, grupoId: '', tipoId: '', regimenId: '', emailRepresentante: '', emailAdministracion: '', emailContabilidad: '', emailTalentoHumano: '', emailTesoreria: '' });
const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };

export default function EmpresasEditor() {
  const [items, setItems] = useState<Empresa[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [tipos, setTipos] = useState<Grupo[]>([]);
  const [regimenes, setRegimenes] = useState<Grupo[]>([]);
  const [servicios, setServicios] = useState<Grupo[]>([]);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editar, setEditar] = useState<Empresa | 'nuevo' | null>(null);
  const nombreGrupo = (gid: string | null) => grupos.find((g) => g.id === gid)?.nombre ?? null;

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const res = await fetch(`/api/admin/empresas${incluirInactivos ? '?incluirInactivos=1' : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []); else setError(data.error || 'No se pudo cargar.');
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, [incluirInactivos]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const cat = (t: string, set: (v: Grupo[]) => void) =>
      fetch(`/api/admin/catalogos/${t}`, { cache: 'no-store' }).then((r) => r.json()).then((d) => set(d.items ?? [])).catch(() => {});
    cat('grupos', setGrupos); cat('tipos-empresa', setTipos); cat('regimenes', setRegimenes);
    cat('tipos-servicio', setServicios);
  }, []);

  async function toggleActivo(e: Empresa) {
    const res = await fetch(`/api/admin/empresas/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !e.activo }) });
    if (res.ok) { if (!incluirInactivos && e.activo) setItems((p) => p.filter((x) => x.id !== e.id)); else setItems((p) => p.map((x) => (x.id === e.id ? { ...x, activo: !e.activo } : x))); }
    else { const d = await res.json(); setError(d.error || 'No se pudo cambiar el estado.'); }
  }
  async function eliminar(e: Empresa) {
    if (!confirm(`¿Eliminar a "${e.nombre}"? Si tiene tareas/pagos, mejor desactívalo.`)) return;
    const res = await fetch(`/api/admin/empresas/${e.id}`, { method: 'DELETE' });
    if (res.ok) setItems((p) => p.filter((x) => x.id !== e.id));
    else { const d = await res.json(); setError(d.error || 'No se pudo eliminar.'); }
  }

  const filtrada = items.filter((e) => !q || `${e.nombre} ${e.nit ?? ''} ${e.asesorNombre ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  async function descargar() {
    const encabezado = ['Cliente', 'NIT', 'Tipo', 'Servicio', 'Grupo', 'Asesor', 'Régimen', 'Activo',
      'Email representante', 'Email administración', 'Email contabilidad', 'Email talento humano', 'Email tesorería'];
    const filas = filtrada.map((e) => [
      e.nombre, e.nit ?? '', e.tipo?.nombre ?? '', e.servicio ?? '', nombreGrupo(e.grupoId) ?? '', e.asesorNombre ?? '', e.regimen?.nombre ?? '', e.activo ? 'Sí' : 'No',
      e.emailRepresentante ?? '', e.emailAdministracion ?? '', e.emailContabilidad ?? '', e.emailTalentoHumano ?? '', e.emailTesoreria ?? '',
    ]);
    try {
      await descargarXlsx(`clientes-cerpat-${hoyISO()}.xlsx`, [{ nombre: 'Clientes', filas: [encabezado, ...filas] }]);
    } catch { setError('No se pudo generar el Excel.'); }
  }

  return (
    <div>
      {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input style={{ ...input, maxWidth: 280 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, NIT o asesor…" />
        <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <input type="checkbox" checked={incluirInactivos} onChange={(e) => setIncluirInactivos(e.target.checked)} /> Incluir inactivos
        </label>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 'auto' }}>{filtrada.length} cliente(s)</span>
        <button className="dbtn" onClick={descargar} disabled={cargando || filtrada.length === 0} style={{ fontSize: 13 }} title="Descarga el listado de clientes (según el filtro actual) en Excel">⬇ Descargar Excel</button>
        <button className="dbtn primary" onClick={() => setEditar('nuevo')} style={{ fontSize: 13 }}>＋ Nuevo cliente</button>
      </div>

      <div className="panel">
        <div className="dt-wrap dt-alta">
          <table className="dt">
            <thead><tr><th>Cliente</th><th>NIT</th><th>Tipo</th><th>Servicio</th><th>Grupo</th><th>Asesor</th><th>Régimen</th><th style={{ whiteSpace: 'nowrap' }}>Almacenamiento</th><th>Activo</th><th>Acciones</th></tr></thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
              ) : filtrada.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin clientes.</td></tr>
              ) : filtrada.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.nombre}</td>
                  <td style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12.5 }}>{e.nit ?? '—'}</td>
                  {/* Sin tipo no se puede saber la naturaleza jurídica, y de ahí
                      dependen el RUB, el revisor fiscal y el 368-2. No es un
                      hueco cosmético: se marca. */}
                  <td style={{ color: e.tipo?.nombre ? 'var(--muted)' : 'var(--peligro)', fontWeight: e.tipo?.nombre ? 400 : 700 }}>
                    {e.tipo?.nombre ?? 'sin tipo'}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{e.servicio ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{nombreGrupo(e.grupoId) ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{e.asesorNombre ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{e.regimen?.nombre ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', color: (e.almacenBytes ?? 0) > 0 ? 'var(--ink)' : 'var(--muted)', fontSize: 12.5 }}>{(e.almacenBytes ?? 0) > 0 ? `${fmtBytes(e.almacenBytes ?? 0)} · ${e.almacenDocs ?? 0} doc` : '—'}</td>
                  <td><button onClick={() => toggleActivo(e)} title={e.activo ? 'Activo' : 'Inactivo'} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>{e.activo ? '🟢' : '⚪'}</button></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditar(e)} title="Editar" style={ic('var(--navy)')}>✎</button>
                    <button onClick={() => eliminar(e)} title="Eliminar" style={ic('var(--peligro)')}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editar && <Editor empresa={editar} grupos={grupos} tipos={tipos} regimenes={regimenes} servicios={servicios} onClose={() => { setEditar(null); cargar(); }} onGuardado={() => { setEditar(null); cargar(); }} onError={setError} />}
    </div>
  );
}

const ic = (color: string): React.CSSProperties => ({ border: 'none', background: 'none', cursor: 'pointer', color, fontSize: 14, padding: '2px 5px' });

function Editor({ empresa, grupos, tipos, regimenes, servicios, onClose, onGuardado, onError }: { empresa: Empresa | 'nuevo'; grupos: Grupo[]; tipos: Grupo[]; regimenes: Grupo[]; servicios: Grupo[]; onClose: () => void; onGuardado: () => void; onError: (m: string) => void }) {
  const nuevo = empresa === 'nuevo';
  const [form, setForm] = useState<Form>(nuevo ? vacio() : {
    nombre: empresa.nombre, nit: empresa.nit ?? '', servicio: empresa.servicio ?? '', asesorNombre: empresa.asesorNombre ?? '', activo: empresa.activo, grupoId: empresa.grupoId ?? '',
    tipoId: empresa.tipoId ?? '', regimenId: empresa.regimenId ?? '',
    emailRepresentante: empresa.emailRepresentante ?? '', emailAdministracion: empresa.emailAdministracion ?? '', emailContabilidad: empresa.emailContabilidad ?? '', emailTalentoHumano: empresa.emailTalentoHumano ?? '', emailTesoreria: empresa.emailTesoreria ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof Form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    if (!form.nombre.trim()) { onError('El nombre del cliente es obligatorio.'); return; }
    setGuardando(true);
    try {
      const url = nuevo ? '/api/admin/empresas' : `/api/admin/empresas/${(empresa as Empresa).id}`;
      const res = await fetch(url, { method: nuevo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) { onError(d.error || 'No se pudo guardar.'); setGuardando(false); return; }
      onGuardado();
    } catch { onError('Error de red.'); setGuardando(false); }
  }

  // No cerrar si el clic empezó DENTRO de la ventana: arrastrar para
  // seleccionar el texto de una casilla y soltar afuera cerraba el modal y
  // se perdía lo escrito.
  const cierreDeFondo = useCierreDeFondo(onClose);

  return (
    <div {...cierreDeFondo} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: nuevo ? 520 : 660, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="win-bar"><span className="win-title">{nuevo ? 'Nuevo cliente' : 'Editar cliente'}</span>
          <div className="win-ctl"><button className="close" onClick={onClose} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
        </div>
        <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label><span style={lbl}>Nombre *</span><input style={input} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label><span style={lbl}>NIT</span><input style={input} value={form.nit ?? ''} onChange={(e) => set('nit', e.target.value)} /></label>
            <label><span style={lbl}>Servicio</span>
              <select style={input} value={form.servicio ?? ''} onChange={(e) => set('servicio', e.target.value)}>
                <option value="">— Sin servicio —</option>
                {/* El servicio que ya tiene el cliente se ofrece aunque no esté
                    en el catálogo: si no, abrir la ficha para corregir el NIT le
                    cambiaría el servicio sin que nadie lo pidiera. */}
                {form.servicio && !servicios.some((x) => x.nombre === form.servicio) && (
                  <option value={form.servicio}>{form.servicio} (fuera del catálogo)</option>
                )}
                {servicios.map((x) => <option key={x.id} value={x.nombre}>{x.nombre}</option>)}
              </select>
            </label>
          </div>
          {/* El tipo de empresa no es un dato descriptivo: de él salen el RUB,
              el revisor fiscal y el 368-2. Sin él esas reglas no se evalúan. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label><span style={lbl}>Tipo de empresa</span>
              <select style={{ ...input, ...(form.tipoId ? {} : { borderColor: 'var(--peligro-borde)' }) }} value={form.tipoId ?? ''} onChange={(e) => set('tipoId', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </label>
            <label><span style={lbl}>Régimen tributario</span>
              <select style={input} value={form.regimenId ?? ''} onChange={(e) => set('regimenId', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {regimenes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </label>
          </div>
          {!form.tipoId && (
            <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12, lineHeight: 1.55, marginTop: -4 }}>
              Sin tipo de empresa no se puede determinar la naturaleza jurídica, y de ella dependen el <strong>RUB</strong>,
              el <strong>revisor fiscal</strong> y el <strong>art. 368-2</strong>. Después de asignarlo, regenera sus
              vencimientos en <em>Config. tributaria</em>.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label><span style={lbl}>Asesor (nombre)</span><input style={input} value={form.asesorNombre ?? ''} onChange={(e) => set('asesorNombre', e.target.value)} /></label>
            <label><span style={lbl}>Grupo empresarial</span>
              <select style={input} value={form.grupoId ?? ''} onChange={(e) => set('grupoId', e.target.value)}>
                <option value="">— Sin grupo —</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </label>
          </div>
          <div>
            <span style={lbl}>Correos de contacto</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {EMAILS.map((em) => (
                <label key={em.k}><span style={{ ...lbl, fontSize: 10.5 }}>{em.label}</span><input type="email" style={{ ...input, padding: '6px 8px' }} value={(form[em.k] as string) ?? ''} onChange={(e) => set(em.k, e.target.value)} /></label>
              ))}
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} /> Cliente activo
          </label>

          {!nuevo && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 2 }}>
              <span style={{ ...lbl, fontSize: 12.5, marginBottom: 8 }}>Documentos y almacenamiento</span>
              <DocumentosCliente empresaId={(empresa as Empresa).id} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="dbtn" onClick={onClose} style={{ fontSize: 13 }}>Cancelar</button>
            <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : nuevo ? 'Crear cliente' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
