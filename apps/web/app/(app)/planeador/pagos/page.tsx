// apps/web/app/planeador/pagos/page.tsx — Vista de Pagos.
// Un solo listado "Por pagar" que junta:
//   - vencimientos tributarios ya marcados Presentado (sin pago) / y pagado, y
//   - pagos pendientes agregados a mano (deudas de años anteriores).
// Con KPIs de riesgo, semáforo, límite de pago (INEFICAZ/RST) e interés de mora
// (DIAN) a hoy. Debajo queda solo el botón "+ Agregar pago pendiente".

import { apiFetch, getSessionUser } from '@/lib/session';
import { exigirRuta } from '@/lib/acceso-server';
import VencimientoPagoEditor from '../VencimientoPagoEditor';
import PendientesManuales from '../PendientesManuales';
import BorrarPendiente from '../BorrarPendiente';
import PagosAcciones from '../PagosAcciones';
import AbonosBoton from '../AbonosBoton';
import FormFiltros from './FormFiltros';
import SelectorCliente from './SelectorCliente';
import { fmtDia } from '@/lib/fechas';
import { coincide } from '@/lib/buscar';


export const metadata = { title: 'Pagos' };
export const dynamic = 'force-dynamic';

type VencPago = {
  id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null;
  fechaVencimiento: string; estado: string; valorPago: number | null; abonado: number; saldo: number | null;
  fechaLimitePago: string | null; consecuencia: string; diasMora: number; interesMora: number; sancion: number;
};
type Pendiente = {
  id: string; obligacion: string; anio: number; periodo: string | null; municipio: string | null;
  empresa: string | null; fechaVencimiento: string; estado: string; valorPago: number | null; abonado: number; saldo: number | null; notas: string | null;
  fechaLimitePago: string | null; consecuencia: string; diasMora: number; interesMora: number; sancion: number;
};
type EmpresaLite = { id: string; nombre: string };

// Fila unificada del listado "Por pagar".
type Item = {
  id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null;
  anio: number | null; fechaVencimiento: string; estado: string; valorPago: number | null; abonado: number; saldo: number | null;
  fechaLimitePago: string | null; consecuencia: string; diasMora: number; interesMora: number; sancion: number;
  notas: string | null; manual: boolean;
};

// Con qué tasa se liquidó lo que se está viendo, y si es la del mes en curso
// (lo resuelve el backend, en vencimientos/vigencia-tasa.ts).
type TasaMora = { mes: string | null; alDia: boolean; atraso: number; aviso: string | null; tasaAnual: number | null };

