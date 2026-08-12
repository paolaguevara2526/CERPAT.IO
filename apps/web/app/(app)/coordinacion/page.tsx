// apps/web/app/(app)/coordinacion/page.tsx
//
// Panel de Coordinación (solo consulta) dentro del marco compartido del grupo (app). Consulta la API
// server-side y muestra KPIs, cumplimiento por área, seguimiento por asesor/
// auxiliar y clientes en riesgo del período.

import { exigirRuta } from '@/lib/acceso-server';
import { apiFetch } from '@/lib/session';
import SinEntregarCliente from './SinEntregarCliente';
import NovedadesConsolidado from './NovedadesConsolidado';
import PendientesConsolidado from './PendientesConsolidado';


export const metadata = { title: 'Coordinación' };
export const dynamic = 'force-dynamic';

type Kpis = { total: number; ejecutadas: number; vencidas: number; porAuditar: number; cumplimiento: number };
type PorArea = { area: string; total: number; ejecutadas: number; cumplimiento: number };
type PorCliente = { empresa: string; total: number; ejecutadas: number; vencidas: number; cumplimiento: number };
type PorPersona = { nombre: string; total: number; ejecutadas: number; vencidas: number; cumplimiento: number };
type Respuesta = {
  organizacion: { nombre: string } | null; periodo: string | null; kpis: Kpis | null;
  porArea: PorArea[]; porCliente: PorCliente[]; porAsesor?: PorPersona[]; porAuxiliar?: PorPersona[];
};

