// apps/web/app/planeador/pagos/page.tsx — Tablero de control de pagos.
// Pensado para el coordinador de impuestos: KPIs de riesgo en $ (pagado, por
// pagar, presentado sin pagar, vencido sin pagar), semáforo de urgencia por
// días, orden por urgencia y filtros (cliente, estado, mes, alcance, vencidas).

import { apiFetch } from '@/lib/session';
import { nombrePeriodo } from '../tareas';
import PagoEditor from '../PagoEditor';
import VencimientoPagoEditor from '../VencimientoPagoEditor';
import PendientesManuales from '../PendientesManuales';

export const dynamic = 'force-dynamic';

type VencPago = { id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null; fechaVencimiento: string; estado: string; valorPago: number | null; fechaLimitePago: string | null; consecuencia: string };
async function fetchVencPagos(anio: number): Promise<{ data: { vencimientos: VencPago[] } | null; error: string | null }> {
  try {
    const res = await apiFetch(`/vencimientos/pagos?anio=${anio}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as { vencimientos: VencPago[] }, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

type TareaPago = {
  id: string; titulo: string; empresa: string | null; obligacion: string | null; area: string | null;
  asesor: string | null; auxiliar: string | null; fechaVencimiento: string; periodo: string | null;
  valorPago: number | null; estadoPago: string; fechaLimitePago: string | null; consecuencia: string;
};
type Resp = { periodo: string | null; total: number; tareas: TareaPago[] };

async function fetchPagos(periodo: string, incluirAtrasadas: boolean): Promise<{ data: Resp | null; error: string | null }> {
  try {
    const res = await apiFetch(`/plan/pagos?periodo=${periodo}&incluirAtrasadas=${incluirAtrasadas ? 1 : 0}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Resp, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

type Pendiente = {
  id: string; obligacion: string; anio: number; periodo: string | null; municipio: string | null;
  empresa: string | null; fechaVencimiento: string; estado: string; valorPago: number | null; notas: string | null;
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

// Semáforo de urgencia: días para vencer / vencido, con color de riesgo.
const MS_DIA = 86400000;
function semaforo(iso: string, pagado: boolean): { txt: string; color: string; dias: number } {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(iso); f.setHours(0, 0, 0, 0);
  const dias = Math.round((f.getTime() - hoy.getTime()) / MS_DIA);
  if (pagado) return { txt: 'Pagado', color: '#16794c', dias };
  if (dias < 0) return { txt: `Vencido hace ${Math.abs(dias)} d`, color: '#d64b3f', dias };
  if (dias === 0) return { txt: 'Vence hoy', color: '#d64b3f', dias };
  if (dias === 1) return { txt: 'Vence mañana', color: '#c67c00', dias };
  if (dias <= 7) return { txt: `Vence en ${dias} d`, color: '#c67c00', dias };
  return { txt: `Vence en ${dias} d`, color: 'var(--muted)', dias };
}
const esVencidoSinPagar = (iso: string, pagado: boolean) => !pagado && new Date(iso).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);

function Semaforo({ iso, pagado }: { iso: string; pagado: boolean }) {
  const s = semaforo(iso, pagado);
  const txt = s.dias < 0 && !pagado ? `${s.txt} · intereses` : s.txt;
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 600 }}>{fmtFecha(iso)}</span>
      <span className="chip" style={{ color: s.color, borderColor: s.color, background: 'transparent', boxShadow: 'none' }}>{txt}</span>
    </span>
  );
}

// Riesgo del "reloj de pago": ret. fuente / autorretención / ReteICA → INEFICAZ
// a los 2 meses; anticipo RST → exclusión del RST al mes. El resto solo intereses.
const UMBRAL_RIESGO = 15; // días antes del límite de pago para encender la alerta
function diasAlLimite(fechaLimite: string): number {
  const hoy = new Date().setHours(0, 0, 0, 0);
  const f = new Date(fechaLimite).setHours(0, 0, 0, 0);
  return Math.round((f - hoy) / MS_DIA);
}
function enRiesgoPago(fechaLimite: string | null, consecuencia: string, pagado: boolean): boolean {
  if (pagado || !fechaLimite || consecuencia === 'intereses') return false;
  return diasAlLimite(fechaLimite) <= UMBRAL_RIESGO;
}
const consecCorta = (c: string) => (c === 'ineficaz' ? 'INEFICAZ' : c === 'exclusion_rst' ? 'sale del RST' : '');

