'use client';
// Portal de Hallazgos: consolidado (grupo/revisor), detalle por empresa y —para
// el revisor— edición de la matriz. Todo contra /api/portal/... con el
// aislamiento validado en el backend.

import { useEffect, useState, useCallback } from 'react';
import HallazgoModal from './HallazgoModal';

export type Empresa = { id: string; nombre: string; grupo: string | null };
export type Hallazgo = {
  id: string; empresaId: string; empresa: string | null; area: string | null; titulo: string; descripcion: string | null;
  normatividad: string | null; riesgo: string; prioridad: string; responsable: string | null; planAccion: string | null;
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

  if (cargando) return <div style={{ color: 'var(--muted)', padding: 16 }}>Cargando…</div>;
  if (error) return <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>{error}</div>;

  const empresaSel = empresas.find((e) => e.id === sel);
  const multi = empresas.length > 1;

  // ---- Vista consolidada (grupo / revisor con varias empresas) ----
  if (!sel) {
    const k = resumen?.kpis;
    return (
      <>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Estado de hallazgos {empresas[0]?.grupo ? `· ${empresas[0].grupo}` : 'del grupo'}</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>Consolidado de {empresas.length} compañías frente a los hallazgos de la revisoría fiscal. Entra a cualquiera para ver su matriz.</p>
        {k && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
            <div className="tile"><div className="k">Hallazgos</div><div className="v" style={{ color: 'var(--navy)' }}>{k.total}</div><div className="s">en total</div></div>
            <div className="tile"><div className="k">Resueltos</div><div className="v" style={{ color: '#22a670' }}>{k.resueltos}<small>/{k.total}</small></div><div className="s">{k.pct}% cerrado</div></div>
            <div className="tile"><div className="k">En gestión</div><div className="v" style={{ color: '#2f6fd0' }}>{k.enGestion}</div><div className="s">en curso</div></div>
            <div className="tile"><div className="k">Vencidos</div><div className="v" style={{ color: k.vencidos ? '#cf4436' : '#8a94a6' }}>{k.vencidos}</div><div className="s">requieren atención</div></div>
          </div>
        )}
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>Resolución por compañía</h2>
        <div className="panel" style={{ padding: '6px 16px 12px' }}>
          {(resumen?.porEmpresa ?? []).map((e) => (
            <button key={e.empresaId} onClick={() => setSel(e.empresaId)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: '12px 0', borderBottom: '1px solid var(--line)', fontFamily: 'var(--ui)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{e.empresa} <span style={{ marginLeft: 6, color: 'var(--navy)', fontSize: 11 }}>ver matriz →</span></span>
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{e.resueltos}/{e.total} · <strong style={{ color: colorPct(e.pct) }}>{e.pct}%</strong>{e.vencidos > 0 && <span style={{ color: '#cf4436', marginLeft: 8 }}>{e.vencidos} vencido(s)</span>}</span>
              </div>
              <div style={{ height: 9, borderRadius: 3, background: 'var(--panel-2)', border: '1px solid var(--line)', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: `${e.total ? (e.resueltos / e.total) * 100 : 0}%`, background: '#22a670' }} />
                <span style={{ width: `${e.total ? (e.enGestion / e.total) * 100 : 0}%`, background: '#2f6fd0' }} />
                <span style={{ width: `${e.total ? (e.vencidos / e.total) * 100 : 0}%`, background: '#cf4436' }} />
              </div>
            </button>
          ))}
          {(resumen?.porEmpresa ?? []).length === 0 && <div style={{ padding: 20, color: 'var(--muted)', textAlign: 'center' }}>Aún no hay hallazgos registrados.</div>}
        </div>
      </>
    );
  }

  // ---- Detalle por empresa (matriz) ----
  const k = resumen?.porEmpresa.find((e) => e.empresaId === sel);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {multi && <button className="dbtn" onClick={() => setSel(null)} style={{ fontSize: 13 }}>‹ Volver</button>}
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{empresaSel?.nombre ?? 'Hallazgos'}</h1>
        <span className="sp" style={{ flex: 1 }} />
        {esGestor && <button className="dbtn primary" onClick={() => setModal('nuevo')} style={{ fontSize: 13 }}>＋ Nuevo hallazgo</button>}
      </div>
      {k && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="tile"><div className="k">Hallazgos</div><div className="v" style={{ color: 'var(--navy)' }}>{k.total}</div><div className="s">de la empresa</div></div>
          <div className="tile"><div className="k">Resueltos</div><div className="v" style={{ color: '#22a670' }}>{k.resueltos}</div><div className="s">{k.pct}% cerrado</div></div>
          <div className="tile"><div className="k">En gestión</div><div className="v" style={{ color: '#2f6fd0' }}>{k.enGestion}</div><div className="s">en curso</div></div>
          <div className="tile"><div className="k">Vencidos</div><div className="v" style={{ color: k.vencidos ? '#cf4436' : '#8a94a6' }}>{k.vencidos}</div><div className="s">requieren atención</div></div>
        </div>
      )}
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="dt" style={{ minWidth: 940 }}>
          <thead><tr>
            <th>Hallazgo</th><th>Descripción</th><th>Normatividad</th><th>Riesgo</th><th>Prioridad</th><th>Responsable</th><th>Plan de acción</th><th>Plazo</th><th>Estado</th><th>Observaciones</th>{esGestor && <th></th>}
          </tr></thead>
          <tbody>
            {hallazgos.length === 0 ? (
              <tr><td colSpan={esGestor ? 11 : 10} style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>Sin hallazgos registrados para esta empresa.</td></tr>
            ) : hallazgos.map((h) => {
              const em = ESTADO_META[h.estado] ?? ESTADO_META.pendiente;
              const rm = RIESGO_META[h.riesgo] ?? RIESGO_META.medio;
              return (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600, minWidth: 130 }}>{h.titulo}{h.area && <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>{h.area}</div>}</td>
                  <td style={{ color: 'var(--muted)', minWidth: 180 }}>{h.descripcion ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{h.normatividad ?? '—'}</td>
                  <td><span className="chip" style={{ color: rm.color, background: `${rm.color}18`, borderColor: `${rm.color}44` }}>{rm.label}</span></td>
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
    </>
  );
}
