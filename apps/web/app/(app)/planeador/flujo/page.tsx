// apps/web/app/planeador/flujo/page.tsx — Tablero de flujo del cierre (F2).
// Vista del coordinador/gerente: por cliente, en qué etapa de la cadena va
// (Captura → Entrega → Procesamiento → Revisión), dónde está el cuello y quién
// está en riesgo. Sobre la misma columna que auxiliar y asesor.

import { apiFetch } from '@/lib/session';
import { exigirRuta } from '@/lib/acceso-server';
import { nombrePeriodo } from '../tareas';
import NavegadorPeriodo from '@/app/_components/NavegadorPeriodo';


export const metadata = { title: 'Flujo del cierre' };
export const dynamic = 'force-dynamic';

type EtapaConteo = { estado: string; total?: number; hechas?: number };
type Entrega = EtapaConteo & { origen?: string | null; fecha?: string | null };
type Cliente = {
  empresaId: string; empresa: string;
  etapas: { captura: EtapaConteo; entrega: Entrega; procesamiento: EtapaConteo; revision: EtapaConteo };
  etapaActual: string; avance: number; enRiesgo: boolean; vencidas: number;
};
type Resumen = { clientes: number; porEtapa: Record<string, number>; cuello: string | null; enRiesgo: number; cerrados: number };
type Flujo = { periodo: string | null; resumen: Resumen | null; clientes: Cliente[] };

