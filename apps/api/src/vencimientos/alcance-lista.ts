// apps/api/src/vencimientos/alcance-lista.ts
// Dos decisiones puras de la lista de vencimientos (la que alimenta el
// CALENDARIO): a quién se le muestra cada obligación y qué obligaciones caen en
// el mes que se está viendo. Separadas del router para poder probarlas.

/**
 * Alcance de un usuario sobre la lista de vencimientos.
 *
 * `idsAsignadas` viene en null para quien ve toda la firma (Administrador,
 * Coordinador, Auditor, root) y como arreglo para el staff ACOTADO
 * (Asesor/Auxiliar): las empresas donde figura en la Asignación cliente × área.
 *
 * Hasta ahora el staff acotado veía **solo** las obligaciones de sus empresas
 * asignadas. Eso deja un hueco real: un vencimiento guarda su propio
 * responsable (`asesorId`/`auxiliarId`, heredado del área de la actividad
 * vinculada al crearse), y ese responsable puede seguir siendo el asesor aunque
 * la fila de asignación de esa empresa ya no exista o nunca se haya creado —
 * los mismos "datos heredados que envejecen" de siempre. El resultado era una
 * obligación que la dirección veía en su calendario y el asesor responsable no.
 *
 * Por eso el alcance es la UNIÓN: sus empresas asignadas **o** las obligaciones
 * donde él mismo es el responsable. No abre nada de terceros: lo que se agrega
 * es trabajo que el sistema ya tiene registrado a su nombre.
 */
export function filtroAlcance(
  idsAsignadas: string[] | null,
  uid: string,
  empresaId?: string,
): Record<string, unknown> {
  if (!idsAsignadas) return empresaId ? { empresaId } : {};
  return { OR: [{ empresaId: { in: idsAsignadas } }, { asesorId: uid }, { auxiliarId: uid }] };
}

/**
 * Ventana de un mes del calendario.
 *
 * El filtro por mes se hacía en memoria y comparando SOLO el mes
 * (`fechaVencimiento.getMonth() + 1 === mes`), sobre las filas del año de la
 * columna `anio`. Esa columna es el año del PERÍODO, no el del vencimiento, y
 * hay obligaciones que vencen al año siguiente: FOPAT, nómina electrónica y
 * PILA del período de diciembre vencen en enero. Con la comparación por mes a
 * secas, ese FOPAT que vence en enero de 2027 se pintaba en **enero de 2026**
 * (un año antes) y no aparecía al ir a enero de 2027.
 *
 * La ventana correcta es por FECHA: [1 del mes, 1 del mes siguiente). Además
 * baja a la base de datos, así que el calendario deja de traerse el año entero
 * para mostrar un mes.
 */
export function filtroMes(anio: number, mes: number): Record<string, unknown> {
  if (!(mes >= 1 && mes <= 12)) return { anio };
  return { fechaVencimiento: { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) } };
}
