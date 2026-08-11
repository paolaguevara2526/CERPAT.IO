// ¿En qué meses toca una actividad del plan de trabajo?
//
// El plan se ancla en enero: una actividad trimestral cae en enero, abril,
// julio y octubre, no "cada tres meses desde que se contrató el cliente". Así
// todos los clientes comparten los mismos cortes y el cierre del trimestre es
// el mismo día para toda la firma.
//
// Vive aparte porque la generación masiva la aplica a los ~90 clientes de una
// vez: un error aquí ya no es una tarea mal puesta, son cientos.

const PASO_PLAN: Record<string, number> = { Mensual: 1, Bimestral: 2, Trimestral: 3, Cuatrimestral: 4, Semestral: 6, Anual: 12 };

/**
 * `true` si una actividad con esa periodicidad se genera en ese mes.
 *
 * Una periodicidad vacía o desconocida devuelve `false`: es preferible que a
 * alguien le falte una tarea y lo reclame, a repartir trabajo inventado por
 * un dato mal escrito en el catálogo.
 */
export function aplicaEnMesPlan(periodicidad: string | null | undefined, mes1a12: number): boolean {
  const n = PASO_PLAN[(periodicidad || '').trim()];
  return n ? (mes1a12 - 1) % n === 0 : false;
}
