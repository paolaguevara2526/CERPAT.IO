// apps/api/src/auth/alcance.ts
// Decisión PURA (sin base de datos) del aislamiento del portal del cliente: qué
// empresas puede ver un usuario. Fuente única usada por los endpoints /*/portal.
// Al ser pura, está cubierta por tests (alcance.test.ts) para que una regresión
// que rompa el aislamiento entre clientes falle en CI.

export type UsuarioToken = { esRoot: boolean; roles: string[]; empresaCliente?: string | null; grupoCliente?: string | null } | null | undefined;

// ¿Es usuario de la firma (personal interno), no un cliente externo?
export function esFirma(u: UsuarioToken): boolean {
  return !!u && (u.esRoot || (u.roles.length > 0 && !u.empresaCliente && !u.grupoCliente));
}

// Roles que ven TODA la firma. Cualquier otro usuario interno ve solo lo suyo.
const ROLES_VEN_TODO = ['Administrador', 'Coordinador', 'Auditor'];

// ¿Es personal con vista ACOTADA a lo suyo? Todo usuario interno SIN rol elevado
// (Administrador/Coordinador/Auditor) ni root: solo ve sus empresas/tareas
// asignadas.
//
// La regla se decide por lo que el usuario NO tiene, no por lo que tiene. Antes
// terminaba en `roles.some(['Asesor','Auxiliar'])`, y eso fallaba ABIERTO: quien
// no cargara ninguno de esos dos roles —un Revisor, alguien con el rol mal
// puesto, o un usuario recién creado todavía sin roles— pasaba por "no acotado"
// y veía la cartera completa de la firma. Fallar cerrado es lo correcto: el peor
// caso pasa de "ve lo que no debe" a "no ve lo que sí debe", que se nota y se
// reclama el mismo día.
export function esStaffAcotado(u: UsuarioToken): boolean {
  if (!u || u.esRoot) return false;
  if (u.empresaCliente || u.grupoCliente) return false; // cliente externo: se acota por otro camino
  return !u.roles.some((r) => ROLES_VEN_TODO.includes(r));
}

// Alcance de empresas visibles:
//   'todas'    → usuario de la firma (ve todo).
//   string[]   → cliente: solo su empresa, o las empresas de su grupo.
//   null       → sin acceso (ni firma ni cliente con vínculo).
// `grupoEmpresaIds` son los ids de las empresas del grupo del cliente (ya
// resueltos desde la BD por quien llama); se ignoran si no aplica.
export function resolverAlcance(u: UsuarioToken, grupoEmpresaIds: string[]): 'todas' | string[] | null {
  if (!u) return null;
  if (esFirma(u)) return 'todas';
  if (u.empresaCliente) return [u.empresaCliente];
  if (u.grupoCliente) return grupoEmpresaIds;
  return null;
}
