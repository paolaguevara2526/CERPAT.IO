'use client';
// Consolidado de pendientes del día a día, para coordinación.
//
// La pregunta que viene a responder —y que hoy nadie puede— es "¿cuánto trabajo
// por fuera del plan nos genera cada cliente?". Por eso el corte por empresa va
// primero y el listado después: el número por cliente es el que sirve para
// decidir, el detalle es para revisar casos.
//
// Nada de esto entra al cumplimiento del plan: son dos cosas distintas y
// mezclarlas haría inservibles las dos.

import { useEffect, useState } from 'react';
import PanelPlegable from '@/app/_components/PanelPlegable';
import { fmtDia } from '@/lib/fechas';

type Fila = {
  id: string; titulo: string; detalle: string | null; fecha: string; estado: string;
  empresa: { id: string; nombre: string } | null;
  responsable: { id: string; nombre: string } | null;
  creadoPor: { id: string; nombre: string } | null;
  hechoEn: string | null;
  hechoPor: { id: string; nombre: string } | null;
};
type PorEmpresa = { empresa: string; total: number; abiertos: number };
type Resp = { total: number; pendientes: Fila[]; porEmpresa: PorEmpresa[] };

export default function PendientesConsolidado() {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  async function cargar() {
    setCargando(true);
    try {
      const q = new URLSearchParams();
      if (estado) q.set('estado', estado);
      if (/^\d{4}-\d{2}-\d{2}$/.test(desde)) q.set('desde', desde);
      if (/^\d{4}-\d{2}-\d{2}$/.test(hasta)) q.set('hasta', hasta);
      const r = await fetch(`/api/pendientes${q.toString() ? `?${q}` : ''}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setData(d as Resp);
    } catch { /* el panel se oculta si no hay datos */ }
    finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, [estado, desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  const filas = data?.pendientes ?? [];
  const porEmpresa = data?.porEmpresa ?? [];
  const inp: React.CSSProperties = { padding: '5px 8px', border: '1px solid var(--edge-strong)', borderRadius: 6, fontSize: 12.5, background: 'var(--panel)', color: 'var(--ink)' };
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '6px 8px', borderBottom: '1px solid var(--line)' };
  const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--line)', fontSize: 12.5 };

  return (
    <PanelPlegable
      id="pendientes-consolidado" titulo="📌 Pendientes fuera del plan"
      nota="Lo que sale del día a día. No entra al cumplimiento: sirve para ver cuánto trabajo adicional genera cada cliente."
      resumen={<span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{data?.total ?? 0} registro(s)</span>}
    >
      <div style={{ padding: '10px 14px 14px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inp}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Abiertos</option>
            <option value="hecho">Hechos</option>
          </select>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inp} />
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inp} />
          {(estado || desde || hasta) && (
            <button className="dbtn" onClick={() => { setEstado(''); setDesde(''); setHasta(''); }} style={{ fontSize: 12 }}>Limpiar</button>
          )}
        </div>

        {cargando ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Cargando…</div>
          : filas.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Sin pendientes registrados en este rango.</div>
          : (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', margin: '0 0 6px' }}>
                Por cliente
              </div>
              <div style={{ overflowX: 'auto', marginBottom: 18 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
                  <thead><tr><th style={th}>Cliente</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={{ ...th, textAlign: 'right' }}>Abiertos</th></tr></thead>
                  <tbody>
                    {porEmpresa.map((e) => (
                      <tr key={e.empresa}>
                        <td style={{ ...td, fontWeight: 600 }}>{e.empresa}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{e.total}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', color: e.abiertos > 0 ? 'var(--alerta-fuerte)' : 'var(--muted)' }}>{e.abiertos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', margin: '0 0 6px' }}>
                Detalle
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead><tr>{['Fecha', 'Qué', 'Cliente', 'Responsable', 'Estado'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filas.map((p) => (
                      <tr key={p.id}>
                        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fmtDia(p.fecha)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {p.titulo}
                          {p.detalle && <div style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11.5, marginTop: 2 }}>{p.detalle}</div>}
                        </td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{p.empresa?.nombre ?? '—'}</td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{p.responsable?.nombre ?? 'Sin asignar'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          {p.estado === 'hecho' ? (
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--exito-fuerte)' }}>
                              ✓ Hecho{p.hechoEn ? ` · ${fmtDia(p.hechoEn)}` : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--alerta-fuerte)' }}>Abierto</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </div>
    </PanelPlegable>
  );
}
