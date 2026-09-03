// apps/api/src/vencimientos/reasignar.ts
// Cambiar quién liquida UNA obligación puntual.
//
// El responsable de un vencimiento se hereda de la asignación cliente×área al
// generarlo, y esa herencia es la correcta el 95% de las veces. Pero pasa que un
// impuesto lo termina liquidando otro asesor —el titular está de vacaciones, o
// el otro tenía el espacio esa semana— y hoy la única manera de reflejarlo es
// cambiar la asignación del cliente completo, que es demasiado: mueve TODAS sus
// obligaciones y todas las tareas del plan, no la de esta vez.
//
// De ahí este cambio puntual: toca una obligación y nada más. La asignación del
// cliente queda como está, porque el mes entrante vuelve a ser del titular.
//
// Dos cosas que no son negociables:
//   - Lo hace solo la coordinación. Si cada quien pudiera soltar sus impuestos,
//     "quién responde" dejaría de significar algo.
//   - Queda el rastro de quién lo movió y de a quién. La liquidación se mide por
//     persona; un cambio de responsable sin rastro borra trabajo hecho de las
//     cuentas de alguien y se lo acredita a otro sin que nadie pueda revisarlo.

/** Roles que pueden quedar como responsables de liquidar una obligación. */
export const ROLES_LIQUIDAN = ['Asesor', 'Coordinador', 'Administrador'];

export type Persona = { id: string; nombre: string; roles: string[]; activo?: boolean };

/**
 * A quién se le puede pasar una obligación.
 *
 * Se ofrecen los que liquidan y están activos: una lista con toda la firma
 * dentro (auxiliares, revisores, gente que ya no está) invita a elegir mal, y
 * el error solo se ve cuando a esa persona le aparece trabajo que no sabe hacer.
 */
export function candidatosParaLiquidar(personas: Persona[]): Persona[] {
  return personas
    .filter((p) => p.activo !== false && p.roles.some((r) => ROLES_LIQUIDAN.includes(r)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export type Cambio = { ok: true; asesorId: string } | { ok: false; error: string };

/**
 * Valida el cambio antes de tocar la base.
 *
 * Guardar "lo mismo que ya estaba" no es inofensivo: dejaría un evento en el
 * rastro diciendo que hubo una reasignación que nunca pasó, y el rastro es lo
 * único que después permite auditar quién liquidó qué.
 */
export function cambioDeAsesor(actualId: string | null, nuevoId: unknown): Cambio {
  if (typeof nuevoId !== 'string' || !nuevoId.trim()) {
    return { ok: false, error: 'Elige quién va a liquidar esta obligación.' };
  }
  const nuevo = nuevoId.trim();
  if (nuevo === actualId) {
    return { ok: false, error: 'Esa obligación ya está a nombre de esa persona.' };
  }
  return { ok: true, asesorId: nuevo };
}

/**
 * La línea que queda en el rastro. Nombra a los dos lados: "quedó en Fulano" no
 * sirve para auditar si no se sabe de quién salió.
 */
export function rastroDeReasignacion(anterior: string | null, nuevo: string): string {
  return `Responsable: ${anterior ?? 'sin asignar'} → ${nuevo}`;
}
