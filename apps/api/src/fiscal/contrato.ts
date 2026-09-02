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
