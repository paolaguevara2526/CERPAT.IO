// apps/web/app/coordinacion/page.tsx
//
// Panel de Coordinación (solo consulta). Server Component que consulta la API
// (server-side, sin CORS) y muestra los indicadores de cumplimiento del Plan de
// Trabajo del período: KPIs, cumplimiento por área y clientes en riesgo.
//
// Los ejes asesor/auxiliar quedarán poblados cuando existan usuarios y
// asignaciones por área; hoy el cumplimiento arranca en 0 % porque las tareas
// generadas están "por iniciar" hasta que el equipo las marque.

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api-production-678b8.up.railway.app';
const BRAND = '#34C98B';

type Kpis = { total: number; ejecutadas: number; vencidas: number; porAuditar: number; cumplimiento: number };
type PorArea = { area: string; total: number; ejecutadas: number; cumplimiento: number };
type PorCliente = { empresa: string; total: number; ejecutadas: number; vencidas: number; cumplimiento: number };
type Respuesta = {
  organizacion: { nombre: string } | null;
  periodo: string | null;
  kpis: Kpis | null;
  porArea: PorArea[];
  porCliente: PorCliente[];
};

async function getCumplimiento(periodo?: string): Promise<{ data: Respuesta | null; error: string | null }> {
  const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
  try {
    const res = await fetch(`${API_URL}/plan/cumplimiento${qs}`, { cache: 'no-store' });
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

function colorCumplimiento(pct: number): string {
  if (pct >= 85) return '#34C98B';
  if (pct >= 60) return '#E0A100';
  return '#E85D4E';
}

export default async function CoordinacionPage({ searchParams }: { searchParams?: { periodo?: string } }) {
  const periodoParam = typeof searchParams?.periodo === 'string' && /^\d{4}-\d{2}$/.test(searchParams.periodo) ? searchParams.periodo : undefined;
  const { data, error } = await getCumplimiento(periodoParam);
  const kpis = data?.kpis;
  const porArea = data?.porArea ?? [];
  const porCliente = data?.porCliente ?? [];
  const enRiesgo = porCliente.filter((c) => c.cumplimiento < 60 || c.vencidas > 0).slice(0, 15);

  const kpiCards = kpis
    ? [
        { label: 'Actividades del período', valor: kpis.total, color: '#20259C', sub: 'tareas del plan generadas' },
        { label: 'Ejecutadas', valor: kpis.ejecutadas, color: BRAND, sub: 'terminadas o auditadas' },
        { label: 'Vencidas', valor: kpis.vencidas, color: '#E85D4E', sub: 'sin ejecutar tras vencer' },
        { label: 'Por auditar', valor: kpis.porAuditar, color: '#E0A100', sub: 'terminadas, falta auditoría' },
      ]
    : [];

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#F5F6F8', minHeight: '100vh', margin: 0, color: '#101828' }}>
      <header style={{ background: 'linear-gradient(135deg,#20259C,#11154F)', color: '#fff', padding: '28px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 600 }}>Planeador CERPAT · Panel de Coordinación · solo consulta</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800 }}>
            Cumplimiento del Plan de Trabajo{data?.organizacion ? ` · ${data.organizacion.nombre}` : ''}
          </h1>
          {data?.periodo && (
            <div style={{ fontSize: 14, opacity: 0.85, marginTop: 6, textTransform: 'capitalize' }}>Período: {nombrePeriodo(data.periodo)}</div>
          )}
        </div>
      </header>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 60px' }}>
        {error ? (
          <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 12, padding: '18px 20px', fontSize: 14, fontWeight: 600 }}>
            No se pudo cargar el panel: {error}.
            <div style={{ fontWeight: 400, marginTop: 6, color: '#7a271d' }}>
              Verifica que la API (<code>{API_URL}</code>) esté en línea y responda en <code>/plan/cumplimiento</code>.
            </div>
          </div>
        ) : !kpis || kpis.total === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px', boxShadow: '0 1px 2px rgba(16,24,40,0.05),0 4px 14px rgba(16,24,40,0.06)', color: '#667085' }}>
            No hay tareas del plan generadas para este período. Genera el plan del mes para ver los indicadores.
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
              {kpiCards.map((k) => (
                <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.05),0 4px 14px rgba(16,24,40,0.06)' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#667085', fontWeight: 800 }}>{k.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: k.color, marginTop: 6 }}>{k.valor}</div>
                  <div style={{ fontSize: 12, color: '#98A2B3', marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Cumplimiento global */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 2px rgba(16,24,40,0.05),0 4px 14px rgba(16,24,40,0.06)', marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>Cumplimiento global</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: colorCumplimiento(kpis.cumplimiento) }}>{kpis.cumplimiento}%</span>
              </div>
              <div style={{ height: 12, borderRadius: 8, background: '#EEF0F3', overflow: 'hidden' }}>
                <div style={{ width: `${kpis.cumplimiento}%`, height: '100%', background: colorCumplimiento(kpis.cumplimiento), transition: 'width .3s' }} />
              </div>
            </div>

            {/* Por área */}
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px' }}>Cumplimiento por área</h2>
            <div style={{ background: '#fff', borderRadius: 14, padding: '8px 24px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.05),0 4px 14px rgba(16,24,40,0.06)', marginBottom: 28 }}>
              {porArea.length === 0 ? (
                <p style={{ color: '#667085', padding: '16px 0' }}>Sin áreas asignadas.</p>
              ) : (
                porArea.map((a) => (
                  <div key={a.area} style={{ padding: '14px 0', borderBottom: '1px solid #F0F1F3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{a.area}</span>
                      <span style={{ fontSize: 13, color: '#667085' }}>
                        {a.ejecutadas}/{a.total} · <strong style={{ color: colorCumplimiento(a.cumplimiento) }}>{a.cumplimiento}%</strong>
                      </span>
                    </div>
                    <div style={{ height: 9, borderRadius: 6, background: '#EEF0F3', overflow: 'hidden' }}>
                      <div style={{ width: `${a.cumplimiento}%`, height: '100%', background: colorCumplimiento(a.cumplimiento) }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Clientes en riesgo */}
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px' }}>
              Clientes en riesgo <span style={{ fontWeight: 500, fontSize: 13, color: '#667085' }}>(bajo cumplimiento o con tareas vencidas)</span>
            </h2>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.05),0 4px 14px rgba(16,24,40,0.06)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr>
                      {['Cliente', 'Actividades', 'Ejecutadas', 'Vencidas', 'Cumplimiento'].map((h) => (
                        <th key={h} style={{ textAlign: h === 'Cliente' ? 'left' : 'right', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.4, color: '#667085', fontWeight: 800, padding: '12px 14px', borderBottom: '1px solid #E4E7EC', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enRiesgo.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#667085' }}>Ningún cliente en riesgo este período. 🎉</td></tr>
                    ) : (
                      enRiesgo.map((c) => (
                        <tr key={c.empresa}>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', fontWeight: 600 }}>{c.empresa}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467', textAlign: 'right' }}>{c.total}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467', textAlign: 'right' }}>{c.ejecutadas}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', textAlign: 'right', fontWeight: 700, color: c.vencidas > 0 ? '#E85D4E' : '#475467' }}>{c.vencidas}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', textAlign: 'right', fontWeight: 800, color: colorCumplimiento(c.cumplimiento) }}>{c.cumplimiento}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: '#667085', marginTop: 16, lineHeight: 1.6 }}>
              Vista de solo consulta para perfiles de coordinación. El seguimiento por asesor y por auxiliar se activará cuando se
              carguen los usuarios y sus asignaciones por área. El cumplimiento se actualiza a medida que el equipo marca las tareas
              como ejecutadas y auditadas.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
