// apps/api/src/vencimientos/generador.ts
// Generador de vencimientos NACIONALES de una empresa: cruza su
// ConfiguracionTributaria con el calendario oficial 2026 (embebido en
// calendario-2026.json) y el último dígito de su NIT.
//
// Nacionales: Retención, IVA, Consumo, Anticipo RST, Renta (PJ/GC/PN) y
// consolidadas RST. El ICA municipal NO se genera aquí.
//
// ⚠ Estas reglas replican prisma/vencimientos-generar.ts (el sembrador masivo
// que lee los CSV). Si cambia el mapeo config→calendario, actualiza ambos.

import { CALENDARIO_2026 as calendario } from './calendario-2026.js';

export const ANIO_CALENDARIO = calendario.anio;

// Config tributaria relevante para el cálculo (campos de ConfiguracionTributaria).
export type ConfigNacional = {
  ivaPeriodicidad: string | null;
  retencionFuente: boolean;
  fopat: boolean;
  nominaElectronica: boolean;
  seguridadSocial: boolean;
  consumoPeriodicidad: string | null;
  rentaTipo: string | null;
  anticipoRstPeriodicidad: string | null;
};

export type VencimientoNacional = {
  obligacion: string;
  periodicidad: string | null;
  periodo: string | null;
  fechaVencimiento: Date;
};

// ---- Grillas del calendario (se construyen una vez al importar) ----
const grid = new Map<string, { periodo: string; fecha: string }[]>();
for (const r of calendario.tributario) {
  const k = `${r.obligacion}|${r.periodicidad}|${r.ultimo_digito}`;
  (grid.get(k) ?? grid.set(k, []).get(k)!).push({ periodo: r.periodo, fecha: r.fecha_vencimiento });
}
const G = (ob: string, per: string, dig: string) => grid.get(`${ob}|${per}|${dig}`) ?? [];

const renta = new Map<string, { subtipo: string; fecha: string }[]>(); // (obligacion|rango)
const pnPorFin = new Map<string, string>(); // últimos 2 dígitos -> fecha (Renta PN)
for (const r of calendario.renta) {
  const k = `${r.obligacion}|${r.digito_o_rango}`;
  (renta.get(k) ?? renta.set(k, []).get(k)!).push({ subtipo: r.subtipo, fecha: r.fecha_vencimiento });
  if (r.obligacion === 'Renta Persona Natural') {
    const m = r.digito_o_rango.match(/^(\d{2})-(\d{2})$/);
    if (m) { pnPorFin.set(m[1], r.fecha_vencimiento); pnPorFin.set(m[2], r.fecha_vencimiento); }
  }
}
const R = (ob: string, rango: string) => renta.get(`${ob}|${rango}`) ?? [];

// ---- ICA municipal: índice por (departamento|municipio) ----
// Normaliza texto para el cruce (sin tildes, minúsculas, solo alfanumérico).
const normTxt = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// El CSV nombra algunos municipios con la inicial del departamento al final
// ("San Martín M" en Meta, "Villanueva C" en Casanare) para desambiguar
// homónimos. Se quita ese sufijo para cruzar contra el catálogo de municipios.
function sinSufijoDepto(muni: string, depto: string): string {
  const m = muni.match(/^(.*\S)\s+([A-Za-zÁÉÍÓÚÑ])$/);
  if (m && normTxt(m[2]) === normTxt((depto || '').slice(0, 1))) return m[1];
  return muni;
}
const icaIdx = new Map<string, typeof calendario.ica>();
for (const r of calendario.ica) {
  const k = `${normTxt(r.departamento)}|${normTxt(sinSufijoDepto(r.municipio, r.departamento))}`;
  (icaIdx.get(k) ?? icaIdx.set(k, []).get(k)!).push(r);
}

