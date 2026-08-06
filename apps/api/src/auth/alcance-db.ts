// apps/api/src/auth/alcance-db.ts
// Envoltura asíncrona de la decisión de alcance: resuelve las empresas del grupo
// del cliente desde la BD y delega la decisión en `resolverAlcance` (pura, testeada).

import { prisma } from '../db.js';
import { resolverAlcance, type UsuarioToken } from './alcance.js';

export async function alcancePortal(u: UsuarioToken, orgId: string): Promise<'todas' | string[] | null> {
  let grupoEmpresaIds: string[] = [];
  if (u?.grupoCliente) {
    const empresas = await prisma.empresa.findMany({ where: { organizacionId: orgId, grupoId: u.grupoCliente }, select: { id: true } });
    grupoEmpresaIds = empresas.map((e) => e.id);
  }
  return resolverAlcance(u, grupoEmpresaIds);
}
