// Obligaciones que se derivan de las cifras del cliente.
//
// Todas las normas comparan contra el "año inmediatamente anterior": para saber
// qué le aplica a un cliente en 2026 se miran sus cifras de 2025, medidas con la
// UVT y el SMMLV de ESE año. Por eso las funciones reciben el año de las cifras
// y sus parámetros, y no un valor "actual".
//
// Es un módulo puro a propósito: no toca la base ni el request. Así se puede
// probar cada norma con números concretos, que es lo que evita que un umbral mal
// escrito pase inadvertido.

export type Cifras = {
  anio: number;
  /** Activos brutos a 31 de diciembre (equivale al patrimonio bruto). */
  activosBrutos: number | null;
  ingresosBrutos: number | null;
};

export type ParametrosAnio = { anio: number; uvt: number; smmlv: number };

export type Naturaleza = 'juridica' | 'natural' | 'otra';

export type Obligacion = {
  clave: string;
  titulo: string;
  norma: string;
  /** null = no se pudo determinar (faltan cifras o parámetros). */
  aplica: boolean | null;
  /** Explicación en números, para que se pueda verificar a mano. */
  detalle: string;
  /** Campo de la configuración tributaria con el que se debe contrastar. */
  contrastaCon?: 'ivaPeriodicidad' | 'retencionFuente' | 'rst';
  /** Valor que la norma sugiere para ese campo. */
  sugerido?: string;
};

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const enUvt = (v: number, uvt: number) => `${(v / uvt).toLocaleString('es-CO', { maximumFractionDigits: 0 })} UVT`;
const enSmmlv = (v: number, s: number) => `${(v / s).toLocaleString('es-CO', { maximumFractionDigits: 1 })} SMMLV`;

const SIN_DATOS = (clave: string, titulo: string, norma: string, falta: string): Obligacion =>
  ({ clave, titulo, norma, aplica: null, detalle: `No se puede determinar: falta ${falta}.` });

/**
 * Evalúa las seis obligaciones que dependen de topes.
 *
 * `naturaleza` importa porque dos normas solo aplican a un lado: el revisor
 * fiscal es de sociedades comerciales, y el 368-2 es de personas naturales
 * comerciantes. Aplicarlas a todos daría falsos positivos en ambos sentidos.
 */
