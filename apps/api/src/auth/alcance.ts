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

// ¿Es personal con vista ACOTADA a lo suyo? Asesor/Auxiliar SIN rol elevado
// (Administrador/Coordinador/Auditor) ni root: solo ve lo de sus empresas/tareas
// asignadas. Un rol elevado o root ve todo (devuelve false).
export function esStaffAcotado(u: UsuarioToken): boolean {
  if (!u || u.esRoot) return false;
  if (u.empresaCliente || u.grupoCliente) return false; // cliente externo, no personal
  if (u.roles.some((r) => ['Administrador', 'Coordinador', 'Auditor'].includes(r))) return false;
  return u.roles.some((r) => ['Asesor', 'Auxiliar'].includes(r));
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
