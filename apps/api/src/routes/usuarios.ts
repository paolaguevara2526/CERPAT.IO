// apps/api/src/routes/usuarios.ts
//
// Lista de usuarios (personal) por organización / tenant.
//
// Requiere sesión: expone datos personales del equipo (nombre, correo, cargo),
// así que nunca debe responder sin autenticar.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

export const usuariosRouter = Router();

usuariosRouter.get('/', requireAuth, async (_req, res) => {
  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
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

  res.json({
    organizacion: { nombre: org.nombre, slug: org.slug },
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