// Último dígito (antes del de verificación) y últimos dos dígitos del NIT.
function digitos(nit: string) {
  const base = (nit || '').split(/[-\s]/)[0].replace(/\D/g, '');
  return { uno: base.slice(-1), dos: base.slice(-2).padStart(2, '0') };
}
const par = (d: string) => (['1', '2'].includes(d) ? '1-2' : ['3', '4'].includes(d) ? '3-4' : ['5', '6'].includes(d) ? '5-6' : ['7', '8'].includes(d) ? '7-8' : '9-0');

// ---- Festivos de Colombia y n-ésimo día hábil (para FOPAT: 10º día hábil) ----
const pad2 = (n: number) => String(n).padStart(2, '0');
const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
function pascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mes - 1, dia));
}
function proximoLunes(d: Date): Date {
  const r = new Date(d), dow = r.getUTCDay();
  r.setUTCDate(r.getUTCDate() + (dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow));
  return r;
}
function festivosColombia(y: number): Set<string> {
  const s = new Set<string>();
  const fijo = (mo: number, da: number) => s.add(`${y}-${pad2(mo)}-${pad2(da)}`);
  const emiliani = (mo: number, da: number) => s.add(isoUTC(proximoLunes(new Date(Date.UTC(y, mo - 1, da)))));
  fijo(1, 1); fijo(5, 1); fijo(7, 20); fijo(8, 7); fijo(12, 8); fijo(12, 25);
  emiliani(1, 6); emiliani(3, 19); emiliani(6, 29); emiliani(8, 15); emiliani(10, 12); emiliani(11, 1); emiliani(11, 11);
  const p = pascua(y);
  const rel = (off: number) => { const d = new Date(p); d.setUTCDate(d.getUTCDate() + off); return isoUTC(d); };
  s.add(rel(-3)); s.add(rel(-2)); s.add(rel(43)); s.add(rel(64)); s.add(rel(71));
  return s;
}
// n-ésimo día hábil del mes (salta sábados, domingos y festivos de Colombia).
//
// Si `n` se pasa de los días hábiles que tiene el mes, devuelve el ÚLTIMO. El
// número lo digita una persona en el catálogo, y un mes con festivos puede
// quedarse en 19 o 20 hábiles: antes esto devolvía el día 1, o sea que pedir
// "día hábil 22" ponía el plazo al principio del mes en vez de al final. Fallar
// hacia el final es lo seguro — un plazo tarde se nota; uno adelantado hace que
// todo aparezca vencido sin motivo.
export function nthDiaHabil(anio: number, mes1a12: number, n: number): Date {
  const fest = festivosColombia(anio);
  const d = new Date(Date.UTC(anio, mes1a12 - 1, 1));
  let cuenta = 0;
  let ultimoHabil = new Date(d);
  while (d.getUTCMonth() === mes1a12 - 1) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !fest.has(isoUTC(d))) {
      cuenta++;
      ultimoHabil = new Date(d);
      if (cuenta === n) return new Date(d);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return ultimoHabil;
}

// RUB (Registro Único de Beneficiarios): actualización TRIMESTRAL de solo
// presentación (no genera pago). Las fechas son fijas nacionales (iguales para
// todos, NO dependen del NIT). Aplica a personas jurídicas: quienes declaran
// Renta como Persona Jurídica, Gran Contribuyente o RST consolidada.
export const RUB_OBLIGACION = 'RUB (Registro Único de Beneficiarios)';

// A quién le aplica el RUB: depende de la NATURALEZA JURÍDICA del cliente, no de
// cómo declare renta. Antes se derivaba de `rentaTipo`, y eso tenía un efecto
// silencioso y grave: una persona jurídica con la casilla de Renta en "No
// aplica" —opción legítima— dejaba de tener RUB, y al regenerar sus
// vencimientos de RUB se BORRABAN sin que nadie lo pidiera.
//
// Obligados: las personas jurídicas y las estructuras sin personería (consorcios
// y uniones temporales). Las personas naturales NO.
// Se comparan FRAGMENTOS, no el nombre exacto: el catálogo de tipos lo edita el
// equipo y puede decir "Persona Jurídica", "Jurídica", "Consorcio", "Unión
// Temporal" o "Sucursal de sociedad extranjera". Atarse al nombre exacto es la
// misma fragilidad que ya nos costó una vez.
const RUB_TIPOS_OBLIGADOS = ['juridica', 'consorcio', 'union temporal', 'sucursal'];
const RUB_TIPOS_EXENTOS = ['natural'];

