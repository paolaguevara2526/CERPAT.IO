// apps/api/src/catalogos/nombre.ts
// Cuándo dos nombres de catálogo son EL MISMO.
//
// El índice único de la base compara texto exacto, así que "Asesoría Contable" y
// "Asesoria Contable" conviven sin problema: para Postgres son distintos, para
// quien llena el formulario son la misma opción repetida. Es exactamente lo que
// pasó con los tipos de servicio, que se sembraron desde el texto libre viejo
// —cada quien escribía lo suyo— y el desplegable quedó con la misma opción tres
// veces.
//
// Un catálogo con la misma opción repetida es peor que no tenerlo: la gente
// escoge cualquiera de las variantes y todo corte por esa columna queda partido
// en pedazos que nadie suma.

/**
 * Clave de comparación: sin tildes, sin mayúsculas y con los espacios
 * colapsados. Es lo que se compara, NO lo que se guarda — el nombre se guarda
 * tal como lo escribió la firma.
 */
export function claveNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    // Marcas diacríticas: la tilde de "Asesoría" y la virgulilla de "diseño".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿Los dos nombres son el mismo, ignorando tildes, mayúsculas y espacios? */
export function mismoNombre(a: string, b: string): boolean {
  return claveNombre(a) === claveNombre(b);
}

/**
 * Busca entre los existentes uno que sea "el mismo" que `nombre`.
 *
 * `excluirId` sirve al renombrar: un elemento no es duplicado de sí mismo, y sin
 * esto corregirle la tilde a una opción sería imposible.
 */
export function duplicadoDe<T extends { id: string; nombre: string }>(
  nombre: string,
  existentes: T[],
  excluirId?: string,
): T | null {
  const clave = claveNombre(nombre);
  return existentes.find((x) => x.id !== excluirId && claveNombre(x.nombre) === clave) ?? null;
}