async function getCumplimiento(periodo?: string): Promise<{ data: Respuesta | null; error: string | null }> {
  const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
  try {
    const res = await apiFetch(`/plan/cumplimiento${qs}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Respuesta, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red al consultar la API' };
  }
}

function nombrePeriodo(periodo: string | null): string {
  if (!periodo) return '';
  const [y, m] = periodo.split('-').map(Number);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${meses[(m - 1) % 12]} ${y}`;
}
function colorPct(pct: number): string {
  if (pct >= 85) return 'var(--exito)';
  if (pct >= 60) return 'var(--alerta)';
  return 'var(--peligro)';
}

function TablaPersonas({ titulo, sub, filas }: { titulo: string; sub: string; filas: PorPersona[] }) {
  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px' }}>{titulo}</h2>
      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>{sub}</div>
      <div className="panel">
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>Persona</th><th style={{ textAlign: 'right' }}>Tareas</th><th style={{ textAlign: 'right' }}>Venc.</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 22, textAlign: 'center', color: 'var(--muted)' }}>Sin asignaciones todavía.</td></tr>
              ) : filas.map((p) => (
                <tr key={p.nombre}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{p.total}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: p.vencidas > 0 ? 'var(--peligro)' : 'var(--muted)' }}>{p.vencidas}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: colorPct(p.cumplimiento) }}>{p.cumplimiento}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default async function CoordinacionPage({ searchParams }: { searchParams?: { periodo?: string } }) {
  // Solo Coordinador / Auditor (y Administrador). Bloquea acceso por URL.
  const sesion = await exigirRuta('/coordinacion');

  const periodoParam = typeof searchParams?.periodo === 'string' && /^\d{4}-\d{2}$/.test(searchParams.periodo) ? searchParams.periodo : undefined;
  const { data, error } = await getCumplimiento(periodoParam);
  const kpis = data?.kpis;
  const porArea = data?.porArea ?? [];
  const porCliente = data?.porCliente ?? [];
  const porAsesor = data?.porAsesor ?? [];
  const porAuxiliar = data?.porAuxiliar ?? [];
  const enRiesgo = porCliente.filter((c) => c.cumplimiento < 60 || c.vencidas > 0).slice(0, 15);

  const kpiCards = kpis ? [
    { k: 'Actividades', v: kpis.total, color: 'var(--navy)', s: 'del período' },
    { k: 'Ejecutadas', v: kpis.ejecutadas, color: 'var(--exito)', s: 'terminadas/auditadas' },
    { k: 'Vencidas', v: kpis.vencidas, color: 'var(--peligro)', s: 'sin ejecutar' },
    { k: 'Por auditar', v: kpis.porAuditar, color: 'var(--alerta)', s: 'falta auditoría' },
  ] : [];

  return (
    <>
      {error ? (
        <div className="panel" style={{ padding: '18px 20px', color: 'var(--peligro-fuerte)', fontWeight: 600 }}>
          No se pudo cargar el panel: {error}.
          <div style={{ fontWeight: 400, marginTop: 6, color: 'var(--muted)' }}>Verifica que la API responda en <code>/plan/cumplimiento</code>.</div>
        </div>
      ) : !kpis || kpis.total === 0 ? (
        <div className="panel" style={{ padding: 26, color: 'var(--muted)' }}>No hay tareas del plan generadas para este período. Genera el plan del mes para ver los indicadores.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            {kpiCards.map((c) => (
              <div className="tile" key={c.k}><div className="k">{c.k}</div><div className="v" style={{ color: c.color }}>{c.v}</div><div className="s">{c.s}</div></div>
            ))}
          </div>

          {/* Cumplimiento global */}
          <div className="panel" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>Cumplimiento global</span>
              <span style={{ fontWeight: 800, fontSize: 20, color: colorPct(kpis.cumplimiento) }}>{kpis.cumplimiento}%</span>
            </div>
            <div style={{ height: 11, borderRadius: 3, background: 'var(--panel-2)', border: '1px solid var(--line)', overflow: 'hidden', boxShadow: 'inset 0 1px 2px var(--lo)' }}>
              <div style={{ width: `${kpis.cumplimiento}%`, height: '100%', background: colorPct(kpis.cumplimiento) }} />
            </div>
          </div>

          {/* Por área */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>Cumplimiento por área</h2>
            <div className="panel" style={{ padding: '6px 18px 14px' }}>
              {porArea.length === 0 ? <p style={{ color: 'var(--muted)' }}>Sin áreas asignadas.</p> : porArea.map((a) => (
                <div key={a.area} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{a.area}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{a.ejecutadas}/{a.total} · <strong style={{ color: colorPct(a.cumplimiento) }}>{a.cumplimiento}%</strong></span>
                  </div>
                  <div style={{ height: 8, borderRadius: 3, background: 'var(--panel-2)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <div style={{ width: `${a.cumplimiento}%`, height: '100%', background: colorPct(a.cumplimiento) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Por asesor / auxiliar */}
          {(porAsesor.length > 0 || porAuxiliar.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
              <TablaPersonas titulo="Seguimiento por asesor" sub="responsable del área" filas={porAsesor} />
              <TablaPersonas titulo="Seguimiento por auxiliar" sub="ejecutor" filas={porAuxiliar} />
            </div>
          )}

          {/* Insumo que depende del cliente: se muestra ANTES de "clientes en
              riesgo" porque explica parte de ese riesgo — un cliente que no
              entregó no es un incumplimiento de la firma. */}
          <SinEntregarCliente periodo={searchParams?.periodo} />

          {/* Clientes en riesgo */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>Clientes en riesgo <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--muted)' }}>(bajo cumplimiento o con vencidas)</span></h2>
            <div className="panel">
              <div className="dt-wrap">
                <table className="dt">
                  <thead><tr><th>Cliente</th><th style={{ textAlign: 'right' }}>Activid.</th><th style={{ textAlign: 'right' }}>Ejec.</th><th style={{ textAlign: 'right' }}>Venc.</th><th style={{ textAlign: 'right' }}>Cumpl.</th></tr></thead>
                  <tbody>
                    {enRiesgo.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>Ningún cliente en riesgo este período. 🎉</td></tr>
                    ) : enRiesgo.map((c) => (
                      <tr key={c.empresa}>
                        <td style={{ fontWeight: 600 }}>{c.empresa}</td>
                        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{c.total}</td>
                        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{c.ejecutadas}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: c.vencidas > 0 ? 'var(--peligro)' : 'var(--muted)' }}>{c.vencidas}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: colorPct(c.cumplimiento) }}>{c.cumplimiento}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Va por fuera del condicional de KPIs a propósito: las novedades del
          equipo existen aunque el plan del mes no se haya generado. */}
      <div style={{ marginTop: 22 }}>
        <PendientesConsolidado />

        <NovedadesConsolidado />
      </div>
    </>
  );
}
