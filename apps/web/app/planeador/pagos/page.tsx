// apps/web/app/planeador/pagos/page.tsx — Vista de Pagos.
// Controla lo que está PENDIENTE DE PAGO:
//   1) "Vencimientos por pagar": los vencimientos tributarios que ya se marcaron
//      Presentado (sin pago) / Presentado y pagado — se traen aquí para
//      registrarles el valor y el estado de pago.
//   2) "Pagos pendientes": deudas registradas a mano (años anteriores o
//      impuestos que no se cargaron al sistema).

import { apiFetch } from '@/lib/session';
import VencimientoPagoEditor from '../VencimientoPagoEditor';
import PendientesManuales from '../PendientesManuales';

export const dynamic = 'force-dynamic';

type VencPago = {
  id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null;
  fechaVencimiento: string; estado: string; valorPago: number | null; fechaLimitePago: string | null; consecuencia: string;
  diasMora: number; interesMora: number;
};
async function fetchVencPagos(anio: number): Promise<{ data: VencPago[] | null; error: string | null }> {
  try {
    const res = await apiFetch(`/vencimientos/pagos?anio=${anio}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: ((await res.json()) as { vencimientos: VencPago[] }).vencimientos ?? [], error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

type Pendiente = {
  id: string; obligacion: string; anio: number; periodo: string | null; municipio: string | null;
  empresa: string | null; fechaVencimiento: string; estado: string; valorPago: number | null; notas: string | null;
  diasMora: number; interesMora: number;
};
async function fetchPendientes(): Promise<Pendiente[]> {
  try {
    const res = await apiFetch('/vencimientos/pendientes');
    if (!res.ok) return [];
    return ((await res.json()) as { pendientes: Pendiente[] }).pendientes ?? [];
  } catch { return []; }
}

type EmpresaLite = { id: string; nombre: string };
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

// "Límite de pago": ret. fuente / autorretención / ReteICA → INEFICAZ a los 2
// meses; anticipo RST → exclusión del RST al mes. El resto solo intereses.
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

  const [{ data: vencsAll, error }, pendientes, empresas] = await Promise.all([
    fetchVencPagos(anio), fetchPendientes(), fetchEmpresas(),
  ]);

  const todos = vencsAll ?? [];
  const clientes = [...new Set(todos.map((v) => v.empresa).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));

  // KPIs sobre el alcance por cliente (el estado es drill-down de la tabla).
  const scope = todos.filter((v) => !cliente || v.empresa === cliente);
  const suma = (pred: (v: VencPago) => boolean) => scope.filter(pred).reduce((a, v) => ({ n: a.n + 1, v: a.v + (v.valorPago ?? 0) }), { n: 0, v: 0 });
  const kPagado = suma((v) => v.estado === 'presentado_pagado');
  const kPorPagar = suma((v) => v.estado === 'presentado_sin_pago');
  const kVencido = suma((v) => v.estado === 'presentado_sin_pago' && esVencido(v.fechaVencimiento));
  const kRiesgo = suma((v) => enRiesgoPago(v.fechaLimitePago, v.consecuencia, pagadoDe(v.estado)));
  const kInteres = scope.reduce((s, v) => s + (v.interesMora ?? 0), 0);

  const vencs = scope
    .filter((v) => !estado || v.estado === estado)
    .sort((a, b) => Number(pagadoDe(a.estado)) - Number(pagadoDe(b.estado)) || +new Date(a.fechaVencimiento) - +new Date(b.fechaVencimiento));

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Pagos</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
        Control de las obligaciones <strong>pendientes de pago</strong>. Registra el valor y el estado de cada pago.
      </p>

      {!error && scope.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="tile"><div className="k">Pagado</div><div className="v" style={{ color: '#16794c', fontSize: 21 }}>${fmtCOP(kPagado.v)}</div><div className="s">{kPagado.n} presentadas y pagadas</div></div>
          <div className="tile"><div className="k">Por pagar</div><div className="v" style={{ color: 'var(--navy)', fontSize: 21 }}>${fmtCOP(kPorPagar.v)}</div><div className="s">{kPorPagar.n} presentadas sin pago</div></div>
          <div className="tile" style={{ borderColor: kVencido.n > 0 ? '#e0a3a0' : undefined }}><div className="k">Vencido sin pagar</div><div className="v" style={{ color: kVencido.n > 0 ? '#d64b3f' : '#8a94a6', fontSize: 21 }}>${fmtCOP(kVencido.v)}</div><div className="s">{kVencido.n} con intereses corriendo</div></div>
          <div className="tile" style={{ borderColor: kRiesgo.n > 0 ? '#b3261e' : undefined }}><div className="k">Riesgo ineficacia / RST</div><div className="v" style={{ color: kRiesgo.n > 0 ? '#b3261e' : '#8a94a6', fontSize: 21 }}>{kRiesgo.n}</div><div className="s">límite de pago ≤ {UMBRAL_RIESGO} d o vencido</div></div>
          <div className="tile"><div className="k">Interés de mora</div><div className="v" style={{ color: kInteres > 0 ? '#c67c00' : '#8a94a6', fontSize: 21 }}>${fmtCOP(kInteres)}</div><div className="s">estimado a hoy (DIAN)</div></div>
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 3px' }}>Vencimientos por pagar</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        Vencimientos que ya marcaste <strong>Presentado (sin pago)</strong> o <strong>Presentado y pagado</strong> — captura el valor y controla el pago. Año {anio}.
      </p>

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <select name="cliente" defaultValue={cliente} style={{ ...sel, maxWidth: 240 }}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="estado" defaultValue={estado} style={sel}>
          <option value="">Todos los estados</option>
          <option value="presentado_sin_pago">Presentado (sin pago)</option>
          <option value="presentado_pagado">Presentado y pagado</option>
        </select>
        <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
        {(cliente || estado) && <a href="/planeador/pagos" className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>Limpiar</a>}
      </form>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar los vencimientos: {error}.</div>
      ) : vencs.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          {cliente || estado ? 'No hay vencimientos con estos filtros.' : 'Aún no hay vencimientos en el ciclo de pago.'}
          <div style={{ fontSize: 12, marginTop: 6 }}>Marca un vencimiento como <strong>Presentado (sin pago)</strong> en el Calendario o en Vencimientos y aparecerá aquí.</div>
        </div>
      ) : (
        <div className="panel">
          <div className="dt-wrap">
            <table className="dt">
              <thead>
                <tr><th>Obligación</th><th>Cliente</th><th>Municipio</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th style={{ whiteSpace: 'nowrap' }}>Límite de pago</th><th style={{ whiteSpace: 'nowrap' }}>Interés de mora</th><th>Valor y estado de pago</th></tr>
              </thead>
              <tbody>
                {vencs.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.obligacion}{v.periodo ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {v.periodo}</span> : null}</td>
                    <td style={{ color: 'var(--muted)' }}>{v.empresa ?? '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{v.municipio ?? '—'}</td>
                    <td><Semaforo iso={v.fechaVencimiento} pagado={pagadoDe(v.estado)} /></td>
                    <td><LimitePago fechaLimite={v.fechaLimitePago} consecuencia={v.consecuencia} pagado={pagadoDe(v.estado)} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {v.interesMora > 0
                        ? <><span style={{ fontWeight: 600, color: '#c67c00' }}>${fmtCOP(v.interesMora)}</span><div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{v.diasMora} d de mora</div></>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td><VencimientoPagoEditor id={v.id} valorPago={v.valorPago} estado={v.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PendientesManuales empresas={empresas} pendientes={pendientes} />
    </>
  );
}
