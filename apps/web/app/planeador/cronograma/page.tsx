// apps/web/app/planeador/cronograma/page.tsx
// Plan de Trabajo: matriz anual de cumplimiento — filas (cliente o área) ×
// columnas (los 12 meses), con semáforo por celda. Reutiliza
// GET /plan/cumplimiento (una llamada por mes).

import { apiFetch } from '@/lib/session';
import { exigirRuta } from '@/lib/acceso-server';


export const metadata = { title: 'Plan de Trabajo' };
export const dynamic = 'force-dynamic';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type Fila = { total: number; ejecutadas: number; vencidas: number; cumplimiento: number };
type Cumpl = {
  porArea?: { area: string; total: number; ejecutadas: number; cumplimiento: number }[];
  porCliente?: { empresa: string; total: number; ejecutadas: number; vencidas: number; cumplimiento: number }[];
};

async function fetchMes(periodo: string): Promise<Cumpl | null> {
  try {
    const res = await apiFetch(`/plan/cumplimiento?periodo=${periodo}`);
    if (!res.ok) return null;
    return (await res.json()) as Cumpl;
  } catch { return null; }
}

function colorPct(p: number): { fg: string; bg: string } {
  if (p >= 85) return { fg: '#15934F', bg: 'rgba(34,166,112,0.16)' };
  if (p >= 60) return { fg: '#C77A0A', bg: 'rgba(198,124,0,0.16)' };
  return { fg: '#D23B32', bg: 'rgba(207,68,54,0.16)' };
}

