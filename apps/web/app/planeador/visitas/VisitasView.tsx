'use client';
// Vista de Visitas: lista por mes, agendar nueva y abrir el acta de cada una.
// El seguimiento por cliente/asesor llega en la Fase 2.

import { useCallback, useEffect, useState } from 'react';
import VisitaModal, { VISITA_ESTADOS } from './VisitaModal';

type Visita = {
  id: string; empresa: string | null; responsable: string | null; fecha: string; hora: string | null;
  objetivo: string | null; estado: string; compromisosTotal: number; compromisosPendientes: number; compromisosCumplidos: number;
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (n: number) => String(n).padStart(2, '0');
function mesActual() { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`; }
function desplazar(mes: string, delta: number) { const [y, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + delta, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; }
function fFecha(iso: string) { try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return iso.slice(0, 10); } }
const estadoMeta = (k: string) => VISITA_ESTADOS.find((s) => s.k === k) ?? { label: k, color: '#5b6a82' };

export default function VisitasView({ puedeAgendar }: { puedeAgendar: boolean }) {
  const [mes, setMes] = useState(mesActual());
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editar, setEditar] = useState<string | 'nueva' | null>(null);

  const cargar = useCallback(async (m: string) => {
    setCargando(true); setError(null);
    const [y, mm] = m.split('-').map(Number);
    try {
      const r = await fetch(`/api/visitas?anio=${y}&mes=${mm}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setVisitas(d.visitas ?? []); else setError(d.error || 'No se pudieron cargar las visitas.');
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(mes); }, [mes, cargar]);
  const [y, m] = mes.split('-').map(Number);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Visitas</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMes(desplazar(mes, -1))} className="dbtn" style={{ fontSize: 13 }}>‹</button>
          <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>{MESES[m - 1]} {y}</span>
          <button onClick={() => setMes(desplazar(mes, 1))} className="dbtn" style={{ fontSize: 13 }}>›</button>
          <button onClick={() => setMes(mesActual())} className="dbtn" style={{ fontSize: 12.5 }}>Hoy</button>
          {puedeAgendar && <button className="dbtn primary" onClick={() => setEditar('nueva')} style={{ fontSize: 13 }}>＋ Agendar visita</button>}
        </div>
      </div>

      {error && <div className="panel" style={{ padding: '12px 14px', color: '#b42318', fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      <div className="panel">
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th style={{ width: 78 }}>Fecha</th><th>Cliente</th><th>Responsable</th><th>Objetivo</th><th style={{ width: 110 }}>Estado</th><th style={{ width: 110 }}>Compromisos</th></tr></thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
              ) : visitas.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin visitas este mes.</td></tr>
              ) : visitas.map((v) => {
                const em = estadoMeta(v.estado);
                return (
                  <tr key={v.id} onClick={() => setEditar(v.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fFecha(v.fecha)}{v.hora ? <span style={{ color: 'var(--muted)', fontSize: 11 }}> · {v.hora}</span> : null}</td>
                    <td style={{ fontWeight: 600 }}>{v.empresa ?? '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{v.responsable ?? '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{v.objetivo ?? '—'}</td>
                    <td><span style={{ fontSize: 11.5, fontWeight: 800, color: em.color, background: `${em.color}18`, borderRadius: 20, padding: '2px 9px' }}>{em.label}</span></td>
                    <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{v.compromisosTotal === 0 ? '—' : `${v.compromisosCumplidos}/${v.compromisosTotal} cumplidos`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 2px 0' }}>Haz clic en una visita para abrir su acta (objetivo, compromisos y recomendaciones). Las visitas también aparecen en el Calendario.</p>

      {editar && <VisitaModal id={editar === 'nueva' ? null : editar} onClose={() => setEditar(null)} onSaved={() => cargar(mes)} />}
    </>
  );
}