// Compara sin tildes ni mayúsculas: el catálogo de tipos lo escribe el equipo.
const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** ¿Este tipo de empresa está obligado a actualizar el RUB? */
export function aplicaRub(tipoEmpresa: string | null | undefined): boolean {
  if (!tipoEmpresa) return false; // sin tipo definido no se inventa la obligación
  const t = sinTildes(tipoEmpresa);
  if (RUB_TIPOS_EXENTOS.some((x) => t.includes(x))) return false;
  return RUB_TIPOS_OBLIGADOS.some((x) => t.includes(x));
}
const RUB_FECHAS: Record<number, { periodo: string; fecha: string }[]> = {
  2026: [
    { periodo: '1er trimestre', fecha: '2026-02-02' },
    { periodo: '2do trimestre', fecha: '2026-05-04' },
    { periodo: '3er trimestre', fecha: '2026-08-03' },
    { periodo: '4to trimestre', fecha: '2026-11-03' },
  ],
};

// Seguridad social (PILA): día hábil del mes según los DOS últimos dígitos del
// NIT (rangos oficiales). Devuelve el n-ésimo día hábil que aplica.
function diaHabilPila(dos: string): number {
  const n = parseInt(dos, 10) || 0;
  if (n <= 7) return 2; if (n <= 14) return 3; if (n <= 21) return 4;
  if (n <= 28) return 5; if (n <= 35) return 6; if (n <= 42) return 7;
  if (n <= 49) return 8; if (n <= 56) return 9; if (n <= 63) return 10;
  if (n <= 69) return 11; if (n <= 75) return 12; if (n <= 81) return 13;
  if (n <= 87) return 14; if (n <= 93) return 15; return 16; // 94-99
}