function LimitePago({ fechaLimite, consecuencia, pagado }: { fechaLimite: string | null; consecuencia: string; pagado: boolean }) {
  if (!fechaLimite || consecuencia === 'intereses') {
    return <span style={{ color: 'var(--muted)', fontSize: 12 }}>Solo intereses</span>;
  }
  if (pagado) return <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtFecha(fechaLimite)}</span>;
  const dias = diasAlLimite(fechaLimite);
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

export default async function PagosPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const estadoPago = searchParams?.estadoPago || '';
  const cliente = searchParams?.cliente || '';
  const soloVencidas = searchParams?.soloVencidas === '1';
  const soloRiesgo = searchParams?.soloRiesgo === '1';
  const anio = new Date().getFullYear();
  const mesActual = `${anio}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const periodo = /^\d{4}-\d{2}$/.test(searchParams?.periodo || '') ? (searchParams!.periodo as string) : mesActual;
  const alcance = searchParams?.alcance === 'mes' ? 'mes' : 'control'; // control = mes + atrasadas
  const incluirAtrasadas = alcance !== 'mes';
  const hayFiltro = !!(estadoPago || cliente || soloVencidas || soloRiesgo || periodo !== mesActual || alcance !== 'control');

  const { data, error } = await fetchPagos(periodo, incluirAtrasadas);
  const tareasAll = data?.tareas ?? [];
  const { data: vdata } = await fetchVencPagos(anio);
  const vencsAll = vdata?.vencimientos ?? [];
  const [pendientesManuales, empresas] = await Promise.all([fetchPendientes(), fetchEmpresas()]);

  // Opciones de cliente (unión de tareas + vencimientos).
  const clientes = [...new Set([...tareasAll.map((t) => t.empresa), ...vencsAll.map((v) => v.empresa)].filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
  const meses = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);

  // Alcance de los KPIs: filtra por cliente (el estado y "solo vencidas" son
  // drill-down de las tablas, no del tablero). Normaliza tareas + vencimientos.
  const pagadoDe = (e: string) => e === 'presentado_pagado';
  const tareasScope = tareasAll.filter((t) => !cliente || t.empresa === cliente);
  const vencsScope = vencsAll.filter((v) => !cliente || v.empresa === cliente);
  const kpiItems = [
    ...tareasScope.map((t) => ({ estado: t.estadoPago, fecha: t.fechaVencimiento, valor: t.valorPago ?? 0, fechaLimitePago: t.fechaLimitePago, consecuencia: t.consecuencia })),
    ...vencsScope.map((v) => ({ estado: v.estado, fecha: v.fechaVencimiento, valor: v.valorPago ?? 0, fechaLimitePago: v.fechaLimitePago, consecuencia: v.consecuencia })),
  ];
  const suma = (pred: (x: (typeof kpiItems)[number]) => boolean) => kpiItems.filter(pred).reduce((a, x) => ({ n: a.n + 1, v: a.v + x.valor }), { n: 0, v: 0 });
  const kPagado = suma((x) => pagadoDe(x.estado));
  const kPorPagar = suma((x) => !pagadoDe(x.estado));
  const kSinPagar = suma((x) => x.estado === 'presentado_sin_pago');
  const kVencido = suma((x) => esVencidoSinPagar(x.fecha, pagadoDe(x.estado)));
  const kRiesgo = suma((x) => enRiesgoPago(x.fechaLimitePago, x.consecuencia, pagadoDe(x.estado)));

  // Filas de las tablas: alcance + estado + "solo vencidas" + "solo en riesgo".
  // Orden por urgencia (no pagadas primero, la más vencida arriba).
  const filtroFila = (est: string, fecha: string, fechaLimite: string | null, consec: string) =>
    (!estadoPago || est === estadoPago)
    && (!soloVencidas || esVencidoSinPagar(fecha, pagadoDe(est)))
    && (!soloRiesgo || enRiesgoPago(fechaLimite, consec, pagadoDe(est)));
  const tareas = tareasScope.filter((t) => filtroFila(t.estadoPago, t.fechaVencimiento, t.fechaLimitePago, t.consecuencia))
    .sort((a, b) => Number(pagadoDe(a.estadoPago)) - Number(pagadoDe(b.estadoPago)) || +new Date(a.fechaVencimiento) - +new Date(b.fechaVencimiento));
  const vencs = vencsScope.filter((v) => filtroFila(v.estado, v.fechaVencimiento, v.fechaLimitePago, v.consecuencia))
    .sort((a, b) => Number(pagadoDe(a.estado)) - Number(pagadoDe(b.estado)) || +new Date(a.fechaVencimiento) - +new Date(b.fechaVencimiento));

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Pagos</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{nombrePeriodo(periodo)}{incluirAtrasadas ? ' + atrasadas' : ''} · {tareas.length + vencs.length} obligaciones</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>Control de obligaciones con pago (DIAN/entidades). La fecha de <strong>vence</strong> es el límite de presentación (desde el día siguiente corren intereses); el <strong>límite de pago</strong> avisa cuándo la retención/autorretención/ReteICA quedaría <strong>INEFICAZ</strong> (2 meses) o el anticipo RST en <strong>riesgo de exclusión</strong> (1 mes).</p>

      {!error && kpiItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="tile"><div className="k">Pagado</div><div className="v" style={{ color: '#16794c', fontSize: 21 }}>${fmtCOP(kPagado.v)}</div><div className="s">{kPagado.n} presentadas y pagadas</div></div>
          <div className="tile"><div className="k">Por pagar</div><div className="v" style={{ color: 'var(--navy)', fontSize: 21 }}>${fmtCOP(kPorPagar.v)}</div><div className="s">{kPorPagar.n} sin pagar</div></div>
          <div className="tile" style={{ borderColor: kSinPagar.n > 0 ? '#e6b800' : undefined }}><div className="k">Presentado sin pagar</div><div className="v" style={{ color: kSinPagar.n > 0 ? '#c67c00' : '#8a94a6', fontSize: 21 }}>${fmtCOP(kSinPagar.v)}</div><div className="s">{kSinPagar.n} declaradas, falta el pago</div></div>
          <div className="tile" style={{ borderColor: kVencido.n > 0 ? '#e0a3a0' : undefined }}><div className="k">Vencido sin pagar</div><div className="v" style={{ color: kVencido.n > 0 ? '#d64b3f' : '#8a94a6', fontSize: 21 }}>${fmtCOP(kVencido.v)}</div><div className="s">{kVencido.n} con intereses corriendo</div></div>
          <div className="tile" style={{ borderColor: kRiesgo.n > 0 ? '#b3261e' : undefined }}><div className="k">Riesgo ineficacia / RST</div><div className="v" style={{ color: kRiesgo.n > 0 ? '#b3261e' : '#8a94a6', fontSize: 21 }}>{kRiesgo.n}</div><div className="s">límite de pago ≤ {UMBRAL_RIESGO} d o vencido</div></div>
        </div>
      )}

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <select name="cliente" defaultValue={cliente} style={{ ...sel, maxWidth: 220 }}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="periodo" defaultValue={periodo} style={sel}>
          {meses.map((m) => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{nombrePeriodo(m)}</option>)}
        </select>
        <select name="alcance" defaultValue={alcance} style={sel}>
          <option value="control">Mes + atrasadas</option>
          <option value="mes">Solo el mes</option>
        </select>
        <select name="estadoPago" defaultValue={estadoPago} style={sel}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="presentado_sin_pago">Presentado (sin pago)</option>
          <option value="presentado_pagado">Presentado y pagado</option>
          <option value="no_presentado">No presentado</option>
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" name="soloVencidas" value="1" defaultChecked={soloVencidas} style={{ accentColor: '#d64b3f' }} /> Solo vencidas
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" name="soloRiesgo" value="1" defaultChecked={soloRiesgo} style={{ accentColor: '#b3261e' }} /> Riesgo ineficacia/RST
        </label>
        <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
        {hayFiltro && <a href="/planeador/pagos" className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>Limpiar</a>}
      </form>

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 3px' }}>Obligaciones del plan de trabajo</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        Actividades del <strong>Plan de Trabajo</strong> del cliente marcadas como <strong>genera pago</strong> (IVA, retención, ICA, nómina…). Es distinto de los <strong>vencimientos tributarios</strong> del generador, que van más abajo.
      </p>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar los pagos: {error}.</div>
      ) : tareas.length === 0 ? (
        <div className="panel" style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>
          {soloVencidas ? 'No hay obligaciones vencidas sin pagar con estos filtros.' : 'No hay obligaciones con pago para este alcance.'}
          <div style={{ fontSize: 12, marginTop: 6 }}>Aparecen aquí las actividades del plan marcadas como <strong>genera pago</strong>.</div>
        </div>
      ) : (
        <div className="panel">
          <div className="dt-wrap">
            <table className="dt">
              <thead>
                <tr><th>Obligación</th><th>Cliente</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th style={{ whiteSpace: 'nowrap' }}>Límite de pago</th><th>Auxiliar</th><th>Valor y estado de pago</th></tr>
              </thead>
              <tbody>
                {tareas.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.obligacion ?? t.titulo}{t.periodo && t.periodo !== periodo ? <span style={{ color: '#c67c00', fontWeight: 700 }}> · {nombrePeriodo(t.periodo)}</span> : null}</td>
                    <td style={{ color: 'var(--muted)' }}>{t.empresa ?? '—'}</td>
                    <td><Semaforo iso={t.fechaVencimiento} pagado={pagadoDe(t.estadoPago)} /></td>
                    <td><LimitePago fechaLimite={t.fechaLimitePago} consecuencia={t.consecuencia} pagado={pagadoDe(t.estadoPago)} /></td>
                    <td style={{ color: 'var(--muted)' }}>{t.auxiliar ?? '—'}</td>
                    <td><PagoEditor id={t.id} valorPago={t.valorPago} estadoPago={t.estadoPago} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 3px' }}>Vencimientos por pagar</h2>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
          Obligaciones tributarias (ICA, etc.) ya presentadas — captura el valor y marca el pago. Aparecen aquí cuando se marcan <strong>Presentado (sin pago)</strong> o <strong>Presentado y pagado</strong>. Año {anio}.
        </p>
        {vencs.length === 0 ? (
          <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            {soloVencidas ? 'No hay vencimientos vencidos sin pagar con estos filtros.' : 'Aún no hay vencimientos en el ciclo de pago.'}
            <div style={{ fontSize: 12, marginTop: 6 }}>Marca un vencimiento como <strong>Presentado (sin pago)</strong> en el Calendario o en Vencimientos y aparecerá aquí.</div>
          </div>
        ) : (
          <div className="panel">
            <div className="dt-wrap">
              <table className="dt">
                <thead>
                  <tr><th>Obligación</th><th>Cliente</th><th>Municipio</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th style={{ whiteSpace: 'nowrap' }}>Límite de pago</th><th>Valor y estado de pago</th></tr>
                </thead>
                <tbody>
                  {vencs.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.obligacion}{v.periodo ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {v.periodo}</span> : null}</td>
                      <td style={{ color: 'var(--muted)' }}>{v.empresa ?? '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>{v.municipio ?? '—'}</td>
                      <td><Semaforo iso={v.fechaVencimiento} pagado={pagadoDe(v.estado)} /></td>
                      <td><LimitePago fechaLimite={v.fechaLimitePago} consecuencia={v.consecuencia} pagado={pagadoDe(v.estado)} /></td>
                      <td><VencimientoPagoEditor id={v.id} valorPago={v.valorPago} estado={v.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <PendientesManuales empresas={empresas} pendientes={pendientesManuales} />
    </>
  );
}
