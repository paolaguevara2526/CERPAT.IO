// apps/web/app/planeador/page.tsx — Inicio del planeador: resumen del período.
// Combina el resumen personal (mis tareas) con el cumplimiento global.

import { getSessionUser } from '@/lib/session';
import { fetchTareas, ESTADO_META, nombrePeriodo, type Tarea } from './tareas';
import { fetchCumplimiento, colorPct } from './inicio';

export const dynamic = 'force-dynamic';

const EJECUTADA = ['terminado', 'auditado'];

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return ''; }
}
function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

function EstadoChip({ estado }: { estado: string }) {
  const em = ESTADO_META[estado] ?? { label: estado, color: '#5b6a82' };
  return <span className="chip" style={{ color: em.color, background: `${em.color}18`, borderColor: `${em.color}44`, fontSize: 10.5 }}>{em.label}</span>;
}

export default async function InicioPage() {
  const sesion = await getSessionUser();
  const [mias, glob] = await Promise.all([fetchTareas('mias=1'), fetchCumplimiento()]);

  const misTareas: Tarea[] = mias.data?.tareas ?? [];
  const periodo = mias.data?.periodo ?? glob.data?.periodo ?? null;
  const hoy = new Date();
  const pendientes = misTareas.filter((t) => !EJECUTADA.includes(t.estado) && t.estado !== 'no_realizado');
  const vencidas = pendientes.filter((t) => new Date(t.fechaVencimiento) < hoy);
  const ejecutadasMias = misTareas.filter((t) => EJECUTADA.includes(t.estado)).length;
  const proximas = [...pendientes].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)).slice(0, 8);

  const kpisGlob = glob.data?.kpis;

  const tiles = [
    { k: 'Mis tareas', v: misTareas.length, color: 'var(--navy)', s: 'del período' },
    { k: 'Pendientes', v: pendientes.length, color: '#2f6fd0', s: 'sin ejecutar' },
    { k: 'Vencidas', v: vencidas.length, color: vencidas.length > 0 ? '#d64b3f' : '#8a94a6', s: 'requieren atención' },
    { k: 'Ejecutadas', v: ejecutadasMias, color: '#22a670', s: 'terminadas/auditadas' },
  ];

  const accesos = [
    { href: '/planeador/tablero', icon: '▦', label: 'Tablero', sub: 'Arrastra por estado' },
    { href: '/planeador/lista', icon: '☰', label: 'Lista', sub: 'Todas las tareas' },
    { href: '/planeador/mi-dia', icon: '☆', label: 'Mi Día', sub: 'Solo lo mío' },
    { href: '/coordinacion', icon: '📊', label: 'Coordinación', sub: 'Indicadores' },
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Hola{sesion ? `, ${primerNombre(sesion.nombre)}` : ''} 👋</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{periodo ? nombrePeriodo(periodo) : ''}</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>Este es tu resumen del período. Guiamos a nuestros clientes a la cima.</p>

      {/* KPIs personales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        {tiles.map((c) => (
          <div className="tile" key={c.k}><div className="k">{c.k}</div><div className="v" style={{ color: c.color }}>{c.v}</div><div className="s">{c.s}</div></div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18, marginBottom: 20 }}>
        {/* Próximos vencimientos (míos) */}
        <div>
          <h2 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 10px' }}>Mis próximos vencimientos</h2>
          <div className="panel">
            <div className="dt-wrap">
              <table className="dt">
                <thead><tr><th>Actividad</th><th>Cliente</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th>Estado</th></tr></thead>
                <tbody>
                  {mias.error ? (
                    <tr><td colSpan={4} style={{ padding: 22, textAlign: 'center', color: '#b42318' }}>No se pudieron cargar tus tareas: {mias.error}.</td></tr>
                  ) : proximas.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>No tienes tareas pendientes este período. 🎉</td></tr>
                  ) : proximas.map((t) => {
                    const venc = new Date(t.fechaVencimiento) < hoy;
                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600 }}>{t.titulo}</td>
                        <td style={{ color: 'var(--muted)' }}>{t.empresa ?? '—'}</td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: venc ? 800 : 500, color: venc ? '#d64b3f' : 'var(--muted)' }}>{fmtFecha(t.fechaVencimiento)}</td>
                        <td><EstadoChip estado={t.estado} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {pendientes.length > proximas.length && (
            <div style={{ marginTop: 8, fontSize: 12.5 }}>
              <a href="/planeador/mi-dia" style={{ color: 'var(--navy)', fontWeight: 700, textDecoration: 'none' }}>Ver mis {pendientes.length} pendientes →</a>
            </div>
          )}
        </div>

        {/* Cumplimiento global + accesos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h2 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 10px' }}>Cumplimiento global</h2>
            <div className="panel" style={{ padding: '16px 18px' }}>
              {glob.error || !kpisGlob ? (
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>Sin datos del período.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{kpisGlob.ejecutadas}/{kpisGlob.total} actividades</span>
                    <span style={{ fontWeight: 800, fontSize: 20, color: colorPct(kpisGlob.cumplimiento) }}>{kpisGlob.cumplimiento}%</span>
                  </div>
                  <div style={{ height: 11, borderRadius: 3, background: 'var(--panel-2)', border: '1px solid var(--line)', overflow: 'hidden', boxShadow: 'inset 0 1px 2px var(--lo)' }}>
                    <div style={{ width: `${kpisGlob.cumplimiento}%`, height: '100%', background: colorPct(kpisGlob.cumplimiento) }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12.5 }}>
                    <span style={{ color: 'var(--muted)' }}>Vencidas: <strong style={{ color: kpisGlob.vencidas > 0 ? '#d64b3f' : 'var(--ink)' }}>{kpisGlob.vencidas}</strong></span>
                    <span style={{ color: 'var(--muted)' }}>Por auditar: <strong style={{ color: kpisGlob.porAuditar > 0 ? '#d98a00' : 'var(--ink)' }}>{kpisGlob.porAuditar}</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 10px' }}>Accesos rápidos</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {accesos.map((a) => (
                <a key={a.href} href={a.href} className="panel" style={{ padding: '12px 14px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{a.icon}</span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5 }}>{a.label}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.sub}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