// Calcula los vencimientos nacionales que le corresponden a la empresa según su
// config y NIT. Función pura: no toca la base de datos.
export function vencimientosNacionales(cfg: ConfigNacional, nit: string, tipoEmpresa?: string | null): VencimientoNacional[] {
  const { uno, dos } = digitos(nit);
  const vs: VencimientoNacional[] = [];
  const push = (ob: string, per: string | null, items: { periodo?: string; subtipo?: string; fecha: string }[]) =>
    items.forEach((it) => vs.push({ obligacion: ob, periodicidad: per, periodo: it.periodo ?? it.subtipo ?? null, fechaVencimiento: new Date(it.fecha) }));

  if (cfg.retencionFuente) push('Retención en la fuente', 'Mensual', G('Retención en la fuente', 'Mensual', uno));
  // FOPAT (transporte): retención mensual. Vence el 10º día hábil del mes
  // siguiente al período (igual para todos, sin depender del NIT).
  if (cfg.fopat) {
    for (let m = 1; m <= 12; m++) {
      const dueAnio = m === 12 ? ANIO_CALENDARIO + 1 : ANIO_CALENDARIO;
      const dueMes = m === 12 ? 1 : m + 1;
      vs.push({ obligacion: 'FOPAT', periodicidad: 'Mensual', periodo: `${ANIO_CALENDARIO}-${pad2(m)}`, fechaVencimiento: nthDiaHabil(dueAnio, dueMes, 10) });
    }
  }
  // Obligaciones de SOLO PRESENTACIÓN (no generan pago), mensuales, que vencen un
  // día hábil del mes siguiente al período.
  //  - Nómina electrónica: 10º día hábil (igual que FOPAT).
  //  - Seguridad social (PILA): día hábil según los 2 últimos dígitos del NIT.
  const mensualDiaHabil = (ob: string, n: number) => {
    for (let m = 1; m <= 12; m++) {
      const dueAnio = m === 12 ? ANIO_CALENDARIO + 1 : ANIO_CALENDARIO;
      const dueMes = m === 12 ? 1 : m + 1;
      vs.push({ obligacion: ob, periodicidad: 'Mensual', periodo: `${ANIO_CALENDARIO}-${pad2(m)}`, fechaVencimiento: nthDiaHabil(dueAnio, dueMes, n) });
    }
  };
  if (cfg.nominaElectronica) mensualDiaHabil('Envío de nómina electrónica', 10);
  if (cfg.seguridadSocial) mensualDiaHabil('Seguridad social (PILA)', diaHabilPila(dos));
  if (cfg.ivaPeriodicidad === 'bimestral') push('IVA', 'Bimestral', G('IVA', 'Bimestral', uno));
  else if (cfg.ivaPeriodicidad === 'cuatrimestral') push('IVA', 'Cuatrimestral', G('IVA', 'Cuatrimestral', uno));
  else if (cfg.ivaPeriodicidad === 'anual_rst') push('IVA consolidado RST', 'Anual', R('RST consolidado IVA', par(uno)));
  if (cfg.consumoPeriodicidad === 'bimestral') push('Impuesto al consumo', 'Bimestral', G('Impuesto al consumo', 'Bimestral', uno));
  if (cfg.anticipoRstPeriodicidad === 'bimestral') push('Anticipo RST', 'Bimestral', G('Anticipo Régimen Simple', 'Bimestral', uno));

  switch (cfg.rentaTipo) {
    case 'persona_juridica': push('Renta Persona Jurídica', 'Anual', R('Renta Persona Jurídica', uno)); break;
    case 'gran_contribuyente': push('Renta Grandes Contribuyentes', 'Anual', R('Renta Grandes Contribuyentes', uno)); break;
    case 'rst_consolidada': push('RST consolidada Renta', 'Anual', R('RST consolidada Renta', par(uno))); break;
    case 'persona_natural': {
      const f = pnPorFin.get(dos);
      if (f) vs.push({ obligacion: 'Renta Persona Natural', periodicidad: 'Anual', periodo: 'declaración y pago', fechaVencimiento: new Date(f) });
      break;
    }
  }

  // RUB: por naturaleza jurídica (ver aplicaRub). Fechas fijas del año, no
  // dependen del NIT.
  if (aplicaRub(tipoEmpresa)) {
    for (const it of RUB_FECHAS[ANIO_CALENDARIO] ?? [])
      vs.push({ obligacion: RUB_OBLIGACION, periodicidad: 'Trimestral', periodo: it.periodo, fechaVencimiento: new Date(it.fecha) });
  }
  return vs;
}

// Obligaciones que ESTE generador administra. Al regenerar, solo se pueden dar
// de baja obligaciones de estos conjuntos; cualquier otra obligación cargada a
// mano (p. ej. "Exógena de ICA") se preserva SIEMPRE, aunque no esté en el
// objetivo actual.
export const OBLIGACIONES_NACIONALES = new Set<string>([
  'Retención en la fuente', 'FOPAT', 'IVA', 'IVA consolidado RST',
  'Impuesto al consumo', 'Anticipo RST', 'Renta Persona Jurídica',
  'Renta Grandes Contribuyentes', 'RST consolidada Renta', 'Renta Persona Natural',
  'Envío de nómina electrónica', 'Seguridad social (PILA)', RUB_OBLIGACION,
]);
export const OBLIGACIONES_ICA = new Set<string>(['ICA', 'ReteICA', 'AutoICA']);
// Obligaciones de SOLO PRESENTACIÓN: no generan pago y no entran al ciclo de
// Pagos (nunca causan interés ni sanción).
export const OBLIGACIONES_SIN_PAGO = new Set<string>(['Envío de nómina electrónica', 'Seguridad social (PILA)', RUB_OBLIGACION]);

