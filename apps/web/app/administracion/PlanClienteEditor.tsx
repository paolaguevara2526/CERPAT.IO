'use client';
// Plan de trabajo por cliente: elige el cliente, marca qué actividades (por área)
// tiene en su plan y su periodicidad, y regenera sus tareas del período.

import { useEffect, useState, useCallback } from 'react';

type Empresa = { id: string; nombre: string };
type Act = { id: string; codigo: string; nombre: string; periodicidadCatalogo: string | null; enPlan: boolean; periodicidad: string | null };
type AreaGrupo = { area: string; areaId: string | null; actividades: Act[] };

const PERIODICIDADES = ['Mensual', 'Bimestral', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual'];
const input: React.CSSProperties = { padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

export default function PlanClienteEditor() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [areas, setAreas] = useState<AreaGrupo[]>([]);
  // estado editable: id -> { activa, periodicidad }
  const [sel, setSel] = useState<Record<string, { activa: boolean; periodicidad: string }>>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; });

  useEffect(() => {
    fetch('/api/admin/empresas', { cache: 'no-store' }).then((r) => r.json()).then((d) => setEmpresas((d.items ?? []).map((e: any) => ({ id: e.id, nombre: e.nombre })))).catch(() => {});
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
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);

  useEffect(() => { cargarPlan(empresaId); }, [empresaId, cargarPlan]);

  const toggle = (id: string) => setSel((s) => ({ ...s, [id]: { ...s[id], activa: !s[id]?.activa } }));
  const setPer = (id: string, periodicidad: string) => setSel((s) => ({ ...s, [id]: { ...s[id], periodicidad } }));
  const marcarArea = (g: AreaGrupo, activa: boolean) => setSel((s) => { const n = { ...s }; for (const a of g.actividades) n[a.id] = { ...n[a.id], activa }; return n; });

  async function guardar() {
    setGuardando(true); setError(null); setAviso(null);
    const activas = Object.entries(sel).filter(([, v]) => v.activa).map(([id]) => id);
    const periodicidades: Record<string, string> = {};
    for (const id of activas) periodicidades[id] = sel[id].periodicidad;
    try {
      const res = await fetch(`/api/admin/plan-cliente/${empresaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activas, periodicidades }) });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'No se pudo guardar.'); else setAviso(`Plan guardado: ${d.activas} actividad(es) activas para este cliente.`);
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  async function generar() {
    setGuardando(true); setError(null); setAviso(null);
    try {
      const res = await fetch(`/api/admin/plan-cliente/${empresaId}/generar?periodo=${periodo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'No se pudieron generar las tareas.'); else setAviso(`Tareas de ${periodo}: ${d.creadas} creada(s)${d.yaExistian ? `, ${d.yaExistian} ya existían` : ''}.`);
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  const totalActivas = Object.values(sel).filter((v) => v.activa).length;

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Plan de trabajo por cliente</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>Elige el cliente y marca qué actividades tiene en su plan (por área) y su periodicidad. Luego genera sus tareas del período.</p>

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

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : 'Guardar plan'}</button>
            <span className="sp" style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Generar tareas del período</span>
            <input style={{ ...input, width: 110 }} value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="YYYY-MM" />
            <button className="dbtn navy" onClick={generar} disabled={guardando} style={{ fontSize: 13 }}>Generar</button>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 2px 0' }}>Guardar cambia el plan del cliente; Generar crea sus tareas del período según periodicidad (no duplica las que ya existan).</p>
        </>
      )}
    </div>
  );
}
