// apps/api/src/vencimientos/responsable.ts
// A quién queda un vencimiento cuando se crea (y cuando se rellena uno viejo).
//
// El responsable de un vencimiento se resolvía por UN solo camino:
//
//   obligación → actividad del plan vinculada → su área → asignación cliente×área
//
// Cuatro eslabones, y si cualquiera falta el vencimiento nace **sin responsable**.
// Sin error y sin aviso: simplemente no le aparece a nadie en Mi Día, y se
// descubre cuando ya está vencido. Nos pasó con FOPAT, con PILA, y se vio de
// golpe al exportar a Excel — decenas de obligaciones nuevas con la columna
// "Responsable" en blanco.
//
// Se agrega un segundo camino, el que pidió la dirección: **si la empresa tiene
// un solo asesor**, el vencimiento es suyo, aunque el área no se haya podido
// resolver. Es el caso corriente —un cliente que lleva una sola persona— y ahí
// no hay nada que adivinar.
//
// Lo que NO se hace es repartir a dedo cuando hay varios asesores en la empresa:
// ahí el área es la única respuesta correcta, y ponerle el trabajo de nómina al
// asesor de impuestos sería peor que dejarlo sin asignar. Un vencimiento sin
// dueño se ve y se reclama; uno con el dueño equivocado se trabaja mal.

export type Asignacion = { areaId: string; asesorId: string | null; auxiliarId: string | null };

export type Responsable = {
  asesorId: string | null;
  auxiliarId: string | null;
  /** Por dónde se resolvió: sirve para explicar y para contar los que quedan sin dueño. */
  origen: 'area' | 'empresa' | 'ninguno';
};

const SIN_DUENO: Responsable = { asesorId: null, auxiliarId: null, origen: 'ninguno' };

/** El único valor distinto de una lista, o null si hay ninguno o más de uno. */
function unico(valores: (string | null)[]): string | null {
  const distintos = [...new Set(valores.filter((v): v is string => !!v))];
  return distintos.length === 1 ? distintos[0] : null;
}

/**
 * @param areaId  área de la actividad vinculada a la obligación, si se pudo resolver.
 * @param asignaciones  asignaciones cliente×área de ESA empresa.
 */
export function resolverResponsable(
  areaId: string | null | undefined,
  asignaciones: Asignacion[],
): Responsable {
  // 1) El área de la obligación. Es la respuesta precisa y manda siempre que exista.
  if (areaId) {
    const a = asignaciones.find((x) => x.areaId === areaId);
    if (a?.asesorId) return { asesorId: a.asesorId, auxiliarId: a.auxiliarId ?? null, origen: 'area' };
  }

  // 2) La empresa, solo si no hay ambigüedad: un único asesor en todas sus áreas.
  //    El auxiliar se acompaña con el mismo criterio; si hay varios, va vacío
  //    antes que ponerle a alguien trabajo que no es suyo.
  const asesor = unico(asignaciones.map((x) => x.asesorId));
  if (asesor) {
    return { asesorId: asesor, auxiliarId: unico(asignaciones.map((x) => x.auxiliarId)), origen: 'empresa' };
  }

  // 3) Ni área ni empresa: queda sin dueño, y quien regenera tiene que enterarse.
  return SIN_DUENO;
}