async function fetchFlujo(periodo?: string): Promise<{ data: Flujo | null; error: string | null }> {
  const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
  try {
    const res = await apiFetch(`/plan/flujo${qs}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Flujo, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

const ETAPA_LABEL: Record<string, string> = { captura: 'Captura', entrega: 'Entrega', procesamiento: 'Procesamiento', revision: 'Revisión', cierre: 'Cerrado' };

// Colores por estado de etapa (funcionan sobre los temas del planeador).
const CHIP: Record<string, { bg: string; fg: string; br: string }> = {
  listo: { bg: 'var(--exito-suave)', fg: 'var(--exito)', br: 'var(--exito-borde)' },
  entregado: { bg: 'var(--exito-suave)', fg: 'var(--exito)', br: 'var(--exito-borde)' },
  en_curso: { bg: 'var(--info-suave)', fg: 'var(--info)', br: 'var(--info-borde)' },
  pendiente: { bg: 'var(--alerta-suave)', fg: 'var(--alerta)', br: 'var(--alerta-borde)' },
  na: { bg: 'transparent', fg: 'var(--muted)', br: 'transparent' },
};
const ETIQUETA_ESTADO: Record<string, string> = { listo: 'Listo', entregado: 'Entregado', en_curso: 'En curso', pendiente: 'Pendiente', na: '—' };

function colorPct(pct: number): string {
  if (pct >= 85) return 'var(--exito)';
  if (pct >= 60) return 'var(--alerta)';
  return 'var(--peligro)';
}

// Cómo llegó el insumo. "Entregado" a secas hacía ver que la cadena avanzó sola
// cuando lo que hubo fue un "Liberar período" en bloque con la captura sin
// terminar: dos situaciones muy distintas que se leían igual.
const ORIGEN_LABEL: Record<string, string> = {
  auto: 'al terminar captura', manual: 'liberado a mano', cliente: 'lo mandó el cliente', mixto: 'mixto',
};

function EtapaCelda({ estado, total, hechas, actual, nota, href, titulo }: {
  estado: string; total?: number; hechas?: number; actual: boolean;
  nota?: string | null; href?: string; titulo?: string;
}) {
  const c = CHIP[estado] ?? CHIP.na;
  const cuenta = total && total > 0 ? `${hechas ?? 0}/${total}` : null;
  const pie = nota ?? cuenta;
  const cuerpo = (
    <>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: c.fg, whiteSpace: 'nowrap' }}>{ETIQUETA_ESTADO[estado] ?? estado}</span>
      {pie && <span style={{ fontSize: 10.5, color: c.fg, opacity: 0.85, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{pie}</span>}
    </>
  );
  const caja: React.CSSProperties = {
    display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 74,
    padding: '6px 8px', borderRadius: 8, background: c.bg,
    border: `1px solid ${actual ? c.fg : c.br}`, boxShadow: actual ? `0 0 0 2px ${c.bg}` : 'none',
  };
  // Sin tareas detrás no se enlaza: un enlace que abre una lista vacía enseña a
  // desconfiar de los demás.
  if (!href) return <div style={caja} title={titulo}>{cuerpo}</div>;
  return <a href={href} title={titulo ?? 'Ver estas tareas'} style={{ ...caja, textDecoration: 'none', cursor: 'pointer' }}>{cuerpo}</a>;
}

/** Enlace a la Lista, ya filtrada: es la pantalla donde sí se trabaja. */
function urlLista(p: { periodo?: string | null; empresaId?: string; fase?: string }): string {
  const q = new URLSearchParams();
  if (p.empresaId) q.set('empresaId', p.empresaId);
  if (p.fase) q.set('fase', p.fase);
  if (p.periodo) q.set('periodo', p.periodo);
  const s = q.toString();
  return `/planeador/lista${s ? `?${s}` : ''}`;
}

function Flecha() {
  return <span aria-hidden="true" style={{ color: 'var(--muted)', fontSize: 13, alignSelf: 'center' }}>›</span>;
}

export default async function FlujoPage({ searchParams }: { searchParams?: Record<string, string> }) {
  await exigirRuta('/planeador/flujo'); // solo Coordinador / Auditor (y Admin)
  const periodo = searchParams?.periodo && /^\d{4}-\d{2}$/.test(searchParams.periodo) ? searchParams.periodo : undefined;
  const { data, error } = await fetchFlujo(periodo);
  const r = data?.resumen;
  const clientes = data?.clientes ?? [];

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '10px 12px', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderTop: '1px solid var(--border)', verticalAlign: 'middle' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Flujo del cierre</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {r?.clientes ?? 0} clientes</span>
      </div>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
        En qué etapa va cada cliente, dónde está el cuello y quién está en riesgo — sobre la misma cadena que ven el auxiliar y el asesor.
        Esta pantalla <strong>diagnostica, no se trabaja</strong>: <strong>haz clic en el cliente o en cualquier etapa</strong> para abrir esas tareas en la Lista, que es donde se cambian los estados.
      </p>

      <div style={{ marginBottom: 14 }}><NavegadorPeriodo /></div>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: 'var(--peligro-fuerte)', fontWeight: 600 }}>No se pudo cargar el flujo: {error}.</div>
      ) : clientes.length === 0 ? (
        <div className="panel" style={{ padding: 26, color: 'var(--muted)' }}>No hay tareas del plan generadas en este período. Genera el plan por cliente para ver el flujo.</div>
      ) : (
        <>
          {/* Resumen */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <ResumenCard titulo="Cuello del período" valor={r?.cuello ? ETAPA_LABEL[r.cuello] : '—'} sub={r?.cuello ? `${r.porEtapa[r.cuello]} clientes detenidos aquí` : 'sin cuello'} tono="#a9741a"
              href={r?.cuello && r.cuello !== 'entrega' && r.cuello !== 'cierre' ? urlLista({ periodo: data?.periodo, fase: r.cuello }) : undefined} />
            <ResumenCard titulo="En riesgo" valor={String(r?.enRiesgo ?? 0)} sub="con tareas vencidas" tono="#d64b3f" />
            <ResumenCard titulo="Cerrados" valor={`${r?.cerrados ?? 0}/${r?.clientes ?? 0}`} sub="cadena completa" tono="#12855f" />
            <DistribucionEtapas porEtapa={r?.porEtapa} total={r?.clientes ?? 0} />
          </div>

          {/* Tablero por cliente */}
          <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={th}>Cliente</th>
                  <th style={{ ...th, textAlign: 'center' }}>Captura</th>
                  <th style={{ ...th, textAlign: 'center' }}></th>
                  <th style={{ ...th, textAlign: 'center' }}>Entrega</th>
                  <th style={{ ...th, textAlign: 'center' }}></th>
                  <th style={{ ...th, textAlign: 'center' }}>Procesamiento</th>
                  <th style={{ ...th, textAlign: 'center' }}></th>
                  <th style={{ ...th, textAlign: 'center' }}>Revisión</th>
                  <th style={{ ...th, textAlign: 'right' }}>Avance</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.empresaId}>
                    <td style={{ ...td }}>
                      {/* El nombre entra a todo lo del cliente en el mes: la
                          pregunta que sigue a "está detenido" es "¿en qué?". */}
                      <a href={urlLista({ periodo: data?.periodo, empresaId: c.empresaId })}
                        style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}
                        title={`Ver las tareas de ${c.empresa} en este período`}>{c.empresa}</a>
                      {c.enRiesgo
                        ? <a href={urlLista({ periodo: data?.periodo, empresaId: c.empresaId })} title="Ver las tareas de este cliente" style={{ display: 'inline-block', marginTop: 3, fontSize: 10.5, fontWeight: 800, color: 'var(--peligro)', background: 'var(--peligro-suave)', border: '1px solid #f3c6bf', borderRadius: 20, padding: '1px 7px', textDecoration: 'none' }}>⚠ {c.vencidas} vencida{c.vencidas === 1 ? '' : 's'}</a>
                        : c.etapaActual === 'cierre'
                          ? <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10.5, fontWeight: 800, color: 'var(--exito)', background: 'var(--exito-suave)', border: '1px solid #bfe3d1', borderRadius: 20, padding: '1px 7px' }}>✓ Cerrado</span>
                          : <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10.5, color: 'var(--muted)' }}>en {ETAPA_LABEL[c.etapaActual]?.toLowerCase()}</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}><EtapaCelda estado={c.etapas.captura.estado} total={c.etapas.captura.total} hechas={c.etapas.captura.hechas} actual={c.etapaActual === 'captura'}
                      href={c.etapas.captura.total ? urlLista({ periodo: data?.periodo, empresaId: c.empresaId, fase: 'captura' }) : undefined} /></td>
                    <td style={{ ...td, textAlign: 'center', padding: 0 }}><Flecha /></td>
                    <td style={{ ...td, textAlign: 'center' }}><EtapaCelda estado={c.etapas.entrega.estado} actual={c.etapaActual === 'entrega'}
                      nota={c.etapas.entrega.origen ? ORIGEN_LABEL[c.etapas.entrega.origen] ?? c.etapas.entrega.origen : null}
                      titulo={c.etapas.entrega.origen === 'manual'
                        ? 'El insumo se liberó a mano (Liberar período), no porque la captura terminara.'
                        : c.etapas.entrega.origen === 'auto' ? 'Se liberó solo al quedar terminada toda la captura.' : undefined} /></td>
                    <td style={{ ...td, textAlign: 'center', padding: 0 }}><Flecha /></td>
                    <td style={{ ...td, textAlign: 'center' }}><EtapaCelda estado={c.etapas.procesamiento.estado} total={c.etapas.procesamiento.total} hechas={c.etapas.procesamiento.hechas} actual={c.etapaActual === 'procesamiento'}
                      href={c.etapas.procesamiento.total ? urlLista({ periodo: data?.periodo, empresaId: c.empresaId, fase: 'procesamiento' }) : undefined} /></td>
                    <td style={{ ...td, textAlign: 'center', padding: 0 }}><Flecha /></td>
                    <td style={{ ...td, textAlign: 'center' }}><EtapaCelda estado={c.etapas.revision.estado} total={c.etapas.revision.total} hechas={c.etapas.revision.hechas} actual={c.etapaActual === 'revision'}
                      href={c.etapas.revision.total ? urlLista({ periodo: data?.periodo, empresaId: c.empresaId, fase: 'revision' }) : undefined} /></td>
                    <td style={{ ...td, textAlign: 'right', minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <div style={{ width: 64, height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${c.avance}%`, height: '100%', background: colorPct(c.avance) }} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: colorPct(c.avance), fontVariantNumeric: 'tabular-nums', width: 34, textAlign: 'right' }}>{c.avance}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function ResumenCard({ titulo, valor, sub, tono, href }: { titulo: string; valor: string; sub: string; tono: string; href?: string }) {
  const dentro = (
    <>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: tono, textTransform: 'capitalize', lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{sub}{href ? ' \u203a' : ''}</div>
    </>
  );
  const caja: React.CSSProperties = { padding: '12px 15px', minWidth: 150, flex: '1 1 150px' };
  // "64 clientes detenidos aqui" sin manera de ver cuales es un diagnostico sin
  // salida: el dato asusta y no se puede hacer nada con el.
  if (!href) return <div className="panel" style={caja}>{dentro}</div>;
  return <a className="panel" href={href} style={{ ...caja, textDecoration: 'none', display: 'block' }}>{dentro}</a>;
}

function DistribucionEtapas({ porEtapa, total }: { porEtapa?: Record<string, number>; total: number }) {
  const orden = ['captura', 'entrega', 'procesamiento', 'revision', 'cierre'] as const;
  const tono: Record<string, string> = { captura: 'var(--alerta)', entrega: 'var(--alerta)', procesamiento: 'var(--info)', revision: '#6b4a86', cierre: 'var(--exito)' };
  return (
    <div className="panel" style={{ padding: '12px 15px', flex: '2 1 260px', minWidth: 240 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, marginBottom: 8 }}>Dónde está cada cliente</div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--border)' }}>
        {orden.map((e) => {
          const n = porEtapa?.[e] ?? 0;
          if (!n) return null;
          return <div key={e} title={`${ETAPA_LABEL[e]}: ${n}`} style={{ width: `${total ? (n / total) * 100 : 0}%`, background: tono[e] }} />;
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
        {orden.map((e) => {
          const n = porEtapa?.[e] ?? 0;
          if (!n) return null;
          return (
            <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: tono[e] }} />{ETAPA_LABEL[e]} <b style={{ color: 'var(--ink)' }}>{n}</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}
