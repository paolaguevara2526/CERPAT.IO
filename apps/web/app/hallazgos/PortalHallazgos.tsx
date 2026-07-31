'use client';
// Portal de Hallazgos: consolidado (grupo/revisor), detalle por empresa y —para
// el revisor— edición de la matriz. Todo contra /api/portal/... con el
// aislamiento validado en el backend.

import { useEffect, useState, useCallback, useRef } from 'react';
import HallazgoModal from './HallazgoModal';
import { toCSV, parseCSV, descargar, normRiesgo, normPrioridad, normEstado, normFecha } from './csv';

export type Empresa = { id: string; nombre: string; grupo: string | null };
export type Hallazgo = {
  id: string; empresaId: string; empresa: string | null; area: string | null; titulo: string; descripcion: string | null;
  normatividad: string | null; riesgo: string; riesgoDescripcion: string | null; prioridad: string; responsable: string | null; planAccion: string | null;
  plazo: string | null; estado: string; observaciones: string | null; vencido: boolean;
};
type Resumen = { kpis: { total: number; resueltos: number; enGestion: number; vencidos: number; pct: number } | null; porEmpresa: { empresaId: string; empresa: string; total: number; resueltos: number; enGestion: number; vencidos: number; pct: number }[] };

export const ESTADO_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#5b6a82' },
  en_gestion: { label: 'En gestión', color: '#2f6fd0' },
  resuelto: { label: 'Resuelto', color: '#22a670' },
};
export const RIESGO_META: Record<string, { label: string; color: string }> = {
  alto: { label: 'Alto', color: '#cf4436' }, medio: { label: 'Medio', color: '#c67c00' }, bajo: { label: 'Bajo', color: '#22a670' },
};
const PRIORIDAD_LABEL: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const PROGRAMA_KEY = 'cerpat:hallazgos:programa'; // compañías con gestión de hallazgos (localStorage)

function colorPct(p: number) { return p >= 85 ? '#22a670' : p >= 60 ? '#c67c00' : '#cf4436'; }
function fmtFecha(iso: string | null) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } }

