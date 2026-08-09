// apps/api/src/routes/usuarios.ts
//
// Lista de usuarios (personal) por organización / tenant.
//
// Requiere sesión: expone datos personales del equipo (nombre, correo, cargo),
// así que nunca debe responder sin autenticar.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';

export const usuariosRouter = Router();

usuariosRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ organizacion: null, total: 0, usuarios: [] });

  const usuarios = await prisma.usuario.findMany({
    where: { organizacionId: org.id },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    select: {
      id: true, nombre: true, email: true, cargo: true, area: true,
      activo: true, esRootPlataforma: true,
      roles: { select: { rol: { select: { nombre: true } } } },
    },
  });

  // El nombre de la firma se consulta aparte: el token solo trae su identificador.
  const datosOrg = await prisma.organizacion.findUnique({ where: { id: org.id }, select: { nombre: true, slug: true } });

  res.json({
    organizacion: datosOrg ? { nombre: datosOrg.nombre, slug: datosOrg.slug } : null,
    total: usuarios.length,
    usuarios: usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      cargo: u.cargo,
      area: u.area,
      activo: u.activo,
      esRoot: u.esRootPlataforma,
      roles: u.roles.map((r) => r.rol.nombre),
    })),
  });
});
