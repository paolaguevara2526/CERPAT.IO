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

// Empresas asignadas a un usuario (donde figura como asesor o auxiliar en la
// Asignación cliente × área). Base del alcance de un Asesor/Auxiliar en las vistas
// internas (Calendario/Pagos). Puede ser [] si no tiene clientes asignados.
export async function empresasAsignadas(uid: string, orgId: string): Promise<string[]> {
  const asigs = await prisma.asignacionClienteArea.findMany({
    where: { organizacionId: orgId, OR: [{ asesorId: uid }, { auxiliarId: uid }] },
    select: { empresaId: true },
  });
  return [...new Set(asigs.map((a) => a.empresaId))];
}
