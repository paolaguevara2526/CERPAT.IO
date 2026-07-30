// apps/web/app/planeador/pagos/page.tsx — Seguimiento de obligaciones con pago.

import { apiFetch } from '@/lib/session';
import { AREAS, nombrePeriodo } from '../tareas';
import PagoEditor, { ESTADO_PAGO_META } from '../PagoEditor';

export const dynamic = 'force-dynamic';

type TareaPago = {
  id: string; titulo: string; empresa: string | null; obligacion: string | null; area: string | null;
  asesor: string | null; auxiliar: string | null; fechaVencimiento: string;
  valorPago: number | null; estadoPago: string;
};
type Resp = { periodo: string | null; total: number; tareas: TareaPago[] };

async function fetchPagos(qs: string): Promise<{ data: Resp | null; error: string | null }> {
  try {
    const res = await apiFetch(`/plan/pagos${qs ? `?${qs}` : ''}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Resp, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return ''; }
}
function fmtCOP(v: number): string {
  return v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

export default async function PagosPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const estadoPago = searchParams?.estadoPago || '';
  const qs = new URLSearchParams();
  if (estadoPago) qs.set('estadoPago', estadoPago);
  const { data, error } = await fetchPagos(qs.toString());
  const tareas = data?.tareas ?? [];

  const totalValor = tareas.reduce((s, t) => s + (t.valorPago ?? 0), 0);
  const pagadas = tareas.filter((t) => t.estadoPago === 'presentado_pagado').length;
  const pendientes = tareas.filter((t) => t.estadoPago === 'pendiente' || t.estadoPago === 'no_presentado').length;

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Pagos</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {tareas.length} obligaciones</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>Obligaciones con pago (DIAN/entidades) del período. El ejecutor digita el valor y marca el estado de presentación y pago.</p>

      {!error && tareas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="tile"><div className="k">Valor total</div><div className="v" style={{ color: 'var(--navy)', fontSize: 22 }}>${fmtCOP(totalValor)}</div><div className="s">digitado</div></div>
          <div className="tile"><div className="k">Pagadas</div><div className="v" style={{ color: '#22a670' }}>{pagadas}</div><div className="s">presentadas y pagadas</div></div>
          <div className="tile"><div className="k">Por gestionar</div><div className="v" style={{ color: pendientes > 0 ? '#c67c00' : '#8a94a6' }}>{pendientes}</div><div className="s">pendientes/no presentadas</div></div>
        </div>
      )}

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <select name="estadoPago" defaultValue={estadoPago} style={sel}>
          <option value="">Todos los estados de pago</option>
          {Object.entries(ESTADO_PAGO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
      </form>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar los pagos: {error}.</div>
      ) : tareas.length === 0 ? (
        <div className="panel" style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>
          No hay obligaciones con pago para este período.
          <div style={{ fontSize: 12, marginTop: 6 }}>Aparecen aquí las actividades del plan marcadas como <strong>genera pago</strong>.</div>
        </div>
      ) : (
        <div className="panel">
          <div className="dt-wrap">
            <table className="dt">
              <thead>
                <tr><th>Obligación</th><th>Cliente</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th>Auxiliar</th><th>Valor y estado de pago</th></tr>
              </thead>
              <tbody>
                {tareas.map((t) => {
                  const venc = new Date(t.fechaVencimiento) < new Date() && t.estadoPago !== 'presentado_pagado';
                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.obligacion ?? t.titulo}</td>
                      <td style={{ color: 'var(--muted)' }}>{t.empresa ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: venc ? 800 : 500, color: venc ? '#d64b3f' : 'var(--muted)' }}>{fmtFecha(t.fechaVencimiento)}</td>
                      <td style={{ color: 'var(--muted)' }}>{t.auxiliar ?? '—'}</td>
                      <td><PagoEditor id={t.id} valorPago={t.valorPago} estadoPago={t.estadoPago} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
