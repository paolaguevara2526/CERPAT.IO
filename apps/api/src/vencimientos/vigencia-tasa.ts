// apps/api/src/vencimientos/vigencia-tasa.ts
// ¿La tasa de mora cargada es la de este mes?
//
// La DIAN publica la tasa de interés moratorio cada mes y el liquidador aplica
// la vigente al momento del pago a TODO el período (Art. 635 E.T., interés
// simple). Por eso el sistema guarda UNA tasa, la vigente — no una por período.
//
// El problema no es guardarla: es que una tasa vieja no se ve vieja. El número
// sigue ahí, Pagos sigue calculando y el resultado sigue pareciendo correcto,
// solo que liquidado con la tasa del mes pasado. Nadie lo nota hasta que un
// cliente paga de menos y la DIAN cobra la diferencia.
//
// De ahí este módulo: la tasa viaja con el mes en que se cargó, y la pantalla
// avisa cuando ese mes ya pasó. No se adivina la tasa nueva —la publica la
// Superfinanciera y la digita la firma— pero sí se dice en voz alta que la que
// está puesta no es la de hoy.

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function mesDe(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

/** Meses completos entre dos 'YYYY-MM'. Negativo si el primero es posterior. */
export function mesesEntre(desde: string, hasta: string): number {
  const [ya, ma] = desde.split('-').map(Number);
  const [yb, mb] = hasta.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export type VigenciaTasa = {
  /** El mes para el que se cargó la tasa, o null si nunca se registró. */
  mes: string | null;
  /** true solo si la tasa cargada es la de este mes. */
  alDia: boolean;
  /** Meses de atraso (0 si está al día o si no se sabe). */
  atraso: number;
  /** Qué decirle a quien lo lee. null cuando está al día. */
  aviso: string | null;
};

const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "agosto de 2026" a partir de '2026-08'. Para escribirlo en pantalla. */
export function nombreDeMes(mes: string): string {
  if (!MES_RE.test(mes)) return mes;
  const [y, m] = mes.split('-').map(Number);
  return `${NOMBRE_MES[m - 1]} de ${y}`;
}

/**
 * Estado de la tasa cargada frente al mes en curso.
 *
 * Sin fecha de carga se avisa igual: una tasa sin fecha es una tasa de la que no
 * se puede afirmar que esté vigente, y tratarla como buena es exactamente el
 * error que este módulo existe para evitar.
 */
export function vigenciaDeTasa(mesCargado: string | null | undefined, hoy: Date = new Date()): VigenciaTasa {
  const actual = mesDe(hoy);
  if (!mesCargado || !MES_RE.test(mesCargado)) {
    return {
      mes: null, alDia: false, atraso: 0,
      aviso: 'No hay registro de para qué mes se cargó esta tasa. Verifica que sea la que publicó la DIAN para el mes en curso y vuelve a guardarla.',
    };
  }
  const atraso = mesesEntre(mesCargado, actual);
  // Una tasa cargada "hacia adelante" (se alcanzó a digitar la del mes que
  // entra) no es un error: se avisa como al día y ya se corregirá sola.
  if (atraso <= 0) return { mes: mesCargado, alDia: true, atraso: 0, aviso: null };
  return {
    mes: mesCargado, alDia: false, atraso,
    aviso: `La tasa cargada es la de ${nombreDeMes(mesCargado)} y estamos en ${nombreDeMes(actual)}. Los intereses de mora en Pagos se están liquidando con esa tasa: actualízala con la que publicó la DIAN para ${nombreDeMes(actual)}.`,
  };
}
