// apps/api/src/visitas/alcance-lista.ts
// Qué visitas y reuniones ve cada quien en la lista que alimenta el CALENDARIO.
//
// El alcance era "solo donde soy el responsable", y eso partía el calendario por
// la mitad: al asesor de un cliente le aparecían TODOS los vencimientos de ese
// cliente —porque los vencimientos se acotan por empresa asignada— pero solo las
// visitas que él mismo tenía a su nombre. Una visita que hizo un compañero al
// mismo cliente, o una reunión que programó la coordinación, no salían.
//
// Eso rompe justo el uso del calendario: hacerle seguimiento al cliente y
// mandárselo. Un calendario que omite la mitad de lo que va a pasar en el mes no
// se puede enviar, y peor, no se nota que falta.
//
// La regla queda igual a la de vencimientos (`vencimientos/alcance-lista.ts`):
// la UNIÓN de sus empresas asignadas y lo que está a su nombre. No abre nada de
// terceros — son sus clientes y su propio trabajo—; lo que agrega es lo que pasa
// en clientes de los que ya es responsable.

/**
 * Alcance sobre la lista de visitas/reuniones.
 *
 * `idsAsignadas` viene en null para quien ve toda la firma (Administrador,
 * Coordinador, Auditor, root) y como arreglo para el staff ACOTADO: las empresas
 * donde figura en la Asignación cliente × área.
 *
 * El segundo término (ser el responsable) no sobra: una visita puede estar a su
 * nombre en un cliente que no tiene asignado —un reemplazo, un apoyo puntual— y
 * dejarlo fuera le escondería trabajo propio.
 */
export function filtroAlcanceVisitas(idsAsignadas: string[] | null, uid: string): Record<string, unknown> {
  if (!idsAsignadas) return {};
  return { OR: [{ empresaId: { in: idsAsignadas } }, { responsableId: uid }] };
}