async function fetchVencPagos(anio: number): Promise<{ data: VencPago[]; tasa: TasaMora | null; error: string | null }> {
  try {
    const res = await apiFetch(`/vencimientos/pagos?anio=${anio}`);
    if (!res.ok) return { data: [], tasa: null, error: `La API respondió ${res.status}` };
    const j = (await res.json()) as { vencimientos: VencPago[]; tasaMora?: TasaMora };
    return { data: j.vencimientos ?? [], tasa: j.tasaMora ?? null, error: null };
  } catch (e) {
    return { data: [], tasa: null, error: e instanceof Error ? e.message : 'Error de red' };
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
  try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return ''; }
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
  if (pagado) return { txt: 'Pagado', color: 'var(--exito-fuerte)', dias };
  if (dias < 0) return { txt: `Vencido hace ${Math.abs(dias)} d · intereses`, color: 'var(--peligro)', dias };
  if (dias === 0) return { txt: 'Vence hoy', color: 'var(--peligro)', dias };
  if (dias === 1) return { txt: 'Vence mañana', color: 'var(--alerta)', dias };
  if (dias <= 7) return { txt: `Vence en ${dias} d`, color: 'var(--alerta)', dias };
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
  if (dias < 0) { color = 'var(--peligro-fuerte)'; txt = `${etq} — venció hace ${Math.abs(dias)} d`; }
  else if (dias === 0) { color = 'var(--peligro-fuerte)'; txt = `Paga hoy o ${etq}`; }
  else if (dias <= UMBRAL_RIESGO) { color = 'var(--peligro)'; txt = `Paga en ${dias} d o ${etq}`; }
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

// Columnas por las que se puede ordenar el listado "Por pagar".
type ColOrden = 'obligacion' | 'empresa' | 'municipio' | 'vence' | 'limite' | 'total';

function claveOrden(i: Item, c: ColOrden): string | number {
  switch (c) {
    case 'obligacion': return i.obligacion;
    case 'empresa': return i.empresa ?? '';
    case 'municipio': return i.municipio ?? '';
    case 'vence': return i.fechaVencimiento.slice(0, 10);
    case 'limite': return i.fechaLimitePago?.slice(0, 10) ?? '';
    // Lo que de verdad se debe hoy: saldo + interés + sanción.
    case 'total': return (i.saldo ?? i.valorPago ?? 0) + (i.interesMora ?? 0) + (i.sancion ?? 0);
  }
}

export default async function PagosPage({ searchParams }: { searchParams?: Record<string, string> }) {
  await exigirRuta('/planeador/pagos'); // solo Asesor / Coordinador / Auditor (y Admin)
  const cliente = searchParams?.cliente || '';
  const estado = searchParams?.estado || '';
  // Orden por columna. Se resuelve en el servidor (esta vista se arma allá) y
  // viaja en la URL, así que el orden elegido se puede compartir o guardar.
  const ordenCol = (searchParams?.orden || '') as ColOrden | '';
  const ordenAsc = (searchParams?.dir || 'asc') !== 'desc';
  const anio = new Date().getFullYear();

  const [{ data: vencs, tasa, error }, pendientes, empresas, sesion] = await Promise.all([
    fetchVencPagos(anio), fetchPendientes(), fetchEmpresas(), getSessionUser(),
  ]);
  // Solo el Administrador (o root) BORRA: un pago pendiente cargado a mano o un
  // abono ya registrado. Borrar no corrige un dato, elimina una deuda de la que
  // después nadie se acuerda. El backend ya valida esto; aquí evitamos mostrar
  // controles que devolverían un error.
  const esEditor = !!sesion && (sesion.esRoot || sesion.roles.includes('Administrador'));
  // Los ABONOS van aparte y más abiertos: Asesor y Coordinador también los
  // registran, porque son quienes hacen el seguimiento de cartera y quienes se
  // enteran de que el cliente abonó (ver api vencimientos/abonos.ts). Eliminar
  // un abono sigue siendo de Administración, así que la ventana recibe los dos
  // permisos por separado: mostrar un botón que va a devolver 403 es peor que no
  // mostrarlo.
  const puedeAbonar = !!sesion && (sesion.esRoot || sesion.roles.some((r) => ['Administrador', 'Coordinador', 'Asesor'].includes(r)));
  // Coordinación lleva el seguimiento de cartera: carga las deudas viejas y les
  // registra el valor y el estado del pago. Son operaciones que AGREGAN o
  // corrigen un dato; el backend ya las permitía (POST /vencimientos y PATCH
  // /vencimientos/:id aceptan coordinación) y solo la pantalla las escondía.
  // Borrar sigue siendo del Administrador: eso no corrige un dato, elimina una
  // deuda registrada.
  const esCoordinacion = !!sesion && (sesion.esRoot || sesion.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)));

  // Listado unificado: vencimientos presentados + pagos pendientes manuales.
  const items: Item[] = [
    ...vencs.map((v): Item => ({
      id: v.id, obligacion: v.obligacion, empresa: v.empresa, municipio: v.municipio, periodo: v.periodo,
      anio: null, fechaVencimiento: v.fechaVencimiento, estado: v.estado, valorPago: v.valorPago, abonado: v.abonado ?? 0, saldo: v.saldo,
      fechaLimitePago: v.fechaLimitePago, consecuencia: v.consecuencia, diasMora: v.diasMora, interesMora: v.interesMora, sancion: v.sancion,
      notas: null, manual: false,
    })),
    ...pendientes.map((p): Item => ({
      id: p.id, obligacion: p.obligacion, empresa: p.empresa, municipio: p.municipio, periodo: p.periodo,
      anio: p.anio, fechaVencimiento: p.fechaVencimiento, estado: p.estado, valorPago: p.valorPago, abonado: p.abonado ?? 0, saldo: p.saldo,
      fechaLimitePago: p.fechaLimitePago, consecuencia: p.consecuencia, diasMora: p.diasMora, interesMora: p.interesMora, sancion: p.sancion,
      notas: p.notas, manual: true,
    })),
  ];

  const clientes = [...new Set(items.map((i) => i.empresa).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));

  // KPIs sobre el alcance por cliente (el estado es drill-down de la tabla).
  // El filtro es por PEDAZO del nombre y no por coincidencia exacta: con noventa
  // clientes, tener que dar con el nombre completo es lo mismo que no tener
  // filtro. Ver lib/buscar.ts.
  const scope = items.filter((i) => coincide(i.empresa, cliente));
  // Lo pendiente se mide por SALDO (valor − abonos); lo pagado, por su valor.
  const pend = (i: Item) => i.saldo ?? i.valorPago ?? 0;
  const suma = (pred: (i: Item) => boolean, val: (i: Item) => number = (i) => i.valorPago ?? 0) => scope.filter(pred).reduce((a, i) => ({ n: a.n + 1, v: a.v + val(i) }), { n: 0, v: 0 });
  const kPagado = suma((i) => i.estado === 'presentado_pagado');
  const kPorPagar = suma((i) => !pagadoDe(i.estado), pend);
  const kVencido = suma((i) => !pagadoDe(i.estado) && esVencido(i.fechaVencimiento), pend);
  const kRiesgo = suma((i) => enRiesgoPago(i.fechaLimitePago, i.consecuencia, pagadoDe(i.estado)));
  const kInteres = scope.reduce((s, i) => s + (i.interesMora ?? 0), 0);
  const kSancion = scope.reduce((s, i) => s + (i.sancion ?? 0), 0);
  const kTotal = kPorPagar.v + kInteres + kSancion; // capital + interés + sanción a hoy

  const porPagar = scope.filter((i) => !estado || i.estado === estado);
  const filas = ordenCol
    ? [...porPagar].sort((a, b) => {
        const x = claveOrden(a, ordenCol); const y = claveOrden(b, ordenCol);
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true });
        return ordenAsc ? cmp : -cmp;
      })
    // Orden natural: primero lo que falta por pagar, y dentro de eso lo que vence antes.
    : [...porPagar].sort((a, b) => Number(pagadoDe(a.estado)) - Number(pagadoDe(b.estado)) || +new Date(a.fechaVencimiento) - +new Date(b.fechaVencimiento));

  // Encabezado ordenable: cada clic cicla ascendente → descendente → orden natural,
  // conservando los filtros que ya estén puestos.
  const thOrden = (c: ColOrden, texto: string, estilo?: React.CSSProperties) => {
    const activa = ordenCol === c;
    const params = new URLSearchParams();
    if (cliente) params.set('cliente', cliente);
    if (estado) params.set('estado', estado);
    if (!activa) params.set('orden', c);
    else if (ordenAsc) { params.set('orden', c); params.set('dir', 'desc'); }
    const qs = params.toString();
    return (
      <th style={estilo} aria-sort={!activa ? 'none' : ordenAsc ? 'ascending' : 'descending'}>
        <a className={activa ? 'th-orden activa' : 'th-orden'} href={`/planeador/pagos${qs ? `?${qs}` : ''}`}
          title={!activa ? 'Ordenar' : ordenAsc ? 'Ordenar al revés' : 'Quitar el orden'}>
          {texto}<span className="th-flecha" aria-hidden="true">{!activa ? '↕' : ordenAsc ? '↑' : '↓'}</span>
        </a>
      </th>
    );
  };

  const sel: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Pagos</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
        Todo lo <strong>pendiente de pago</strong> en un solo lugar: vencimientos ya presentados y deudas cargadas a mano, con su interés de mora a hoy.
      </p>

      {!error && scope.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="tile"><div className="k">Pagado</div><div className="v" style={{ color: 'var(--exito-fuerte)', fontSize: 21 }}>${fmtCOP(kPagado.v)}</div><div className="s">{kPagado.n} presentadas y pagadas</div></div>
          <div className="tile"><div className="k">Por pagar</div><div className="v" style={{ color: 'var(--navy)', fontSize: 21 }}>${fmtCOP(kPorPagar.v)}</div><div className="s">{kPorPagar.n} sin pagar</div></div>
          <div className="tile" style={{ borderColor: kVencido.n > 0 ? 'var(--peligro-borde)' : undefined }}><div className="k">Vencido sin pagar</div><div className="v" style={{ color: kVencido.n > 0 ? 'var(--peligro)' : 'var(--neutro)', fontSize: 21 }}>${fmtCOP(kVencido.v)}</div><div className="s">{kVencido.n} con intereses corriendo</div></div>
          <div className="tile" style={{ borderColor: kRiesgo.n > 0 ? 'var(--peligro-fuerte)' : undefined }}><div className="k">Riesgo ineficacia / RST</div><div className="v" style={{ color: kRiesgo.n > 0 ? 'var(--peligro-fuerte)' : 'var(--neutro)', fontSize: 21 }}>{kRiesgo.n}</div><div className="s">límite de pago ≤ {UMBRAL_RIESGO} d o vencido</div></div>
          {/* Un interés que se le cobra a un cliente tiene que decir con qué tasa
              se calculó: el número solo se ve igual de bien esté bien o mal. */}
          <div className="tile"><div className="k">Interés de mora</div><div className="v" style={{ color: kInteres > 0 ? 'var(--alerta)' : 'var(--neutro)', fontSize: 21 }}>${fmtCOP(kInteres)}</div><div className="s" style={tasa && !tasa.alDia ? { color: 'var(--alerta-fuerte)', fontWeight: 700 } : undefined}>
            {tasa?.tasaAnual ? `tasa ${(tasa.tasaAnual * 100).toFixed(2).replace('.', ',')}%` : 'tasa por defecto'}
            {tasa?.mes ? ` · de ${tasa.mes}` : ' · sin mes registrado'}
          </div></div>
          <div className="tile"><div className="k">Sanción (est.)</div><div className="v" style={{ color: kSancion > 0 ? 'var(--peligro-fuerte)' : 'var(--neutro)', fontSize: 21 }}>${fmtCOP(kSancion)}</div><div className="s">extemporaneidad / ineficacia</div></div>
          <div className="tile" style={{ borderColor: kTotal > 0 ? 'var(--navy)' : undefined }}><div className="k">Total a pagar (hoy)</div><div className="v" style={{ color: 'var(--navy)', fontSize: 21 }}>${fmtCOP(kTotal)}</div><div className="s">capital + interés + sanción</div></div>
        </div>
      )}

      {/* El aviso va donde se lee el número, no solo en Administración: quien
          mira Pagos es quien va a cobrar ese interés. */}
      {tasa && !tasa.alDia && tasa.aviso && (
        <div style={{ background: 'var(--alerta-suave)', border: '1px solid var(--alerta-borde)', color: 'var(--alerta-fuerte)', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, fontWeight: 600, marginBottom: 14, lineHeight: 1.55 }}>
          ⚠ {tasa.aviso} <span style={{ fontWeight: 500 }}>Se cambia en Administración → Parámetros.</span>
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 3px' }}>Por pagar</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        Vencimientos ya presentados {esCoordinacion ? '(marca el pago)' : puedeAbonar ? '(registra abonos)' : '(solo consulta)'} y pagos pendientes cargados a mano. El interés de mora se recalcula a hoy cada vez que abres la pantalla; la <strong>tasa</strong> no: esa la publica la DIAN cada mes y se carga en Administración → Parámetros.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <FormFiltros>
          {/* El desplegable de siempre —se abre y se ve la lista completa— con
              búsqueda encima: escribir filtra por cualquier parte del nombre.
              Con noventa clientes, teclear una letra en un <select> solo salta
              a la primera opción que empieza así. */}
          <SelectorCliente clientes={clientes} valor={cliente} estilo={{ width: 240 }} />
          <select name="estado" defaultValue={estado} style={sel}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="presentado_sin_pago">Presentado (sin pago)</option>
            <option value="presentado_pagado">Presentado y pagado</option>
          </select>
          <button type="submit" className="dbtn primary" style={{ fontSize: 13 }}>Filtrar</button>
          {(cliente || estado) && <a href="/planeador/pagos" className="dbtn" style={{ fontSize: 13, textDecoration: 'none' }}>Limpiar</a>}
        </FormFiltros>
        {filas.length > 0 && <PagosAcciones filas={filas} cliente={cliente} />}
      </div>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: 'var(--peligro-fuerte)', fontWeight: 600 }}>No se pudieron cargar los pagos: {error}.</div>
      ) : filas.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          {/* Con un campo de texto libre, "estos filtros" no dice cuál falló:
              casi siempre es una palabra mal escrita, y hay que verla. */}
          {cliente
            ? <>Ningún cliente coincide con <strong style={{ color: 'var(--ink)' }}>«{cliente}»</strong>{estado ? ' con ese estado' : ''}.</>
            : 'No hay obligaciones por pagar con estos filtros.'}
          <div style={{ fontSize: 12, marginTop: 6 }}>
            {cliente
              ? <>Se busca por cualquier parte del nombre. Prueba con una sola palabra, o usa <strong>Limpiar</strong>.</>
              : <>Marca un vencimiento como <strong>Presentado</strong> en Vencimientos, o usa <strong>+ Agregar pago pendiente</strong> abajo.</>}
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="dt-wrap dt-alta">
            <table className="dt">
              <thead>
                <tr>
                  {thOrden('obligacion', 'Obligación')}
                  {thOrden('empresa', 'Cliente')}
                  {thOrden('municipio', 'Municipio')}
                  {thOrden('vence', 'Vence', { whiteSpace: 'nowrap' })}
                  {thOrden('limite', 'Límite de pago', { whiteSpace: 'nowrap' })}
                  {thOrden('total', 'Interés · sanción · total', { whiteSpace: 'nowrap' })}
                  <th>Valor y estado de pago</th><th></th>
                </tr>
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
                            {i.interesMora > 0 && <div><span style={{ fontWeight: 600, color: 'var(--alerta)' }}>Int. ${fmtCOP(i.interesMora)}</span> <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>({i.diasMora} d)</span></div>}
                            {i.sancion > 0 && <div style={{ fontSize: 11.5, color: 'var(--peligro-fuerte)', fontWeight: 600 }}>Sanción ${fmtCOP(i.sancion)}</div>}
                            {!pagadoDe(i.estado) && <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--navy)' }}>Total ${fmtCOP((i.saldo ?? i.valorPago ?? 0) + i.interesMora + i.sancion)}</div>}
                          </>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                        <VencimientoPagoEditor id={i.id} valorPago={i.valorPago} estado={i.estado} editable={esCoordinacion} />
                        {i.abonado > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Abonado <b style={{ color: 'var(--exito-fuerte)' }}>${fmtCOP(i.abonado)}</b> · Saldo <b style={{ color: 'var(--navy)' }}>${fmtCOP(i.saldo ?? 0)}</b></div>
                        )}
                        <AbonosBoton id={i.id} puedeRegistrar={puedeAbonar} puedeEliminar={esEditor} />
                      </div>
                    </td>
                    <td>{i.manual && esEditor ? <BorrarPendiente id={i.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* mostrarTabla=false: acá solo va el botón de agregar. La tabla (con su
          borrado, que sigue siendo del Administrador) no se dibuja. */}
      <PendientesManuales empresas={empresas} pendientes={pendientes} mostrarTabla={false} editable={esCoordinacion} />
    </>
  );
}
