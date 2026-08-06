'use client';
// Plan de Trabajo del cliente (solo lectura): matriz de cumplimiento (áreas × 12
// meses) + listado de actividades de su empresa. Aislado en el backend
// (GET /plan/portal).

import { useEffect, useMemo, useState } from 'react';

type Matriz = { area: string; meses: (number | null)[]; total: number };
type Actividad = { titulo: string; area: string | null; periodo: string | null; fechaVencimiento: string; estado: string; estadoLabel: string; vencido: boolean };
type Resp = { anio: number; kpis: { total: number; ejecutadas: number; cumplimiento: number } | null; matriz: Matriz[]; actividades: Actividad[] };

const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const EST_COLOR: Record<string, string> = { por_iniciar: '#5b6a82', en_curso: '#2f6fd0', en_revision: '#c67c00', terminado: '#22a670', auditado: '#1c8a5e', no_realizado: '#cf4436' };
function colorPct(p: number): { fg: string; bg: string } {
  if (p >= 85) return { fg: '#15934F', bg: 'rgba(34,166,112,0.16)' };
  if (p >= 60) return { fg: '#C77A0A', bg: 'rgba(198,124,0,0.16)' };
  return { fg: '#D23B32', bg: 'rgba(207,68,54,0.16)' };
}
function fFecha(iso: string) { try { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return '—'; } }

export default function PortalPlan() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true); setError(null);
    fetch(`/api/plan/portal?anio=${anio}`, { cache: 'no-store' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (ok) setData(d); else setError(d.error || 'No se pudo cargar el plan.'); })
      .catch(() => setError('Error de red.'))
      .finally(() => setCargando(false));
  }, [anio]);

  const k = data?.kpis;
  const matriz = data?.matriz ?? [];
  const actividades = useMemo(() => data?.actividades ?? [], [data]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Plan de Trabajo</h1>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5 }}>
          {[anioActual, anioActual - 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>El cumplimiento de las actividades contables de tu empresa. Solo consulta.</p>

      {error && <div className="panel" style={{ padding: '12px 14px', color: '#b42318', fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      {k && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="panel" style={{ padding: '13px 15px' }}><div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Actividades</div><div style={{ fontSize: 24, fontWeight: 800 }}>{k.total}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>en el año</div></div>
          <div className="panel" style={{ padding: '13px 15px' }}><div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Cumplimiento</div><div style={{ fontSize: 24, fontWeight: 800, color: colorPct(k.cumplimiento).fg }}>{k.cumplimiento}%</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{k.ejecutadas} ejecutadas</div></div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', margin: '4px 2px 8px' }}>Matriz de cumplimiento por área</div>
      <div className="panel" style={{ overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 12.5 }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--line)', position: 'sticky', left: 0, background: 'var(--panel)' }}>Área</th>
            {MES.map((m) => <th key={m} style={{ padding: '8px 4px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 11, fontWeight: 700, width: 46 }}>{m}</th>)}
          </tr></thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
            ) : matriz.length === 0 ? (
              <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Aún no hay actividades del plan para tu empresa este año.</td></tr>
            ) : matriz.map((f) => (
              <tr key={f.area}>
                <td style={{ padding: '7px 10px', fontWeight: 600, borderBottom: '1px solid var(--line)', position: 'sticky', left: 0, background: 'var(--panel)' }}>{f.area}</td>
                {f.meses.map((p, i) => (
                  <td key={i} style={{ textAlign: 'center', padding: '6px 2px', borderBottom: '1px solid var(--line)' }}>
                    {p == null ? <span style={{ color: 'var(--edge-strong)' }}>·</span> : (
                      <span style={{ display: 'inline-block', minWidth: 34, fontSize: 11, fontWeight: 800, borderRadius: 5, padding: '2px 4px', color: colorPct(p).fg, background: colorPct(p).bg }}>{p}%</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', margin: '4px 2px 8px' }}>Actividades ({actividades.length})</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="dt" style={{ minWidth: 640 }}>
          <thead><tr><th>Actividad</th><th style={{ width: 130 }}>Área</th><th style={{ width: 80 }}>Período</th><th style={{ width: 70 }}>Vence</th><th style={{ width: 120 }}>Estado</th></tr></thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
            ) : actividades.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin actividades registradas.</td></tr>
            ) : actividades.map((a, i) => {
              const color = a.vencido ? '#cf4436' : (EST_COLOR[a.estado] ?? '#5b6a82');
              const label = a.vencido ? 'Vencida' : a.estadoLabel;
              return (
                <tr key={i}>
                  <td>{a.titulo}</td>
                  <td style={{ color: 'var(--muted)' }}>{a.area ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{a.periodo ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fFecha(a.fechaVencimiento)}</td>
                  <td><span style={{ fontSize: 11, fontWeight: 800, color, background: `${color}18`, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 2px 0' }}>El porcentaje de cada celda es el cumplimiento (actividades terminadas o auditadas) del área en ese mes.</p>
    </>
  );
}
