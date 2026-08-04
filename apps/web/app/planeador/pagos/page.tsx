// apps/web/app/planeador/pagos/page.tsx — Vista de Pagos.
// Un solo listado "Por pagar" que junta:
//   - vencimientos tributarios ya marcados Presentado (sin pago) / y pagado, y
//   - pagos pendientes agregados a mano (deudas de años anteriores).
// Con KPIs de riesgo, semáforo, límite de pago (INEFICAZ/RST) e interés de mora
// (DIAN) a hoy. Debajo queda solo el botón "+ Agregar pago pendiente".

import { apiFetch } from '@/lib/session';
import VencimientoPagoEditor from '../VencimientoPagoEditor';
import PendientesManuales from '../PendientesManuales';
import BorrarPendiente from '../BorrarPendiente';
import PagosAcciones from '../PagosAcciones';

export const dynamic = 'force-dynamic';

type VencPago = {
  id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null;
  fechaVencimiento: string; estado: string; valorPago: number | null; fechaLimitePago: string | null; consecuencia: string;
  diasMora: number; interesMora: number; sancion: number;
};
type Pendiente = {
  id: string; obligacion: string; anio: number; periodo: string | null; municipio: string | null;
  empresa: string | null; fechaVencimiento: string; estado: string; valorPago: number | null; notas: string | null;
  fechaLimitePago: string | null; consecuencia: string; diasMora: number; interesMora: number; sancion: number;
};
type EmpresaLite = { id: string; nombre: string };

// Fila unificada del listado "Por pagar".
type Item = {
  id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null;
  anio: number | null; fechaVencimiento: string; estado: string; valorPago: number | null;
  fechaLimitePago: string | null; consecuencia: string; diasMora: number; interesMora: number; sancion: number;
  notas: string | null; manual: boolean;
};

async function fetchVencPagos(anio: number): Promise<{ data: VencPago[]; error: string | null }> {
  try {
    const res = await apiFetch(`/vencimientos/pagos?anio=${anio}`);
    if (!res.ok) return { data: [], error: `La API respondió ${res.status}` };
    return { data: ((await res.json()) as { vencimientos: VencPago[] }).vencimientos ?? [], error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Error de red' };
  }
}
async function fetchPendientes(): Promise<Pendiente[]> {
  try {
    const res = await apiFetch('/vencimientos/pendientes');
    if (!res.ok) return [];
    return ((await res.json()) as { pendientes: Pendiente[] }).pendientes ?? [];
  } catch { return []; }
}
async function fetchEmpresas(): Promise<EmpresaLite[]> {
  try {
    const res = await apiFetch('/empresas');
    if (!res.ok) return [];
    const data = (await res.json()) as { empresas: EmpresaLite[] };
    return (data.empresas ?? []).map((e) => ({ id: e.id, nombre: e.nombre }));
  } catch { return []; }
}

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return ''; }
}
function fmtCOP(v: number): string {
  return v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

// Semáforo de urgencia por días.
const MS_DIA = 86400000;
function semaforo(iso: string, pagado: boolean): { txt: string; color: string; dias: number } {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(iso); f.setHours(0, 0, 0, 0);
  const dias = Math.round((f.getTime() - hoy.getTime()) / MS_DIA);
  if (pagado) return { txt: 'Pagado', color: '#16794c', dias };
  if (dias < 0) return { txt: `Vencido hace ${Math.abs(dias)} d · intereses`, color: '#d64b3f', dias };
  if (dias === 0) return { txt: 'Vence hoy', color: '#d64b3f', dias };
  if (dias === 1) return { txt: 'Vence mañana', color: '#c67c00', dias };
  if (dias <= 7) return { txt: `Vence en ${dias} d`, color: '#c67c00', dias };
  return { txt: `Vence en ${dias} d`, color: 'var(--muted)', dias };
}
function Semaforo({ iso, pagado }: { iso: string; pagado: boolean }) {
  const s = semaforo(iso, pagado);
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 600 }}>{fmtFecha(iso)}</span>
      <span className="chip" style={{ color: s.color, borderColor: s.color, background: 'transparent', boxShadow: 'none' }}>{s.txt}</span>
    </span>
  );
}

const UMBRAL_RIESGO = 15;
const consecCorta = (c: string) => (c === 'ineficaz' ? 'INEFICAZ' : c === 'exclusion_rst' ? 'sale del RST' : '');
function LimitePago({ fechaLimite, consecuencia, pagado }: { fechaLimite: string | null; consecuencia: string; pagado: boolean }) {
  if (!fechaLimite || consecuencia === 'intereses') return <span style={{ color: 'var(--muted)', fontSize: 12 }}>Solo intereses</span>;
  if (pagado) return <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtFecha(fechaLimite)}</span>;
  const hoy = new Date().setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(fechaLimite).setHours(0, 0, 0, 0) - hoy) / MS_DIA);
  const etq = consecCorta(consecuencia);
  let color = 'var(--muted)';
  let txt = `Límite ${fmtFecha(fechaLimite)}`;
  if (dias < 0) { color = '#b3261e'; txt = `${etq} — venció hace ${Math.abs(dias)} d`; }
  else if (dias === 0) { color = '#b3261e'; txt = `Paga hoy o ${etq}`; }
  else if (dias <= UMBRAL_RIESGO) { color = '#d64b3f'; txt = `Paga en ${dias} d o ${etq}`; }
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 600 }}>{fmtFecha(fechaLimite)}</span>
      <span className="chip" style={{ color, borderColor: color, background: 'transparent', boxShadow: 'none' }}>{txt}</span>
    </span>
  );
}

