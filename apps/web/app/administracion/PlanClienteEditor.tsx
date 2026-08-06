'use client';
// Plan de trabajo por cliente: elige el cliente, marca qué actividades (por área)
// tiene en su plan y su periodicidad, y regenera sus tareas del período.

import { useEffect, useState, useCallback } from 'react';
import { descargarXlsx, hoyISO, enLotes } from './exportar';
import ImportarAsignacionesModal from './ImportarAsignacionesModal';

type Empresa = { id: string; nombre: string };
type Usuario = { id: string; nombre: string };
type Act = { id: string; codigo: string; nombre: string; periodicidadCatalogo: string | null; enPlan: boolean; periodicidad: string | null };
type AreaGrupo = { area: string; areaId: string | null; actividades: Act[] };
type Asig = { asesorId: string | null; auxiliarId: string | null; talla: string | null; insumoCliente: boolean };
type EntregaArea = { areaId: string; area: string; entregado: boolean; por?: string | null; origen?: string; en?: string };
type Entregas = { general: { entregado: boolean; por?: string | null; origen?: string; en?: string }; areas: EntregaArea[] };

const PERIODICIDADES = ['Mensual', 'Bimestral', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual'];
const TALLAS = ['', 'S', 'M', 'L', 'XL'];
const input: React.CSSProperties = { padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

export default function PlanClienteEditor() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [areas, setAreas] = useState<AreaGrupo[]>([]);
  // estado editable: id -> { activa, periodicidad }
  const [sel, setSel] = useState<Record<string, { activa: boolean; periodicidad: string }>>({});
  // asignación por área: areaId -> { asesorId, auxiliarId, talla, insumoCliente }
  const [asig, setAsig] = useState<Record<string, Asig>>({});
  const [entregas, setEntregas] = useState<Entregas | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [importar, setImportar] = useState(false);
  const [periodo, setPeriodo] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; });

  useEffect(() => {
    fetch('/api/admin/empresas', { cache: 'no-store' }).then((r) => r.json()).then((d) => setEmpresas((d.items ?? []).map((e: any) => ({ id: e.id, nombre: e.nombre })))).catch(() => {});
    fetch('/api/admin/usuarios', { cache: 'no-store' }).then((r) => r.json()).then((d) => setUsuarios((d.usuarios ?? []).filter((u: any) => u.activo !== false).map((u: any) => ({ id: u.id, nombre: u.nombre })))).catch(() => {});
  }, []);

  const cargarPlan = useCallback(async (eid: string) => {
    if (!eid) { setAreas([]); setSel({}); return; }
    setCargando(true); setError(null); setAviso(null);
    try {
      const res = await fetch(`/api/admin/plan-cliente/${eid}`, { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo cargar.'); setAreas([]); setCargando(false); return; }
      setAreas(d.areas ?? []);
      const s: Record<string, { activa: boolean; periodicidad: string }> = {};
      for (const g of d.areas ?? []) for (const a of g.actividades) s[a.id] = { activa: a.enPlan, periodicidad: a.periodicidad || a.periodicidadCatalogo || 'Mensual' };
      setSel(s);
      // Asignaciones (asesor/auxiliar/talla) por área del cliente.
      const ra = await fetch(`/api/admin/asignaciones/${eid}`, { cache: 'no-store' });
      const da = await ra.json();
      const m: Record<string, Asig> = {};
      if (ra.ok) for (const x of da.areas ?? []) m[x.areaId] = { asesorId: x.asesorId ?? null, auxiliarId: x.auxiliarId ?? null, talla: x.talla ?? null, insumoCliente: !!x.insumoCliente };
      setAsig(m);
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);

  const cargarEntregas = useCallback(async (eid: string, per: string) => {
    if (!eid) { setEntregas(null); return; }
    try {
      const r = await fetch(`/api/admin/entregas/${eid}?periodo=${per}`, { cache: 'no-store' });
      const d = await r.json();
      setEntregas(r.ok ? { general: d.general, areas: d.areas } : null);
    } catch { setEntregas(null); }
  }, []);

  useEffect(() => { cargarPlan(empresaId); }, [empresaId, cargarPlan]);
  useEffect(() => { cargarEntregas(empresaId, periodo); }, [empresaId, periodo, cargarEntregas]);

  async function entregar(areaId: string | null, revertir: boolean) {
    if (!empresaId) return;
    setError(null);
    try {
      const r = await fetch(`/api/admin/entregas/${empresaId}`, {
        method: revertir ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, areaId }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo actualizar la entrega.'); return; }
      cargarEntregas(empresaId, periodo);
    } catch { setError('Error de red.'); }
  }

  const toggle = (id: string) => setSel((s) => ({ ...s, [id]: { ...s[id], activa: !s[id]?.activa } }));
  const setPer = (id: string, periodicidad: string) => setSel((s) => ({ ...s, [id]: { ...s[id], periodicidad } }));
  const VACIA_ASIG: Asig = { asesorId: null, auxiliarId: null, talla: null, insumoCliente: false };
  const setAsigCampo = (areaId: string, campo: 'asesorId' | 'auxiliarId' | 'talla', valor: string) =>
    setAsig((a) => ({ ...a, [areaId]: { ...(a[areaId] ?? VACIA_ASIG), [campo]: valor || null } }));
  const toggleInsumoCliente = (areaId: string) =>
    setAsig((a) => ({ ...a, [areaId]: { ...(a[areaId] ?? VACIA_ASIG), insumoCliente: !(a[areaId]?.insumoCliente) } }));
  const marcarArea = (g: AreaGrupo, activa: boolean) => setSel((s) => { const n = { ...s }; for (const a of g.actividades) n[a.id] = { ...n[a.id], activa }; return n; });

  async function guardar() {
    setGuardando(true); setError(null); setAviso(null);
    const activas = Object.entries(sel).filter(([, v]) => v.activa).map(([id]) => id);
    const periodicidades: Record<string, string> = {};
    for (const id of activas) periodicidades[id] = sel[id].periodicidad;
    const asignaciones = Object.entries(asig).map(([areaId, v]) => ({ areaId, asesorId: v.asesorId, auxiliarId: v.auxiliarId, talla: v.talla, insumoCliente: v.insumoCliente }));
    try {
      const [res, resA] = await Promise.all([
        fetch(`/api/admin/plan-cliente/${empresaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activas, periodicidades }) }),
        fetch(`/api/admin/asignaciones/${empresaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asignaciones }) }),
      ]);
      const d = await res.json();
      const dA = await resA.json().catch(() => ({}));
      if (!res.ok) setError(d.error || 'No se pudo guardar el plan.');
      else if (!resA.ok) setError(dA.error || 'El plan se guardó, pero fallaron las asignaciones.');
      else setAviso(`Guardado: ${d.activas} actividad(es) en el plan y responsables por área. Al generar/regenerar, tareas y vencimientos heredan estos responsables.`);
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  async function generar() {
    setGuardando(true); setError(null); setAviso(null);
    try {
      const res = await fetch(`/api/admin/plan-cliente/${empresaId}/generar?periodo=${periodo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'No se pudieron generar las tareas.'); else setAviso(`Tareas de ${periodo}: ${d.creadas} creada(s)${d.yaExistian ? `, ${d.yaExistian} ya existían` : ''}${d.eliminadasDuplicadas ? `. Se quitaron ${d.eliminadasDuplicadas} tarea(s) duplicada(s) con vencimiento (vacías)` : ''}.`);
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  const totalActivas = Object.values(sel).filter((v) => v.activa).length;

  // Descarga en Excel el plan de trabajo de TODOS los clientes: una fila por
  // (cliente, actividad en su plan), con periodicidad y responsables por área.
  async function descargarTodos() {
    if (!empresas.length || exportando) return;
    setExportando(true); setProgreso(0); setError(null); setAviso(null);
    const nombreUsuario = (id: string | null | undefined) => (id ? (usuarios.find((u) => u.id === id)?.nombre ?? '') : '');
    let listos = 0;
    try {
      const porCliente = await enLotes(empresas, 5, async (emp) => {
        const filas: (string | number)[][] = [];
        try {
          const [rp, ra] = await Promise.all([
            fetch(`/api/admin/plan-cliente/${emp.id}`, { cache: 'no-store' }),
            fetch(`/api/admin/asignaciones/${emp.id}`, { cache: 'no-store' }),
          ]);
          const dp = await rp.json();
          const da = await ra.json().catch(() => ({}));
          const asigMap: Record<string, Asig> = {};
          if (ra.ok) for (const x of da.areas ?? []) asigMap[x.areaId] = { asesorId: x.asesorId ?? null, auxiliarId: x.auxiliarId ?? null, talla: x.talla ?? null, insumoCliente: !!x.insumoCliente };
          if (rp.ok) {
            for (const g of (dp.areas ?? []) as AreaGrupo[]) {
              const a = g.areaId ? asigMap[g.areaId] : undefined;
              for (const act of g.actividades) {
                if (!act.enPlan) continue;
                filas.push([
                  emp.nombre, g.area, act.codigo, act.nombre,
                  act.periodicidad || act.periodicidadCatalogo || '',
                  nombreUsuario(a?.asesorId), nombreUsuario(a?.auxiliarId),
                  a?.talla ?? '', a?.insumoCliente ? 'Sí' : 'No',
                ]);
              }
            }
          }
        } catch { /* si un cliente falla, se omite y se sigue */ }
        setProgreso(Math.round((++listos / empresas.length) * 100));
        return filas;
      });

      const encabezado = ['Cliente', 'Área', 'Código', 'Actividad', 'Periodicidad', 'Asesor', 'Auxiliar', 'Talla', 'Insumo del cliente'];
      const filas = porCliente.flat();
      if (filas.length === 0) { setError('No hay actividades en los planes para exportar.'); return; }
      await descargarXlsx(`planes-por-cliente-cerpat-${hoyISO()}.xlsx`, [{ nombre: 'Planes por cliente', filas: [encabezado, ...filas] }]);
      setAviso(`Excel generado: ${filas.length} actividad(es) de ${empresas.length} cliente(s).`);
    } catch { setError('No se pudo generar el Excel de planes.'); }
    finally { setExportando(false); setProgreso(0); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Plan de trabajo por cliente</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>Elige el cliente y, por cada área: define el <b>asesor</b> y <b>auxiliar</b> responsables, marca qué <b>actividades</b> tiene en su plan y su periodicidad. Luego genera sus tareas del período.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="dbtn" onClick={descargarTodos} disabled={exportando || empresas.length === 0} style={{ fontSize: 13, whiteSpace: 'nowrap' }} title="Descarga en Excel el plan de trabajo de todos los clientes">
            {exportando ? `Generando… ${progreso}%` : '⬇ Descargar todos (Excel)'}
          </button>
          <button className="dbtn" onClick={() => setImportar(true)} style={{ fontSize: 13, whiteSpace: 'nowrap' }} title="Carga masiva de asesor/auxiliar/talla por Cliente × Área desde el Excel descargado">
            ⬆ Importar asignaciones (Excel)
          </button>
        </div>
      </div>

      {importar && <ImportarAsignacionesModal onClose={() => setImportar(false)} onImported={() => { setAviso('Asignaciones importadas correctamente.'); if (empresaId) cargarPlan(empresaId); }} />}

      {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      {aviso && <div style={{ background: '#E7F6EC', color: '#027a48', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{aviso}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select style={{ ...input, minWidth: 280 }} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">— Selecciona un cliente —</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        {empresaId && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{totalActivas} actividad(es) en el plan</span>}
      </div>

      {!empresaId ? (
        <div className="panel" style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>Selecciona un cliente para ver y editar su plan.</div>
      ) : cargando ? (
        <div style={{ color: 'var(--muted)', padding: 12 }}>Cargando…</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {areas.map((g) => (
              <div key={g.area} className="panel" style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 13.5 }}>{g.area}</span>
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button className="dbtn" onClick={() => marcarArea(g, true)} style={{ fontSize: 11.5, padding: '4px 8px' }}>Todas</button>
                    <button className="dbtn" onClick={() => marcarArea(g, false)} style={{ fontSize: 11.5, padding: '4px 8px' }}>Ninguna</button>
                  </span>
                </div>
                {g.areaId && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed var(--edge-strong)' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--muted)' }}>Responsables</span>
                    <select value={asig[g.areaId]?.asesorId ?? ''} onChange={(e) => setAsigCampo(g.areaId!, 'asesorId', e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 12, minWidth: 150 }}>
                      <option value="">— Asesor —</option>
                      {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                    <select value={asig[g.areaId]?.auxiliarId ?? ''} onChange={(e) => setAsigCampo(g.areaId!, 'auxiliarId', e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 12, minWidth: 150 }}>
                      <option value="">— Auxiliar —</option>
                      {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                    <select value={asig[g.areaId]?.talla ?? ''} onChange={(e) => setAsigCampo(g.areaId!, 'talla', e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 12, width: 76 }} title="Talla del cliente en esta área">
                      {TALLAS.map((t) => <option key={t} value={t}>{t || 'Talla'}</option>)}
                    </select>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--ink)' }} title="El insumo de esta área lo provee el cliente (auxiliar externo)">
                      <input type="checkbox" checked={asig[g.areaId]?.insumoCliente ?? false} onChange={() => toggleInsumoCliente(g.areaId!)} />
                      Insumo del cliente
                    </label>
                  </div>
                )}
                {g.actividades.map((a) => {
                  const s = sel[a.id] ?? { activa: false, periodicidad: a.periodicidadCatalogo || 'Mensual' };
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }}>
                        <input type="checkbox" checked={s.activa} onChange={() => toggle(a.id)} />
                        <span style={{ fontSize: 12.5 }}><span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 11 }}>{a.codigo}</span> · {a.nombre}</span>
                      </label>
                      <select value={s.periodicidad} disabled={!s.activa} onChange={(e) => setPer(a.id, e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 12, opacity: s.activa ? 1 : 0.5 }}>
                        {PERIODICIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Entregas del insumo del período */}
          {entregas && (
            <div className="panel" style={{ padding: '12px 14px', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 13.5 }}>Entregas del insumo</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>período {periodo}</span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 10px' }}>Cuando el insumo está listo, <b>libera</b> el área para habilitar su procesamiento. La entrega general habilita todas las áreas. Al terminar toda la captura del cliente, la firma se libera <b>sola</b> (marca <span style={{ fontWeight: 700 }}>auto</span>); las áreas con <b>insumo del cliente</b> se marcan a mano al recibirlas.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <EntregaChip label="Todo el insumo (general)" e={entregas.general} onLiberar={() => entregar(null, false)} onRevertir={() => entregar(null, true)} />
                {entregas.areas.map((a) => (
                  <EntregaChip key={a.areaId} label={a.area} e={a} onLiberar={() => entregar(a.areaId, false)} onRevertir={() => entregar(a.areaId, true)} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : 'Guardar plan'}</button>
            <span className="sp" style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Generar tareas del período</span>
            <input style={{ ...input, width: 110 }} value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="YYYY-MM" />
            <button className="dbtn navy" onClick={generar} disabled={guardando} style={{ fontSize: 13 }}>Generar</button>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 2px 0' }}>Guardar cambia el plan y los responsables; Generar crea las tareas del período según periodicidad. Las actividades <b>vinculadas a un vencimiento</b> no se generan como tarea (se controlan en Vencimientos) y, si quedaron duplicadas vacías, Generar las quita.</p>
        </>
      )}
    </div>
  );
}

// Chip de entrega: liberar (habilita el procesamiento) o revertir.
function EntregaChip({ label, e, onLiberar, onRevertir }: { label: string; e?: { entregado: boolean; por?: string | null; origen?: string }; onLiberar: () => void; onRevertir: () => void }) {
  const entregado = !!e?.entregado;
  const esAuto = e?.origen === 'auto';
  const verde = '#22a670';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${entregado ? verde + '66' : 'var(--edge-strong)'}`, background: entregado ? verde + '14' : 'var(--panel)', borderRadius: 8, padding: '6px 10px' }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{label}</span>
      {entregado ? (
        <>
          <span style={{ fontSize: 11.5, color: verde, fontWeight: 700 }}>✓ Entregado{e?.por ? ` · ${e.por}` : ''}</span>
          {esAuto && <span title="Liberado automáticamente al terminar la captura" style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: '#2f6fd0', background: '#eaf1fb', border: '1px solid #cfe0f7', borderRadius: 20, padding: '1px 6px' }}>auto</span>}
          <button className="dbtn" onClick={onRevertir} title="Revertir la entrega" style={{ fontSize: 11, padding: '3px 7px' }}>↺</button>
        </>
      ) : (
        <button className="dbtn primary" onClick={onLiberar} style={{ fontSize: 11.5, padding: '4px 9px' }}>Liberar</button>
      )}
    </div>
  );
}
