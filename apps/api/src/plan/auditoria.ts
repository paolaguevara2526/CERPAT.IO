// ¿Quién puede aprobar o devolver una tarea en Auditoría?
//
// El rol **Auditor** no estaba en la lista, y ese era el error: la pantalla de
// Auditoría sí se le abría —está permitida para su rol— pero al aprobar la API
// respondía "Solo coordinación o el asesor del área puede auditar esta tarea".
// Un rol que existe, ve la cola y no puede hacer lo único que esa pantalla
// ofrece.
//
// Quiénes pueden, entonces:
//   - Administrador y Coordinador, por su rol.
//   - Auditor, que es de lo que trata esta pantalla.
//   - El asesor de la tarea, que aprueba lo que hicieron sus auxiliares.
//
// PENDIENTE, y a propósito: la dirección está analizando si en los clientes de
// Outsourcing el asesor debe dejar de aprobar (él ejecuta, otro valida) y si eso
// depende del servicio del cliente. Mientras se define, la regla sigue siendo la
// misma de siempre más el Auditor — no se adelanta una restricción que todavía
// no está decidida, porque quitarle a alguien algo que hoy hace es peor que
// esperar a saber.

/** Roles que auditan por su cargo, sin importar de quién sea la tarea. */
export const ROLES_QUE_AUDITAN = ['Administrador', 'Coordinador', 'Auditor'];

export type QuienAudita = {
  esRoot: boolean;
  roles: string[];
  /** id del usuario que pregunta */
  sub: string;
};

export function puedeAuditar(u: QuienAudita | null | undefined, tarea: { asesorId: string | null }): boolean {
  if (!u) return false;
  if (u.esRoot) return true;
  if (u.roles.some((r) => ROLES_QUE_AUDITAN.includes(r))) return true;
  // El asesor de la tarea: aprueba lo de sus auxiliares.
  return !!tarea.asesorId && tarea.asesorId === u.sub;
}