const pagadoDe = (e: string) => e === 'presentado_pagado';
const esVencido = (iso: string) => new Date(iso).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
function enRiesgoPago(fechaLimite: string | null, consecuencia: string, pagado: boolean): boolean {
  if (pagado || !fechaLimite || consecuencia === 'intereses') return false;
  const hoy = new Date().setHours(0, 0, 0, 0);
  return Math.round((new Date(fechaLimite).setHours(0, 0, 0, 0) - hoy) / MS_DIA) <= UMBRAL_RIESGO;
}

export default async function PagosPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const cliente = searchParams?.cliente || '';
  const estado = searchParams?.estado || '';
  const anio = new Date().getFullYear();

  const [{ data: vencs, error }, pendientes, empresas] = await Promise.all([
    fetchVencPagos(anio), fetchPendientes(), fetchEmpresas(),
  ]);

  // Listado unificado: vencimientos presentados + pagos pendientes manuales.
  const items: Item[] = [
    ...vencs.map((v): Item => ({
      id: v.id, obligacion: v.obligacion, empresa: v.empresa, municipio: v.municipio, periodo: v.periodo,
      anio: null, fechaVencimiento: v.fechaVencimiento, estado: v.estado, valorPago: v.valorPago,
      fechaLimitePago: v.fechaLimitePago, consecuencia: v.consecuencia, diasMora: v.diasMora, interesMora: v.interesMora, sancion: v.sancion,
      notas: null, manual: false,
    })),
    ...pendientes.map((p): Item => ({
      id: p.id, obligacion: p.obligacion, empresa: p.empresa, municipio: p.municipio, periodo: p.periodo,
      anio: p.anio, fechaVencimiento: p.fechaVencimiento, estado: p.estado, valorPago: p.valorPago,
      fechaLimitePago: p.fechaLimitePago, consecuencia: p.consecuencia, diasMora: p.diasMora, interesMora: p.interesMora, sancion: p.sancion,
      notas: p.notas, manual: true,
    })),
  ];

  const clientes = [...new Set(items.map((i) => i.empresa).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));

  // KPIs sobre el alcance por cliente (el estado es drill-down de la tabla).
  const scope = items.filter((i) => !cliente || i.empresa === cliente);
  const suma = (pred: (i: Item) => boolean) => scope.filter(pred).reduce((a, i) => ({ n: a.n + 1, v: a.v + (i.valorPago ?? 0) }), { n: 0, v: 0 });
  const kPagado = suma((i) => i.estado === 'presentado_pagado');
  const kPorPagar = suma((i) => !pagadoDe(i.estado));
  const kVencido = suma((i) => !pagadoDe(i.estado) && esVencido(i.fechaVencimiento));
  const kRiesgo = suma((i) => enRiesgoPago(i.fechaLimitePago, i.consecuencia, pagadoDe(i.estado)));
  const kInteres = scope.reduce((s, i) => s + (i.interesMora ?? 0), 0);
  const kSancion = scope.reduce((s, i) => s + (i.sancion ?? 0), 0);
  const kTotal = kPorPagar.v + kInteres + kSancion; // capital + interés + sanción a hoy

  const filas = scope
    .filter((i) => !estado || i.estado === estado)
    .sort((a, b) => Number(pagadoDe(a.estado)) - Number(pagadoDe(b.estado)) || +new Date(a.fechaVencimiento) - +new Date(b.fechaVencimiento));

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Pagos</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
        Todo lo <strong>pendiente de pago</strong> en un solo lugar: vencimientos ya presentados y deudas cargadas a mano, con su interés de mora a hoy.
      </p>

      {!error && scope.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="tile"><div className="k">Pagado</div><div className="v" style={{ color: '#16794c', fontSize: 21 }}>${fmtCOP(kPagado.v)}</div><div className="s">{kPagado.n} presentadas y pagadas</div></div>
          <div className="tile"><div className="k">Por pagar</div><div className="v" style={{ color: 'var(--navy)', fontSize: 21 }}>${fmtCOP(kPorPagar.v)}</div><div className="s">{kPorPagar.n} sin pagar</div></div>
          <div className="tile" style={{ borderColor: kVencido.n > 0 ? '#e0a3a0' : undefined }}><div className="k">Vencido sin pagar</div><div className="v" style={{ color: kVencido.n > 0 ? '#d64b3f' : '#8a94a6', fontSize: 21 }}>${fmtCOP(kVencido.v)}</div><div className="s">{kVencido.n} con intereses corriendo</div></div>
          <div className="tile" style={{ borderColor: kRiesgo.n > 0 ? '#b3261e' : undefined }}><div className="k">Riesgo ineficacia / RST</div><div className="v" style={{ color: kRiesgo.n > 0 ? '#b3261e' : '#8a94a6', fontSize: 21 }}>{kRiesgo.n}</div><div className="s">límite de pago ≤ {UMBRAL_RIESGO} d o vencido</div></div>
          <div className="tile"><div className="k">Interés de mora</div><div className="v" style={{ color: kInteres > 0 ? '#c67c00' : '#8a94a6', fontSize: 21 }}>${fmtCOP(kInteres)}</div><div className="s">estimado a hoy (DIAN)</div></div>
          <div className="tile"><div className="k">Sanción (est.)</div><div className="v" style={{ color: kSancion > 0 ? '#b3261e' : '#8a94a6', fontSize: 21 }}>${fmtCOP(kSancion)}</div><div className="s">extemporaneidad / ineficacia</div></div>
          <div className="tile" style={{ borderColor: kTotal > 0 ? 'var(--navy)' : undefined }}><div className="k">Total a pagar (hoy)</div><div className="v" style={{ color: 'var(--navy)', fontSize: 21 }}>${fmtCOP(kTotal)}</div><div className="s">capital + interés + sanción</div></div>
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 3px' }}>Por pagar</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        Vencimientos ya presentados (marca el pago) y pagos pendientes cargados a mano. El interés de mora se calcula a hoy y se actualiza solo.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: 0 }}>
          <select name="cliente" defaultValue={cliente} style={{ ...sel, maxWidth: 240 }}>
            <option value="">Todos los clientes</option>
            {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select name="estado" defaultValue={estado} style={sel}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="presentado_sin_pago">Presentado (sin pago)</option>
            <option value="presentado_pagado">Presentado y pagado</option>
          </select>
          <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
          {(cliente || estado) && <a href="/planeador/pagos" className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>Limpiar</a>}
        </form>
        {filas.length > 0 && <PagosAcciones filas={filas} cliente={cliente} />}
      </div>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar los pagos: {error}.</div>
      ) : filas.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          No hay obligaciones por pagar con estos filtros.
          <div style={{ fontSize: 12, marginTop: 6 }}>Marca un vencimiento como <strong>Presentado</strong> en Vencimientos, o usa <strong>+ Agregar pago pendiente</strong> abajo.</div>
        </div>
      ) : (
        <div className="panel">
          <div className="dt-wrap">
            <table className="dt">
              <thead>
                <tr><th>Obligación</th><th>Cliente</th><th>Municipio</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th style={{ whiteSpace: 'nowrap' }}>Límite de pago</th><th style={{ whiteSpace: 'nowrap' }}>Interés · sanción · total</th><th>Valor y estado de pago</th><th></th></tr>
              </thead>
              <tbody>
                {filas.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>
                      {i.obligacion}{i.periodo ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {i.periodo}</span> : null}{i.manual && i.anio ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {i.anio}</span> : null}
                      {i.manual ? <span className="chip" style={{ marginLeft: 6, fontSize: 9.5, color: 'var(--muted)', borderColor: 'var(--edge)' }}>manual</span> : null}
                      {i.notas ? <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{i.notas}</span> : null}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{i.empresa ?? '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{i.municipio ?? '—'}</td>
                    <td><Semaforo iso={i.fechaVencimiento} pagado={pagadoDe(i.estado)} /></td>
                    <td><LimitePago fechaLimite={i.fechaLimitePago} consecuencia={i.consecuencia} pagado={pagadoDe(i.estado)} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {(i.interesMora > 0 || i.sancion > 0)
                        ? <>
                            {i.interesMora > 0 && <div><span style={{ fontWeight: 600, color: '#c67c00' }}>Int. ${fmtCOP(i.interesMora)}</span> <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>({i.diasMora} d)</span></div>}
                            {i.sancion > 0 && <div style={{ fontSize: 11.5, color: '#b3261e', fontWeight: 600 }}>Sanción ${fmtCOP(i.sancion)}</div>}
                            {!pagadoDe(i.estado) && <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--navy)' }}>Total ${fmtCOP((i.valorPago ?? 0) + i.interesMora + i.sancion)}</div>}
                          </>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td><VencimientoPagoEditor id={i.id} valorPago={i.valorPago} estado={i.estado} /></td>
                    <td>{i.manual ? <BorrarPendiente id={i.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PendientesManuales empresas={empresas} pendientes={pendientes} mostrarTabla={false} />
    </>
  );
}
