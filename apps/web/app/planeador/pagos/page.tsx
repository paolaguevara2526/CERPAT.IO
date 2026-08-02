// apps/web/app/planeador/pagos/page.tsx — Seguimiento de obligaciones con pago.

import { apiFetch } from '@/lib/session';
import { nombrePeriodo } from '../tareas';
import PagoEditor from '../PagoEditor';
import VencimientoPagoEditor from '../VencimientoPagoEditor';
import PendientesManuales from '../PendientesManuales';

export const dynamic = 'force-dynamic';

type VencPago = { id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null; fechaVencimiento: string; estado: string; valorPago: number | null };
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

export default async function PagosPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const estadoPago = searchParams?.estadoPago || '';
  const cliente = searchParams?.cliente || '';
  const hayFiltro = !!(estadoPago || cliente);

  const { data, error } = await fetchPagos('');
  const tareasAll = data?.tareas ?? [];
  const anio = new Date().getFullYear();
  const { data: vdata } = await fetchVencPagos(anio);
  const vencsAll = vdata?.vencimientos ?? [];
  const [pendientesManuales, empresas] = await Promise.all([fetchPendientes(), fetchEmpresas()]);

  // Opciones de cliente (unión de tareas + vencimientos).
  const clientes = [...new Set([...tareasAll.map((t) => t.empresa), ...vencsAll.map((v) => v.empresa)].filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));

  // Filtros aplicados a ambas secciones.
  const tareas = tareasAll.filter((t) => (!estadoPago || t.estadoPago === estadoPago) && (!cliente || t.empresa === cliente));
  const vencs = vencsAll.filter((v) => (!estadoPago || v.estado === estadoPago) && (!cliente || v.empresa === cliente));

  const totalValor = tareas.reduce((s, t) => s + (t.valorPago ?? 0), 0)
    + vencs.reduce((s, v) => s + (v.valorPago ?? 0), 0);
  const pagadas = tareas.filter((t) => t.estadoPago === 'presentado_pagado').length + vencs.filter((v) => v.estado === 'presentado_pagado').length;
  const pendientes = tareas.filter((t) => t.estadoPago === 'pendiente' || t.estadoPago === 'no_presentado').length + vencs.filter((v) => v.estado === 'presentado_sin_pago').length;

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Pagos</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {tareas.length} obligaciones</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>Obligaciones con pago (DIAN/entidades) del período. El ejecutor digita el valor y marca el estado de presentación y pago.</p>

      {!error && (tareas.length > 0 || vencs.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="tile"><div className="k">Valor total</div><div className="v" style={{ color: 'var(--navy)', fontSize: 22 }}>${fmtCOP(totalValor)}</div><div className="s">digitado</div></div>
          <div className="tile"><div className="k">Pagadas</div><div className="v" style={{ color: '#22a670' }}>{pagadas}</div><div className="s">presentadas y pagadas</div></div>
          <div className="tile"><div className="k">Por gestionar</div><div className="v" style={{ color: pendientes > 0 ? '#c67c00' : '#8a94a6' }}>{pendientes}</div><div className="s">pendientes/no presentadas</div></div>
        </div>
      )}

      <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <select name="cliente" defaultValue={cliente} style={{ ...sel, maxWidth: 240 }}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="estadoPago" defaultValue={estadoPago} style={sel}>
          <option value="">Todos los estados de pago</option>
          <option value="pendiente">Pendiente</option>
          <option value="presentado_sin_pago">Presentado (sin pago)</option>
          <option value="presentado_pagado">Presentado y pagado</option>
          <option value="no_presentado">No presentado</option>
        </select>
        <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
        {hayFiltro && <a href="/planeador/pagos" className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>Limpiar</a>}
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

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 3px' }}>Vencimientos por pagar</h2>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
          Obligaciones tributarias (ICA, etc.) ya presentadas — captura el valor y marca el pago. Aparecen aquí cuando se marcan <strong>Presentado (sin pago)</strong> o <strong>Presentado y pagado</strong>. Año {anio}.
        </p>
        {vencs.length === 0 ? (
          <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            Aún no hay vencimientos en el ciclo de pago.
            <div style={{ fontSize: 12, marginTop: 6 }}>Marca un vencimiento como <strong>Presentado (sin pago)</strong> en el Calendario o en Vencimientos y aparecerá aquí.</div>
          </div>
        ) : (
          <div className="panel">
            <div className="dt-wrap">
              <table className="dt">
                <thead>
                  <tr><th>Obligación</th><th>Cliente</th><th>Municipio</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th>Valor y estado de pago</th></tr>
                </thead>
                <tbody>
                  {vencs.map((v) => {
                    const vencido = new Date(v.fechaVencimiento) < new Date() && v.estado !== 'presentado_pagado';
                    return (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{v.obligacion}{v.periodo ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {v.periodo}</span> : null}</td>
                        <td style={{ color: 'var(--muted)' }}>{v.empresa ?? '—'}</td>
                        <td style={{ color: 'var(--muted)' }}>{v.municipio ?? '—'}</td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: vencido ? 800 : 500, color: vencido ? '#d64b3f' : 'var(--muted)' }}>{fmtFecha(v.fechaVencimiento)}</td>
                        <td><VencimientoPagoEditor id={v.id} valorPago={v.valorPago} estado={v.estado} /></td>
                      </tr>
                    );
                  })}
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
