// apps/api/src/empresas/asesor-inicial.ts
// A qué áreas se les pone el asesor que se eligió en la ficha del cliente.
//
// El responsable de verdad vive en la asignación cliente×área: de ahí heredan
// asesor y auxiliar TODAS las tareas del plan y los vencimientos. El campo
// `asesorNombre` de la empresa es texto suelto que vino de la importación y no
// mueve nada — un cliente podía tener ahí un nombre escrito y seguir sin dueño
// en el tablero. Es la misma raíz de los vencimientos huérfanos.
//
// Entonces elegir un asesor en la ficha tiene que ESCRIBIR asignaciones, no un
// texto. Pero un cliente ya repartido puede tener asesores distintos por área
// —Contable con uno, Impuestos con otro— y eso lo decidió la coordinación a
// mano: una casilla suelta en la ficha no puede deshacerlo sin que nadie se
// entere.
//
// La regla, entonces: LLENA LOS VACÍOS Y NO PISA NADA. En un cliente nuevo no
// hay nada que pisar y queda con dueño desde el primer día; en uno ya repartido
// solo se completan las áreas huérfanas, y el reparto fino se sigue haciendo en
// Plan por cliente.

export type AsignacionArea = { areaId: string; asesorId: string | null };

/**
 * Áreas a las que se les debe poner el asesor elegido: las que no tienen
 * ninguno. Las que ya tienen asesor —sea quien sea— quedan fuera.
 */
export function areasSinAsesor(areaIds: string[], asignaciones: AsignacionArea[]): string[] {
  const conAsesor = new Set(asignaciones.filter((a) => a.asesorId).map((a) => a.areaId));
  return areaIds.filter((id) => !conAsesor.has(id));
}

/** Cuántas áreas quedarían tocadas y cuántas se respetan. Para avisar antes de guardar. */
export function resumenAsignacion(areaIds: string[], asignaciones: AsignacionArea[]): { porLlenar: number; respetadas: number } {
  const porLlenar = areasSinAsesor(areaIds, asignaciones).length;
  return { porLlenar, respetadas: areaIds.length - porLlenar };
}