export function obligacionesPorCifras(
  cifras: Cifras | null,
  params: ParametrosAnio | null,
  naturaleza: Naturaleza,
): Obligacion[] {
  const activos = cifras?.activosBrutos ?? null;
  const ingresos = cifras?.ingresosBrutos ?? null;

  const faltaParams = !params ? `los valores de UVT y SMMLV de ${cifras?.anio ?? 'ese año'}` : null;
  const faltaCifras = activos == null && ingresos == null ? 'registrar los activos e ingresos del año anterior' : null;

  // 1) Firma de contador — Art. 606 E.T.
  const firmaContador = ((): Obligacion => {
    const base = { clave: 'firma_contador', titulo: 'Declaraciones firmadas por contador', norma: 'Art. 606 E.T.' };
    if (faltaParams) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaParams);
    if (activos == null && ingresos == null) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaCifras!);
    const tope = 100_000 * params!.uvt;
    const aplica = (activos ?? 0) > tope || (ingresos ?? 0) > tope;
    return {
      ...base, aplica,
      detalle: `Tope 100.000 UVT = ${cop(tope)}. Activos ${activos != null ? `${cop(activos)} (${enUvt(activos, params!.uvt)})` : 'sin dato'}`
        + ` · Ingresos ${ingresos != null ? `${cop(ingresos)} (${enUvt(ingresos, params!.uvt)})` : 'sin dato'}.`,
    };
  })();

  // 2) Revisor fiscal — Ley 43 de 1990, art. 13 par. 2. Solo sociedades comerciales.
  const revisorFiscal = ((): Obligacion => {
    const base = { clave: 'revisor_fiscal', titulo: 'Obligado a tener revisor fiscal', norma: 'Ley 43/1990, art. 13 §2' };
    if (naturaleza === 'natural') {
      return { ...base, aplica: false, detalle: 'No aplica: la norma es para sociedades comerciales.' };
    }
    if (faltaParams) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaParams);
    if (activos == null && ingresos == null) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaCifras!);
    const topeActivos = 5_000 * params!.smmlv;
    const topeIngresos = 3_000 * params!.smmlv;
    const aplica = (activos ?? 0) >= topeActivos || (ingresos ?? 0) >= topeIngresos;
    return {
      ...base, aplica,
      detalle: `Activos ≥ 5.000 SMMLV (${cop(topeActivos)}) o ingresos ≥ 3.000 SMMLV (${cop(topeIngresos)}).`
        + ` Activos ${activos != null ? enSmmlv(activos, params!.smmlv) : 'sin dato'}`
        + ` · Ingresos ${ingresos != null ? enSmmlv(ingresos, params!.smmlv) : 'sin dato'}.`,
    };
  })();

  // 3) Persona natural agente de retención — Art. 368-2 E.T.
  const pnAgenteRetencion = ((): Obligacion => {
    const base = { clave: 'pn_agente_retencion', titulo: 'Persona natural agente de retención', norma: 'Art. 368-2 E.T.', contrastaCon: 'retencionFuente' as const };
    if (naturaleza !== 'natural') {
      return { ...base, aplica: false, detalle: 'No aplica: la norma es para personas naturales comerciantes.' };
    }
    if (faltaParams) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaParams);
    if (activos == null && ingresos == null) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaCifras!);
    const tope = 30_000 * params!.uvt;
    const aplica = (activos ?? 0) > tope || (ingresos ?? 0) > tope;
    return {
      ...base, aplica, sugerido: aplica ? 'sí' : 'no',
      detalle: `Tope 30.000 UVT = ${cop(tope)}. Activos ${activos != null ? enUvt(activos, params!.uvt) : 'sin dato'}`
        + ` · Ingresos ${ingresos != null ? enUvt(ingresos, params!.uvt) : 'sin dato'}.`,
    };
  })();

  // 4) Periodicidad del IVA — Art. 600 E.T.
  const ivaPeriodicidad = ((): Obligacion => {
    const base = { clave: 'iva_periodicidad', titulo: 'Periodicidad del IVA', norma: 'Art. 600 E.T.', contrastaCon: 'ivaPeriodicidad' as const };
    if (faltaParams) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaParams);
    if (ingresos == null) return SIN_DATOS(base.clave, base.titulo, base.norma, 'registrar los ingresos del año anterior');
    const tope = 92_000 * params!.uvt;
    const bimestral = ingresos >= tope;
    return {
      ...base, aplica: bimestral, sugerido: bimestral ? 'bimestral' : 'cuatrimestral',
      detalle: `Bimestral desde 92.000 UVT = ${cop(tope)}. Ingresos ${cop(ingresos)} (${enUvt(ingresos, params!.uvt)}).`
        + ' Los grandes contribuyentes y los responsables de los arts. 477 y 481 son bimestrales sin importar el monto.',
    };
  })();

  // 5) Conciliación fiscal — Decreto 1998 de 2017 (reglamenta Art. 772-1 E.T.).
  const conciliacionFiscal = ((): Obligacion => {
    const base = { clave: 'conciliacion_fiscal', titulo: 'Reporte de conciliación fiscal', norma: 'Dto. 1998/2017 · Art. 772-1 E.T.' };
    if (faltaParams) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaParams);
    if (ingresos == null) return SIN_DATOS(base.clave, base.titulo, base.norma, 'registrar los ingresos del año anterior');
    const tope = 45_000 * params!.uvt;
    return {
      ...base, aplica: ingresos >= tope,
      detalle: `Quedan exentos por debajo de 45.000 UVT = ${cop(tope)}. Ingresos ${cop(ingresos)} (${enUvt(ingresos, params!.uvt)}).`,
    };
  })();

  // 6) Régimen Simple — Art. 905 E.T.
  const puedeRst = ((): Obligacion => {
    const base = { clave: 'rst', titulo: 'Puede pertenecer al Régimen Simple', norma: 'Art. 905 E.T.', contrastaCon: 'rst' as const };
    if (faltaParams) return SIN_DATOS(base.clave, base.titulo, base.norma, faltaParams);
    if (ingresos == null) return SIN_DATOS(base.clave, base.titulo, base.norma, 'registrar los ingresos del año anterior');
    const tope = 100_000 * params!.uvt;
    const puede = ingresos < tope;
    return {
      ...base, aplica: puede, sugerido: puede ? 'puede' : 'no puede',
      detalle: `Tope 100.000 UVT = ${cop(tope)} (sin tope reducido por actividad). Ingresos ${cop(ingresos)} (${enUvt(ingresos, params!.uvt)}).`
        + ' El tope es una condición necesaria, no suficiente: hay otros requisitos del art. 906.',
    };
  })();

  return [firmaContador, revisorFiscal, pnAgenteRetencion, ivaPeriodicidad, conciliacionFiscal, puedeRst];
}

/** Naturaleza a partir del nombre del tipo de empresa del catálogo. */
export function naturalezaDe(tipoEmpresa: string | null | undefined): Naturaleza {
  if (!tipoEmpresa) return 'otra';
  const t = tipoEmpresa.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (t.includes('natural')) return 'natural';
  if (t.includes('juridica') || t.includes('consorcio') || t.includes('union temporal') || t.includes('sucursal')) return 'juridica';
  return 'otra';
}