/**
 * ¿Esta obligación es de SOLO PRESENTACIÓN (nunca tiene un valor a pagar)?
 *
 * Además de la lista fija, cubre la **información exógena**: es un reporte, no
 * una declaración con saldo, así que no genera pago **se llame como se llame el
 * municipio en el nombre** ("Exógena municipal (medios magnéticos)", "Exógena de
 * ICA", …). Esas se agregan a mano y su nombre es texto libre, por eso no se
 * pueden enumerar una por una.
 */
export function obligacionSinPago(obligacion: string): boolean {
  if (OBLIGACIONES_SIN_PAGO.has(obligacion)) return true;
  return /ex[oó]gena/i.test(obligacion ?? '');
}

// ---- ICA municipal ----
// Config de ICA de una empresa en un municipio (fila de EmpresaMunicipioIca).
export type MunicipioIcaInput = {
  municipioId: string;
  municipio: string | null;      // nombre del municipio (catálogo)
  departamento: string | null;
  icaPeriodicidad: string | null; // ICA (declaración) si viene seteada
  reteica: boolean;
  reteicaPeriodicidad: string | null;
  autoica: boolean;
  autoicaPeriodicidad: string | null;
  fechaInscripcion?: Date | null; // solo genera vencimientos en/después de esta fecha
};

export type VencimientoIca = {
  municipioId: string;
  obligacion: string; // 'ICA' | 'ReteICA' | 'AutoICA'
  periodicidad: string | null;
  periodo: string | null;
  fechaVencimiento: Date;
};

export type IcaResultado = {
  vencimientos: VencimientoIca[];
  // Municipios/obligaciones marcadas sin fechas en el calendario municipal.
  sinCalendario: { municipio: string; departamento: string | null; obligaciones: string[] }[];
};

// Calcula los vencimientos de ICA municipal (ICA / ReteICA / AutoICA) de una
// empresa cruzando lo que marcó en cada municipio con el calendario municipal
// y el último dígito de su NIT. Función pura: no toca la base de datos.
//
// - Genera SOLO las obligaciones marcadas en cada municipio.
// - Si una obligación marcada no tiene fechas en el calendario para ese
//   municipio, no inventa nada: la reporta en `sinCalendario` para avisar.
// - La `fechaInscripcion` (opcional) acota "de aquí en adelante": omite los
//   vencimientos cuya fecha es anterior a la inscripción, sin afectar lo demás.
export function vencimientosIca(municipios: MunicipioIcaInput[], nit: string): IcaResultado {
  const { uno } = digitos(nit);
  const vencimientos: VencimientoIca[] = [];
  const sinCalendario: IcaResultado['sinCalendario'] = [];

  for (const m of municipios) {
    const marcadas: string[] = [];
    if (m.icaPeriodicidad) marcadas.push('ICA');
    if (m.reteica) marcadas.push('ReteICA');
    if (m.autoica) marcadas.push('AutoICA');
    if (!marcadas.length) continue;

    const filas = icaIdx.get(`${normTxt(m.departamento)}|${normTxt(m.municipio)}`) ?? [];
    const faltan: string[] = [];

    for (const ob of marcadas) {
      // Filas de la obligación aplicables al NIT (dígito '' = todos; o el suyo).
      const aplic = filas.filter((f) => f.obligacion === ob && (f.ultimo_digito === '' || f.ultimo_digito === uno));
      if (!aplic.length) { faltan.push(ob); continue; }
      for (const f of aplic) {
        const fecha = new Date(f.fecha_vencimiento);
        if (m.fechaInscripcion && fecha < m.fechaInscripcion) continue; // no afecta lo anterior
        vencimientos.push({ municipioId: m.municipioId, obligacion: ob, periodicidad: f.periodicidad || null, periodo: f.periodo || null, fechaVencimiento: fecha });
      }
    }
    if (faltan.length) sinCalendario.push({ municipio: m.municipio ?? '(sin nombre)', departamento: m.departamento ?? null, obligaciones: faltan });
  }

  return { vencimientos, sinCalendario };
}