export default function PortalHallazgos({ esGestor }: { esGestor: boolean }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Hallazgo | 'nuevo' | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'resuelto' | 'en_gestion' | 'vencido'>('todos');
  const [importando, setImportando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [pegar, setPegar] = useState<string | null>(null); // null = cerrado; string = texto pegado
  const fileRef = useRef<HTMLInputElement>(null);
  // Programa de hallazgos: qué compañías se gestionan (revisoría fiscal u
  // outsourcing). Se guarda en el navegador; null = aún sin cargar de localStorage.
  const [programa, setPrograma] = useState<string[] | null>(null);
  const programaCargado = useRef(false);
  const [agregando, setAgregando] = useState(false);
  const [busquedaAgregar, setBusquedaAgregar] = useState('');

  const cargarBase = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const [re, rr] = await Promise.all([
        fetch('/api/portal/empresas', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/portal/resumen', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (re.error) { setError(re.error); setCargando(false); return; }
      const emps: Empresa[] = re.empresas ?? [];
      setEmpresas(emps);
      setResumen(rr.kpis !== undefined ? rr : null);
      if (emps.length === 1) setSel(emps[0].id);
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);

  const cargarHallazgos = useCallback(async (empresaId: string) => {
    const r = await fetch(`/api/portal?empresaId=${encodeURIComponent(empresaId)}`, { cache: 'no-store' });
    const d = await r.json();
    if (r.ok) setHallazgos(d.hallazgos ?? []); else setError(d.error || 'No se pudieron cargar los hallazgos.');
  }, []);

  useEffect(() => { cargarBase(); }, [cargarBase]);
  useEffect(() => { if (sel) cargarHallazgos(sel); }, [sel, cargarHallazgos]);

  // Carga el programa guardado en el navegador (una vez).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROGRAMA_KEY);
      if (raw != null) { setPrograma(JSON.parse(raw)); programaCargado.current = true; }
    } catch { /* localStorage no disponible */ }
  }, []);

  // Semilla la primera vez (sin nada guardado): incluye las compañías que ya
  // tienen hallazgos, para no "esconder" lo que ya existe.
  useEffect(() => {
    if (programaCargado.current || programa !== null || !resumen) return;
    const seed = resumen.porEmpresa.filter((x) => x.total > 0).map((x) => x.empresaId);
    programaCargado.current = true;
    setPrograma(seed);
    try { localStorage.setItem(PROGRAMA_KEY, JSON.stringify(seed)); } catch { /* ignore */ }
  }, [resumen, programa]);

  function guardarPrograma(next: string[]) {
    setPrograma(next);
    try { localStorage.setItem(PROGRAMA_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  const agregarAlPrograma = (id: string) => { if (programa && !programa.includes(id)) guardarPrograma([...programa, id]); };
  const retirarDelPrograma = (id: string) => { if (programa) guardarPrograma(programa.filter((x) => x !== id)); };

  async function cambiarEstado(h: Hallazgo, estado: string) {
    const prev = hallazgos;
    setHallazgos((p) => p.map((x) => (x.id === h.id ? { ...x, estado, vencido: estado !== 'resuelto' && x.vencido } : x)));
    const r = await fetch(`/api/portal/${h.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
    if (!r.ok) { setHallazgos(prev); const d = await r.json(); setError(d.error || 'No se pudo cambiar el estado.'); }
    else cargarBase();
  }
  async function eliminar(h: Hallazgo) {
    if (!confirm(`¿Eliminar el hallazgo "${h.titulo}"?`)) return;
    const r = await fetch(`/api/portal/${h.id}`, { method: 'DELETE' });
    if (r.ok) { setHallazgos((p) => p.filter((x) => x.id !== h.id)); cargarBase(); }
    else { const d = await r.json(); setError(d.error || 'No se pudo eliminar.'); }
  }

  const CSV_HEAD = ['Hallazgo', 'Descripción', 'Normatividad', 'Área', 'Riesgo', 'Descripción del riesgo', 'Prioridad', 'Responsable', 'Plan de acción', 'Plazo', 'Estado', 'Observaciones'];

  function plantilla() {
    const ejemplo = ['Ej: Conciliación bancaria pendiente', 'Descripción de la situación', 'Art. 000', 'Tesorería', 'alto', 'Impacto o consecuencia del riesgo', 'alta', 'Nombre del responsable', 'Plan de remediación', '2026-08-31', 'pendiente', 'Observación de seguimiento'];
    descargar('plantilla-hallazgos.csv', toCSV([CSV_HEAD, ejemplo]));
  }

  function exportar(empresaNombre: string) {
    const rows = [CSV_HEAD, ...hallazgos.map((h) => [
      h.titulo, h.descripcion, h.normatividad, h.area, h.riesgo, h.riesgoDescripcion, h.prioridad, h.responsable, h.planAccion,
      h.plazo ? h.plazo.slice(0, 10) : '', h.estado, h.observaciones,
    ])];
    descargar(`hallazgos-${empresaNombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, toCSV(rows));
  }

  // Convierte filas (encabezado + datos) en hallazgos y los sube.
  async function procesarFilas(filas: string[][]) {
    if (!sel) return;
    if (filas.length < 2) { setError('No hay filas de datos (recuerda incluir la fila de encabezados).'); return; }
    const head = filas[0].map((h) => h.trim().toLowerCase());
    const col = (n: string) => head.findIndex((h) => h.includes(n));
    const iTit = col('hallazgo') >= 0 ? col('hallazgo') : 0;
    // Columna dedicada de descripción del riesgo (p. ej. "Descripción del riesgo"
    // o "Riesgo (impacto)"); la columna de nivel es cualquier otra que diga "riesgo".
    const iRiesgoDesc = head.findIndex((h) => h.includes('riesgo') && (h.includes('descrip') || h.includes('impacto') || h.includes('detalle')));
    const iRiesgoNivel = head.findIndex((h, i) => h.includes('riesgo') && i !== iRiesgoDesc);
    const idx = { desc: col('descrip'), norm: col('normativ'), area: col('área') >= 0 ? col('área') : col('area'), prio: col('prioridad'), resp: col('responsable'), plan: col('plan'), plazo: col('plazo'), estado: col('estado'), obs: col('observ') };
    const val = (f: string[], i: number) => (i >= 0 && f[i] != null ? String(f[i]) : '');
    const items = filas.slice(1)
      .filter((f) => f.some((v) => (v ?? '').trim() !== '')) // solo descarta filas totalmente vacías
      .map((f) => {
        const desc = val(f, idx.desc);
        // Se permiten celdas en blanco. Si falta el título, se usa la descripción
        // o un marcador, para no perder la fila.
        const titulo = val(f, iTit).trim() || desc.trim().slice(0, 120) || '(Sin título)';
        // La columna "Riesgo" puede traer un nivel (Alto/Medio/Bajo) o un párrafo
        // que describe el riesgo. Si es párrafo, se conserva como descripción y el
        // nivel queda por defecto (Medio); la severidad suele ir en "Prioridad".
        const riesgoRaw = val(f, iRiesgoNivel);
        const esNivel = ['alto', 'medio', 'bajo'].includes(riesgoRaw.trim().toLowerCase());
        const riesgoDescripcion = val(f, iRiesgoDesc).trim() || (esNivel ? '' : riesgoRaw.trim());
        return {
          titulo,
          descripcion: desc, normatividad: val(f, idx.norm), area: val(f, idx.area),
          riesgo: normRiesgo(riesgoRaw), riesgoDescripcion, prioridad: normPrioridad(val(f, idx.prio)),
          responsable: val(f, idx.resp), planAccion: val(f, idx.plan), plazo: normFecha(val(f, idx.plazo)),
          estado: normEstado(val(f, idx.estado)), observaciones: val(f, idx.obs),
        };
      });
    if (items.length === 0) { setError('No hay filas con datos para importar.'); return; }
    const res = await fetch('/api/portal/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresaId: sel, items }) });
    const d = await res.json();
    if (!res.ok) setError(d.error || 'No se pudo importar.');
    else { await cargarHallazgos(sel); cargarBase(); setError(null); alert(`Importados: ${d.creadas} hallazgo(s)${d.omitidas ? `, ${d.omitidas} omitida(s)` : ''}.`); }
  }

  async function importar(file: File) {
    if (!sel) return;
    setImportando(true); setError(null);
    try {
      let filas: string[][];
      if (file.name.toLowerCase().endsWith('.csv')) {
        filas = parseCSV(await file.text());
      } else {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
        filas = aoa.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c == null ? '' : String(c))));
        filas = filas.filter((r) => r.some((v) => v.trim() !== ''));
      }
      await procesarFilas(filas);
    } catch { setError('No se pudo leer el archivo.'); }
    setImportando(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  // Importa desde texto pegado (Excel copia con TAB; también admite CSV).
  async function vaciar() {
    if (!sel) return;
    if (!confirm(`¿Borrar TODOS los hallazgos de ${empresas.find((e) => e.id === sel)?.nombre ?? 'esta empresa'}? Esta acción no se puede deshacer.`)) return;
    setImportando(true); setError(null);
    try {
      const res = await fetch('/api/portal/vaciar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresaId: sel }) });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'No se pudo vaciar.');
      else { await cargarHallazgos(sel); cargarBase(); alert(`Se eliminaron ${d.eliminados} hallazgo(s). Ya puedes reimportar.`); }
    } catch { setError('Error de red.'); }
    setImportando(false);
  }

  async function importarTexto(texto: string) {
    if (!sel || !texto.trim()) return;
    setImportando(true); setError(null);
    try {
      await procesarFilas(parseCSV(texto));
    } catch { setError('No se pudo leer lo pegado.'); }
    setImportando(false);
  }

  if (cargando) return <div style={{ color: 'var(--muted)', padding: 16 }}>Cargando…</div>;
  if (error) return <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>{error}</div>;

  const empresaSel = empresas.find((e) => e.id === sel);
  const multi = empresas.length > 1;

  // ---- Vista consolidada (grupo / revisor con varias empresas) ----
  if (!sel) {
    if (programa === null) return <div style={{ color: 'var(--muted)', padding: 16 }}>Cargando…</div>;
    const enPrograma = new Set(programa);
    const delPrograma = empresas.filter((e) => enPrograma.has(e.id));
    const fueraDelPrograma = empresas.filter((e) => !enPrograma.has(e.id));
    // KPIs recalculados solo con las compañías del programa.
    const filas = (resumen?.porEmpresa ?? []).filter((x) => enPrograma.has(x.empresaId));
    const total = filas.reduce((a, x) => a + x.total, 0);
    const resueltos = filas.reduce((a, x) => a + x.resueltos, 0);
    const enGestion = filas.reduce((a, x) => a + x.enGestion, 0);
    const vencidos = filas.reduce((a, x) => a + x.vencidos, 0);
    const pct = total ? Math.round((resueltos / total) * 100) : 0;
    const opcionesAgregar = fueraDelPrograma.filter((e) => !busquedaAgregar || e.nombre.toLowerCase().includes(busquedaAgregar.toLowerCase()));
    return (
      <>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Estado de hallazgos {empresas[0]?.grupo ? `· ${empresas[0].grupo}` : 'del grupo'}</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>{delPrograma.length} compañía(s) con gestión de hallazgos de la revisoría fiscal. Entra a cualquiera para ver su matriz.</p>
        {delPrograma.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
            <div className="tile"><div className="k">Hallazgos</div><div className="v" style={{ color: 'var(--navy)' }}>{total}</div><div className="s">en total</div></div>
            <div className="tile"><div className="k">Resueltos</div><div className="v" style={{ color: '#22a670' }}>{resueltos}<small>/{total}</small></div><div className="s">{pct}% cerrado</div></div>
            <div className="tile"><div className="k">En gestión</div><div className="v" style={{ color: '#2f6fd0' }}>{enGestion}</div><div className="s">en curso</div></div>
            <div className="tile"><div className="k">Vencidos</div><div className="v" style={{ color: vencidos ? '#cf4436' : '#8a94a6' }}>{vencidos}</div><div className="s">requieren atención</div></div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{esGestor ? 'Selecciona una compañía para gestionar su matriz' : 'Resolución por compañía'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {delPrograma.length > 8 && <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar compañía…" style={{ padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', minWidth: 220 }} />}
            {esGestor && <button className="dbtn primary" onClick={() => { setBusquedaAgregar(''); setAgregando(true); }} style={{ fontSize: 13 }}>＋ Agregar compañía</button>}
          </div>
        </div>
        <div className="panel" style={{ padding: '6px 16px 12px', maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {delPrograma.filter((e) => !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase())).map((e) => {
            const r = resumen?.porEmpresa.find((x) => x.empresaId === e.id);
            const total = r?.total ?? 0;
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)' }}>
                <button onClick={() => setSel(e.id)} style={{ display: 'block', flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: '11px 0', fontFamily: 'var(--ui)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: total ? 6 : 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{e.nombre} <span style={{ marginLeft: 6, color: 'var(--navy)', fontSize: 11 }}>{esGestor ? 'abrir matriz →' : 'ver matriz →'}</span></span>
                    {total > 0
                      ? <span style={{ fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r!.resueltos}/{total} · <strong style={{ color: colorPct(r!.pct) }}>{r!.pct}%</strong>{r!.vencidos > 0 && <span style={{ color: '#cf4436', marginLeft: 8 }}>{r!.vencidos} vencido(s)</span>}</span>
                      : <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>sin hallazgos</span>}
                  </div>
                  {total > 0 && (
                    <div style={{ height: 9, borderRadius: 3, background: 'var(--panel-2)', border: '1px solid var(--line)', overflow: 'hidden', display: 'flex' }}>
                      <span style={{ width: `${(r!.resueltos / total) * 100}%`, background: '#22a670' }} />
                      <span style={{ width: `${(r!.enGestion / total) * 100}%`, background: '#2f6fd0' }} />
                      <span style={{ width: `${(r!.vencidos / total) * 100}%`, background: '#cf4436' }} />
                    </div>
                  )}
                </button>
                {esGestor && <button onClick={() => retirarDelPrograma(e.id)} title="Retirar del programa de hallazgos" style={{ flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15, lineHeight: 1, padding: '6px 8px' }}>✕</button>}
              </div>
            );
          })}
          {delPrograma.length === 0 && (
            <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center', fontSize: 13, lineHeight: 1.5 }}>
              {esGestor ? <>Aún no has agregado compañías al programa de hallazgos.<br />Usa <strong>＋ Agregar compañía</strong> para incluir las de revisoría fiscal (u outsourcing).</> : 'No hay compañías con gestión de hallazgos en tu alcance.'}
            </div>
          )}
        </div>

        {agregando && esGestor && (
          <div onClick={() => setAgregando(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 560 }}>
              <div className="win-bar"><span className="win-title">Agregar compañías al programa de hallazgos</span>
                <div className="win-ctl"><button className="close" onClick={() => setAgregando(false)} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
              </div>
              <div className="win-body" style={{ padding: 18 }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Elige las compañías a las que les vas a gestionar hallazgos (revisoría fiscal u outsourcing). Se agregan al consolidado; las demás quedan fuera.
                </p>
                <input autoFocus value={busquedaAgregar} onChange={(e) => setBusquedaAgregar(e.target.value)} placeholder="Buscar compañía…" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', marginBottom: 10 }} />
                <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 6 }}>
                  {opcionesAgregar.map((e) => (
                    <button key={e.id} onClick={() => agregarAlPrograma(e.id)} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', border: 'none', borderBottom: '1px solid var(--line)', background: 'none', cursor: 'pointer', padding: '10px 12px', fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      <span>{e.nombre}</span><span style={{ color: 'var(--navy)', fontWeight: 700, whiteSpace: 'nowrap' }}>＋ Agregar</span>
                    </button>
                  ))}
                  {opcionesAgregar.length === 0 && <div style={{ padding: 18, color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>{fueraDelPrograma.length === 0 ? 'Todas las compañías ya están en el programa.' : 'Ninguna compañía coincide con la búsqueda.'}</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button className="dbtn primary" onClick={() => setAgregando(false)} style={{ fontSize: 13 }}>Listo</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ---- Detalle por empresa (matriz) ----
  const k = resumen?.porEmpresa.find((e) => e.empresaId === sel);
  const nResueltos = hallazgos.filter((h) => h.estado === 'resuelto').length;
  const nVencidos = hallazgos.filter((h) => h.vencido).length;
  const nGestion = hallazgos.filter((h) => !h.vencido && h.estado !== 'resuelto').length;
  const filtrados = hallazgos.filter((h) => filtro === 'todos' ? true : filtro === 'vencido' ? h.vencido : filtro === 'resuelto' ? h.estado === 'resuelto' : (!h.vencido && h.estado !== 'resuelto'));
  const TABS: { id: typeof filtro; label: string; n: number }[] = [
    { id: 'todos', label: 'Todos', n: hallazgos.length },
    { id: 'resuelto', label: 'Resueltos', n: nResueltos },
    { id: 'en_gestion', label: 'En gestión', n: nGestion },
    { id: 'vencido', label: 'Vencidos', n: nVencidos },
  ];
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        {multi && <button className="dbtn" onClick={() => { setSel(null); setFiltro('todos'); }} style={{ fontSize: 13 }}>‹ Volver</button>}
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{empresaSel?.nombre ?? 'Hallazgos'}</h1>
        <span className="sp" style={{ flex: 1 }} />
        <button className="dbtn" onClick={() => exportar(empresaSel?.nombre ?? 'empresa')} disabled={hallazgos.length === 0} style={{ fontSize: 13 }}>⭳ Exportar</button>
        {esGestor && <>
          <button className="dbtn" onClick={plantilla} style={{ fontSize: 13 }}>Plantilla</button>
          <button className="dbtn" onClick={() => setPegar('')} disabled={importando} style={{ fontSize: 13 }}>⎘ Pegar de Excel</button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); }} />
          <button className="dbtn" onClick={() => fileRef.current?.click()} disabled={importando} style={{ fontSize: 13 }}>{importando ? 'Importando…' : '⭱ Importar'}</button>
          {hallazgos.length > 0 && <button className="dbtn" onClick={vaciar} disabled={importando} style={{ fontSize: 13, color: '#cf4436' }}>🗑 Vaciar</button>}
          <button className="dbtn primary" onClick={() => setModal('nuevo')} style={{ fontSize: 13 }}>＋ Nuevo hallazgo</button>
        </>}
      </div>
      {k && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="tile"><div className="k">Hallazgos</div><div className="v" style={{ color: 'var(--navy)' }}>{k.total}</div><div className="s">de la empresa</div></div>
          <div className="tile"><div className="k">Resueltos</div><div className="v" style={{ color: '#22a670' }}>{k.resueltos}</div><div className="s">{k.pct}% cerrado</div></div>
          <div className="tile"><div className="k">En gestión</div><div className="v" style={{ color: '#2f6fd0' }}>{k.enGestion}</div><div className="s">en curso</div></div>
          <div className="tile"><div className="k">Vencidos</div><div className="v" style={{ color: k.vencidos ? '#cf4436' : '#8a94a6' }}>{k.vencidos}</div><div className="s">requieren atención</div></div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {TABS.map((t) => {
          const on = filtro === t.id;
          return (
            <button key={t.id} onClick={() => setFiltro(t.id)}
              style={{ border: '1px solid var(--edge-strong)', background: on ? 'var(--navy)' : 'var(--panel)', color: on ? '#fff' : 'var(--ink)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--ui)', fontSize: 12.5, fontWeight: 700 }}>
              {t.label} <span style={{ opacity: 0.7, fontWeight: 800 }}>{t.n}</span>
            </button>
          );
        })}
      </div>
      {esGestor && (
        <div
          onDragOver={(e) => { e.preventDefault(); if (!arrastrando) setArrastrando(true); }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastrando(false); }}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); const f = e.dataTransfer.files?.[0]; if (f) importar(f); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `1.5px dashed ${arrastrando ? 'var(--navy)' : 'var(--edge-strong)'}`, background: arrastrando ? 'rgba(46,80,144,0.08)' : 'var(--panel-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' }}
        >
          {importando ? 'Importando…' : arrastrando ? 'Suelta el archivo para importar' : '⭱ Arrastra aquí tu CSV o Excel para importar — o haz clic para elegirlo'}
        </div>
      )}
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="dt" style={{ minWidth: 940 }}>
          <thead><tr>
            <th>Hallazgo</th><th>Descripción</th><th>Normatividad</th><th>Riesgo</th><th>Prioridad</th><th>Responsable</th><th>Plan de acción</th><th>Plazo</th><th>Estado</th><th>Observaciones</th>{esGestor && <th></th>}
          </tr></thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={esGestor ? 11 : 10} style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>{hallazgos.length === 0 ? 'Sin hallazgos registrados para esta empresa.' : 'No hay hallazgos con este filtro.'}</td></tr>
            ) : filtrados.map((h) => {
              const em = ESTADO_META[h.estado] ?? ESTADO_META.pendiente;
              const rm = RIESGO_META[h.riesgo] ?? RIESGO_META.medio;
              return (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600, minWidth: 130 }}>{h.titulo}{h.area && <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>{h.area}</div>}</td>
                  <td style={{ color: 'var(--muted)', minWidth: 180 }}>{h.descripcion ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{h.normatividad ?? '—'}</td>
                  <td style={{ minWidth: 150 }}>
                    <span className="chip" style={{ color: rm.color, background: `${rm.color}18`, borderColor: `${rm.color}44` }}>{rm.label}</span>
                    {h.riesgoDescripcion && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4, fontWeight: 400, whiteSpace: 'pre-wrap' }}>{h.riesgoDescripcion}</div>}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{PRIORIDAD_LABEL[h.prioridad] ?? h.prioridad}</td>
                  <td style={{ color: 'var(--muted)' }}>{h.responsable ?? '—'}</td>
                  <td style={{ color: 'var(--muted)', minWidth: 180 }}>{h.planAccion ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: h.vencido ? 800 : 500, color: h.vencido ? '#cf4436' : 'var(--muted)' }}>{fmtFecha(h.plazo)}</td>
                  <td>
                    {esGestor ? (
                      <select value={h.estado} onChange={(e) => cambiarEstado(h, e.target.value)} style={{ fontSize: 11.5, fontWeight: 700, color: em.color, background: `${em.color}18`, border: `1px solid ${em.color}44`, borderRadius: 4, padding: '4px 6px', fontFamily: 'var(--ui)' }}>
                        {Object.entries(ESTADO_META).map(([kk, v]) => <option key={kk} value={kk} style={{ color: '#111' }}>{v.label}</option>)}
                      </select>
                    ) : (
                      <span className="chip" style={{ color: h.vencido ? '#cf4436' : em.color, background: `${(h.vencido ? '#cf4436' : em.color)}18`, borderColor: `${(h.vencido ? '#cf4436' : em.color)}44` }}>{h.vencido ? 'Vencido' : em.label}</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--muted)', minWidth: 160 }}>{h.observaciones ?? '—'}</td>
                  {esGestor && <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => setModal(h)} title="Editar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--navy)', fontSize: 14, padding: '2px 4px' }}>✎</button>
                    <button onClick={() => eliminar(h)} title="Eliminar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cf4436', fontSize: 13, padding: '2px 4px' }}>🗑</button>
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && sel && <HallazgoModal hallazgo={modal} empresaId={sel} onClose={() => setModal(null)} onGuardado={() => { setModal(null); cargarHallazgos(sel); cargarBase(); }} onError={setError} />}

      {pegar !== null && (
        <div onClick={() => setPegar(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 640 }}>
            <div className="win-bar"><span className="win-title">Pegar hallazgos desde Excel</span>
              <div className="win-ctl"><button className="close" onClick={() => setPegar(null)} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
            </div>
            <div className="win-body" style={{ padding: 18 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
                En Excel selecciona el rango <strong>incluyendo la fila de encabezados</strong> (Hallazgo, Descripción, Normatividad, Área, Riesgo, Descripción del riesgo, Prioridad, Responsable, Plan de acción, Plazo, Estado, Observaciones), cópialo (<strong>Ctrl+C</strong>) y pégalo aquí (<strong>Ctrl+V</strong>). No abre ningún selector de archivos.
              </p>
              <textarea autoFocus value={pegar} onChange={(e) => setPegar(e.target.value)} rows={9}
                placeholder={'Hallazgo\tDescripción\tNormatividad\t…\nConciliación pendiente\t…\t…'}
                style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'var(--mono)' }} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="dbtn" onClick={() => setPegar(null)} style={{ fontSize: 13 }}>Cancelar</button>
                <button className="dbtn primary" disabled={importando || !pegar.trim()} style={{ fontSize: 13 }}
                  onClick={async () => { const t = pegar; setPegar(null); await importarTexto(t); }}>{importando ? 'Importando…' : 'Importar pegado'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
