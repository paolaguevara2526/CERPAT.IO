// apps/api/src/routes/usuarios.ts
//
// Lista de usuarios (personal) por organización / tenant.
//
// TODO (auth/tenant): la organización debe resolverse desde la sesión y verificar
// rol/permiso (esta vista debería quedar detrás de login, solo para Administrador/
// Coordinador). Mientras no hay auth, resuelve la organización demo (slug "cerpat").

import { Router } from 'express';
import { prisma } from '../db.js';

export const usuariosRouter = Router();

usuariosRouter.get('/', async (_req, res) => {
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
