// apps/api/src/fiscal/contrato.ts
// Horas pactadas al mes con un cliente.
//
// Es el OTRO LADO de la medición: el acta de cada visita dice cuántas horas se
// ejecutaron, pero sin lo pactado no se puede decir si se cumple. Y como el
// indicador sale de dividir lo uno entre lo otro, un valor imposible aquí no
// falla — desvía el resultado en silencio, que es peor.
//
// Por eso el filtro es estricto y falla hacia el vacío: "todavía no se sabe" es
// una respuesta honesta; "0 horas pactadas" convertiría a ese cliente en un
// cumplimiento infinito o en una división por cero, según quién haga la cuenta.

/** Tope de sensatez: nadie pacta más horas al mes de las que tiene un mes. */
export const MAX_HORAS_MES = 9999;

/**
 * Normaliza las horas pactadas al mes.
 *
 * Devuelve null (sin dato) para vacío, texto no numérico, cero o negativo.
 * Acepta texto porque viene de un formulario, y coma decimal porque así se
 * escribe en Colombia: "7,5" son siete horas y media.
 */
export function horasPactadas(v: unknown): number | null {
  if (v == null) return null;
  const crudo = typeof v === 'string' ? v.trim().replace(',', '.') : v;
  if (crudo === '') return null;
  const n = Number(crudo);
  if (!isFinite(n) || n <= 0) return null;
  // Dos decimales: media hora y cuarto de hora se expresan bien, y no se
  // arrastran fracciones que después no cuadran con lo que muestra la ficha.
  return Math.min(Math.round(n * 100) / 100, MAX_HORAS_MES);
}

/** Tope de sensatez para el plazo: 600 meses son cincuenta años. */
export const MAX_MESES_CONTRATO = 600;

/**
 * Plazo del contrato en meses. null si no es un entero positivo.
 *
 * No se valida contra la fecha de terminación: una prórroga puede terminar en
 * una fecha que no cuadre con el plazo, y ahí manda el papel. La pantalla avisa
 * de la discrepancia; el backend no la impone.
 */
export function mesesContrato(v: unknown): number | null {
  if (v == null) return null;
  const crudo = typeof v === 'string' ? v.trim() : v;
  if (crudo === '') return null;
  const n = Number(crudo);
  if (!isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), MAX_MESES_CONTRATO);
}