export default async function CronogramaPage({ searchParams }: { searchParams?: Record<string, string> }) {
  await exigirRuta('/planeador/cronograma'); // solo Coordinador / Auditor (y Admin)
  const now = new Date();
  const anio = /^\d{4}$/.test(searchParams?.anio ?? '') ? Number(searchParams!.anio) : now.getFullYear();
  const eje = searchParams?.eje === 'area' ? 'area' : 'cliente';
  const q = (searchParams?.q ?? '').toLowerCase();

  const periodos = MESES.map((_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
  const meses = await Promise.all(periodos.map(fetchMes));

  // filas[nombre][mesIndex] = Fila
  const filas = new Map<string, (Fila | null)[]>();
  meses.forEach((m, mi) => {
    const lista = eje === 'area'
      ? (m?.porArea ?? []).map((a) => ({ nombre: a.area, total: a.total, ejecutadas: a.ejecutadas, vencidas: 0, cumplimiento: a.cumplimiento }))
      : (m?.porCliente ?? []).map((c) => ({ nombre: c.empresa, total: c.total, ejecutadas: c.ejecutadas, vencidas: c.vencidas, cumplimiento: c.cumplimiento }));
    for (const it of lista) {
      if (!filas.has(it.nombre)) filas.set(it.nombre, Array(12).fill(null));
      filas.get(it.nombre)![mi] = { total: it.total, ejecutadas: it.ejecutadas, vencidas: it.vencidas, cumplimiento: it.cumplimiento };
    }
  });

  // Resumen anual por fila + orden (en riesgo primero).
  const rows = Array.from(filas.entries()).map(([nombre, celdas]) => {
    const total = celdas.reduce((s, c) => s + (c?.total ?? 0), 0);
    const ejec = celdas.reduce((s, c) => s + (c?.ejecutadas ?? 0), 0);
    const venc = celdas.reduce((s, c) => s + (c?.vencidas ?? 0), 0);
    return { nombre, celdas, total, ejec, venc, pct: total ? Math.round((ejec / total) * 100) : 0 };
  }).filter((r) => !q || r.nombre.toLowerCase().includes(q)).sort((a, b) => a.pct - b.pct || b.total - a.total);

  const totAnual = rows.reduce((s, r) => s + r.total, 0);
  const ejecAnual = rows.reduce((s, r) => s + r.ejec, 0);
  const vencAnual = rows.reduce((s, r) => s + r.venc, 0);
  const pctAnual = totAnual ? Math.round((ejecAnual / totAnual) * 100) : 0;
  const mesActual = anio === now.getFullYear() ? now.getMonth() : -1;

  const link = (a: number, e: string) => `?anio=${a}&eje=${e}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const sel: React.CSSProperties = { padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Plan de Trabajo</h1>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 0' }}>Cumplimiento del año por {eje === 'area' ? 'área' : 'cliente'}, mes a mes.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href={link(anio - 1, eje)} className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>‹</a>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 54, textAlign: 'center' }}>{anio}</span>
          <a href={link(anio + 1, eje)} className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>›</a>
        </div>
      </div>

      {/* KPIs anuales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        <div className="tile"><div className="k">Actividades</div><div className="v" style={{ color: 'var(--navy)' }}>{totAnual}</div><div className="s">del año</div></div>
        <div className="tile"><div className="k">Ejecutadas</div><div className="v" style={{ color: '#15934F' }}>{ejecAnual}</div><div className="s">{pctAnual}% cumplimiento</div></div>
        <div className="tile"><div className="k">Vencidas</div><div className="v" style={{ color: vencAnual ? '#D23B32' : '#8a94a6' }}>{vencAnual}</div><div className="s">atraso acumulado</div></div>
        <div className="tile"><div className="k">{eje === 'area' ? 'Áreas' : 'Clientes'}</div><div className="v" style={{ color: 'var(--navy)' }}>{rows.length}</div><div className="s">en el plan</div></div>
      </div>

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <input type="hidden" name="anio" value={anio} />
        <select name="eje" defaultValue={eje} style={sel}>
          <option value="cliente">Por cliente</option>
          <option value="area">Por área</option>
        </select>
        <input name="q" defaultValue={searchParams?.q ?? ''} placeholder={`Buscar ${eje === 'area' ? 'área' : 'cliente'}…`} style={{ ...sel, minWidth: 200, flex: 1 }} />
        <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
        <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(34,166,112,0.16)', border: '1px solid #15934F' }} /> ≥85%</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(198,124,0,0.16)', border: '1px solid #C77A0A' }} /> 60–84%</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(207,68,54,0.16)', border: '1px solid #D23B32' }} /> &lt;60%</span>
        </span>
      </form>

      <div className="panel" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table className="dt" style={{ minWidth: 780, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--panel-2)', textAlign: 'left', minWidth: 200 }}>{eje === 'area' ? 'Área' : 'Cliente'}</th>
              {MESES.map((m, i) => <th key={m} style={{ textAlign: 'center', minWidth: 46, color: i === mesActual ? 'var(--navy)' : 'var(--muted)', fontWeight: i === mesActual ? 800 : 700 }}>{m}</th>)}
              <th style={{ textAlign: 'center', minWidth: 56 }}>Año</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={14} style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>No hay actividades del plan para {anio}.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.nombre}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--panel)', fontWeight: 600, fontSize: 12.5 }}>{r.nombre}</td>
                {r.celdas.map((c, i) => {
                  if (!c || c.total === 0) return <td key={i} style={{ textAlign: 'center', color: 'var(--future-ink, #9aa8a0)' }}>{i > mesActual && mesActual >= 0 ? '·' : '—'}</td>;
                  const col = colorPct(c.cumplimiento);
                  return (
                    <td key={i} style={{ textAlign: 'center', padding: '5px 3px' }} title={`${c.ejecutadas}/${c.total} · ${c.cumplimiento}%${c.vencidas ? ` · ${c.vencidas} vencida(s)` : ''}`}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 20, borderRadius: 6, fontSize: 10, fontWeight: 800, color: col.fg, background: col.bg }}>{c.cumplimiento}</span>
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontWeight: 800, color: colorPct(r.pct).fg }}>{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '10px 2px 0' }}>Cada celda es el % de cumplimiento de ese {eje === 'area' ? 'área' : 'cliente'} en el mes. Pasa el cursor para ver ejecutadas/total. Los meses futuros aparecen vacíos.</p>
    </>
  );
}
