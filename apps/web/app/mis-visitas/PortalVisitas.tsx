'use client';
// Portal del cliente para Visitas (Fase 4): el cliente ve, en solo lectura, sus
// visitas y el acta de cada una (actividades, compromisos, recomendaciones y
// observaciones). Aislado por empresa/grupo en el backend.

import { useEffect, useState } from 'react';

type Compromiso = { descripcion: string; responsableTipo: 'firma' | 'cliente'; responsable: string; area: string | null; fechaLimite: string | null; estado: string };
type Visita = {
  id: string; empresa: string | null; fecha: string; hora: string | null; lugar: string | null; area: string | null;
  objetivo: string | null; estado: string; asesor: string | null;
  actividades: string[]; recomendaciones: string[]; observaciones: string[]; compromisos: Compromiso[];
};

const HOY = new Date().toISOString().slice(0, 10);
const V_EST: Record<string, { label: string; color: string }> = {
  programada: { label: 'Programada', color: '#2f6fd0' }, realizada: { label: 'Realizada', color: '#22a670' }, cancelada: { label: 'Cancelada', color: '#9aa3b2' },
};
function cEstado(c: Compromiso): { label: string; color: string } {
  if (c.estado === 'cumplido') return { label: 'Cumplido', color: '#22a670' };
  if (c.estado === 'cancelado') return { label: 'Cancelado', color: '#9aa3b2' };
  if (c.fechaLimite && c.fechaLimite < HOY) return { label: 'Vencido', color: '#cf4436' };
  return { label: 'Pendiente', color: '#c67c00' };
}
function fFecha(iso: string | null) { if (!iso) return '—'; try { return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return iso; } }

export default function PortalVisitas() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [esFirma, setEsFirma] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/visitas/portal', { cache: 'no-store' });
        const d = await r.json();
        if (r.ok) { setVisitas(d.visitas ?? []); setEsFirma(!!d.esFirma); }
        else setError(d.error || 'No se pudieron cargar las visitas.');
      } catch { setError('Error de red.'); }
      setCargando(false);
    })();
  }, []);

  const secTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', margin: '14px 0 6px' };
  const lista = (items: string[]) => items.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>—</p> : (
    <ol style={{ margin: 0, paddingLeft: 20 }}>{items.map((t, i) => <li key={i} style={{ fontSize: 13, margin: '3px 0' }}>{t}</li>)}</ol>
  );

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Mis visitas</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>Consulta las visitas de tu equipo asesor y los compromisos acordados en cada una. {esFirma ? '(Vista de la firma: ves todas las empresas.)' : 'Solo consulta.'}</p>

      {error && <div className="panel" style={{ padding: '12px 14px', color: '#b42318', fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      {cargando ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</p> : visitas.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Aún no hay visitas registradas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visitas.map((v) => {
            const em = V_EST[v.estado] ?? { label: v.estado, color: '#5b6a82' };
            const open = abierta === v.id;
            const pend = v.compromisos.filter((c) => cEstado(c).label === 'Pendiente' || cEstado(c).label === 'Vencido').length;
            return (
              <div key={v.id} className="panel" style={{ overflow: 'hidden' }}>
                <button onClick={() => setAbierta(open ? null : v.id)} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--ui)', color: 'var(--ink)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 14 }}>{v.objetivo || 'Visita'}</b>
                      <span style={{ fontSize: 11, fontWeight: 800, color: em.color, background: `${em.color}18`, borderRadius: 20, padding: '2px 9px' }}>{em.label}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{fFecha(v.fecha)}{v.hora ? ` · ${v.hora}` : ''}{esFirma && v.empresa ? ` · ${v.empresa}` : ''}{v.asesor ? ` · ${v.asesor}` : ''}</div>
                  </div>
                  {v.compromisos.length > 0 && <span style={{ fontSize: 12, color: pend ? '#c67c00' : '#22a670', fontWeight: 700, whiteSpace: 'nowrap' }}>{pend ? `${pend} pendiente(s)` : 'Al día'}</span>}
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
                </button>
                {open && (
                  <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, fontSize: 12.5, marginTop: 12 }}>
                      {v.area && <div><span style={{ color: 'var(--muted)' }}>Área: </span>{v.area}</div>}
                      {v.lugar && <div><span style={{ color: 'var(--muted)' }}>Lugar: </span>{v.lugar}</div>}
                      {v.asesor && <div><span style={{ color: 'var(--muted)' }}>Asesor: </span>{v.asesor}</div>}
                    </div>

                    <div style={secTitle}>Actividades realizadas</div>{lista(v.actividades)}

                    <div style={secTitle}>Compromisos</div>
                    {v.compromisos.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>—</p> : (
                      <div className="dt-wrap"><table className="dt" style={{ fontSize: 12.5 }}>
                        <thead><tr><th>Compromiso</th><th style={{ width: 150 }}>Responsable</th><th style={{ width: 90 }}>Dirección</th><th style={{ width: 90 }}>Vence</th><th style={{ width: 100 }}>Estado</th></tr></thead>
                        <tbody>{v.compromisos.map((c, i) => { const ce = cEstado(c); const esCli = c.responsableTipo === 'cliente'; return (
                          <tr key={i}>
                            <td>{c.descripcion}</td>
                            <td style={{ color: 'var(--muted)' }}>{c.responsable}</td>
                            <td><span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: esCli ? '#7a5bd0' : '#2E5090' }}>{esCli ? 'Cliente' : 'Firma'}</span></td>
                            <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{c.fechaLimite ? new Date(`${c.fechaLimite}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}</td>
                            <td><span style={{ fontSize: 11, fontWeight: 800, color: ce.color, background: `${ce.color}18`, borderRadius: 20, padding: '2px 9px' }}>{ce.label}</span></td>
                          </tr>
                        ); })}</tbody>
                      </table></div>
                    )}

                    <div style={secTitle}>Recomendaciones</div>{lista(v.recomendaciones)}
                    <div style={secTitle}>Observaciones</div>{lista(v.observaciones)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
