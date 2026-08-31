// apps/api/src/vencimientos/abonos.ts
// Quién registra un abono (pago parcial) contra una obligación, y sobre cuáles.
//
// Registrar abonos era **solo del Administrador**. La dirección lo abrió a
// Asesor y Coordinador: son quienes hacen el seguimiento de cartera y quienes
// se enteran de que el cliente abonó, así que tener que pedirle a Administración
// que lo registre atrasa el dato justo donde más se usa.
//
// **Eliminar** un abono NO se abrió: se queda en Administración. Registrar suma
// información; borrar la desaparece, y con ella el rastro de una plata que
// alguien reportó. Si un asesor se equivoca, el arreglo pasa por quien lleva las
// cifras, que es exactamente cuando conviene que alguien más se entere.
//
// Ojo con lo que un abono mueve: el saldo, el interés de mora, la sanción y —si
// el saldo llega a cero— el estado de la obligación, que pasa a "presentado y
// pagado". Por eso el alcance de abajo importa tanto como el rol.

export type QuienAbona = {
  esRoot: boolean;
  roles: string[];
  sub: string;
  empresaCliente?: string | null;
  grupoCliente?: string | null;
};

/** Roles que registran abonos. */
export const ROLES_QUE_ABONAN = ['Administrador', 'Coordinador', 'Asesor'];

export function puedeRegistrarAbono(u: QuienAbona | null | undefined): boolean {
  if (!u) return false;
  if (u.empresaCliente || u.grupoCliente) return false; // cliente externo: nunca
  if (u.esRoot) return true;
  return u.roles.some((r) => ROLES_QUE_ABONAN.includes(r));
}

/** Eliminar sigue siendo de Administración. */
export function puedeEliminarAbono(u: QuienAbona | null | undefined): boolean {
  if (!u) return false;
  if (u.empresaCliente || u.grupoCliente) return false;
  return u.esRoot || u.roles.includes('Administrador');
}

/**
 * ¿La obligación está dentro del alcance de quien abona?
 *
 * El rol dice si puede abonar; esto dice sobre CUÁLES. Sin esta segunda mitad,
 * un asesor podría abonar contra cualquier obligación de la firma mandando un
 * id: la lista se le acota en pantalla, pero la escritura no se acotaba sola.
 *
 * `idsAsignadas` viene en null para quien ve toda la firma (Administrador,
 * Coordinador, root). Para el staff acotado es la misma regla que usa el
 * calendario (ver alcance-lista.ts): sus empresas asignadas **o** lo que está a
 * su nombre. Leer y escribir con la misma regla evita el peor caso — ver algo
 * que no se puede tocar, o tocar algo que no se puede ver.
 */
export function abonoEnAlcance(
  idsAsignadas: string[] | null,
  uid: string,
  venc: { empresaId: string; asesorId: string | null; auxiliarId: string | null },
): boolean {
  if (!idsAsignadas) return true;
  return idsAsignadas.includes(venc.empresaId) || venc.asesorId === uid || venc.auxiliarId === uid;
}
