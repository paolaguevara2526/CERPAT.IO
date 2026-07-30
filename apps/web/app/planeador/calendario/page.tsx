// apps/web/app/planeador/calendario/page.tsx — Calendario mensual del plan.
// Ubica cada tarea del período en su día de vencimiento.

import { fetchTareas, ESTADO_META, AREAS, nombrePeriodo, type Tarea } from '../tareas';

export const dynamic = 'force-dynamic';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function mesValido(v?: string): string {
  if (v && /^\d{4}-\d{2}$/.test(v)) return v;
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}
function desplazarMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function CalendarioPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const mes = mesValido(searchParams?.mes);
  const area = searchParams?.area || '';
  const qs = new URLSearchParams({ periodo: mes });
  if (area) qs.set('area', area);
  const { data, error } = await fetchTareas(qs.toString());
  const tareas = data?.tareas ?? [];

  // Agrupa por día de vencimiento (YYYY-MM-DD dentro del mes mostrado).
  const porDia = new Map<string, Tarea[]>();
  for (const t of tareas) {
    const dia = (t.fechaVencimiento || '').slice(0, 10);
    if (!dia.startsWith(mes)) continue;
    const arr = porDia.get(dia);
    if (arr) arr.push(t); else porDia.set(dia, [t]);
  }

  const [y, m] = mes.split('-').map(Number);
  const primerDiaSemana = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // 0 = lunes
  const diasEnMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const hoyISO = new Date().toISOString().slice(0, 10);
  const linkMes = (mm: string) => `?mes=${mm}${area ? `&area=${encodeURIComponent(area)}` : ''}`;
  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Calendario</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href={linkMes(desplazarMes(mes, -1))} className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>‹</a>
          <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>{nombrePeriodo(mes)}</span>
          <a href={linkMes(desplazarMes(mes, 1))} className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>›</a>
        </div>
      </div>

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input type="hidden" name="mes" value={mes} />
        <select name="area" defaultValue={area} style={sel}>
          <option value="">Todas las áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>{tareas.length} tareas · vencen este mes: {[...porDia.values()].reduce((n, a) => n + a.length, 0)}</span>
      </form>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudo cargar el calendario: {error}.</div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {DIAS.map((d) => (
              <div key={d} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)' }}>{d}</div>
            ))}
            {celdas.map((dia, i) => {
              const diaISO = dia ? `${mes}-${String(dia).padStart(2, '0')}` : '';
              const items = dia ? (porDia.get(diaISO) ?? []) : [];
              const esHoy = diaISO === hoyISO;
              return (
                <div key={i} style={{
                  minHeight: 92, padding: 6, borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--line)',
                  borderBottom: '1px solid var(--line)', background: dia ? (esHoy ? 'rgba(52,201,139,0.08)' : 'var(--panel)') : 'var(--panel-2)',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}>
                  {dia && (
                    <div style={{ fontSize: 11.5, fontWeight: esHoy ? 800 : 600, color: esHoy ? '#1c8a5e' : 'var(--muted)', marginBottom: 1 }}>{dia}</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', maxHeight: 118 }}>
                    {items.slice(0, 4).map((t) => {
                      const em = ESTADO_META[t.estado] ?? { label: t.estado, color: '#5b6a82' };
                      return (
                        <div key={t.id} title={`${t.titulo} · ${t.empresa ?? ''} · ${em.label}`}
                          style={{ fontSize: 10.5, lineHeight: 1.25, padding: '2px 5px', borderRadius: 3, borderLeft: `3px solid ${em.color}`, background: `${em.color}12`, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.empresa ?? t.titulo}
                        </div>
                      );
                    })}
                    {items.length > 4 && <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, paddingLeft: 3 }}>+{items.length - 4} más</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '10px 2px 0' }}>Cada tarjeta es una tarea ubicada en su fecha de vencimiento; el color indica el estado. Pasa el cursor para ver el detalle.</p>
    </>
  );
}
