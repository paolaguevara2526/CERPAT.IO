// apps/api/src/routes/empresas.ts
//
// Lista de empresas cliente (por organización / tenant).
//
// TODO (auth/tenant): la organización debe resolverse desde la sesión del
// usuario, y verificar rol/permiso. Mientras no existe auth, este endpoint
// resuelve la organización demo (slug "cerpat") y NO expone los correos de
// contacto (son datos personales de clientes; se sirven solo con auth).

import { Router } from 'express';
import { prisma } from '../db.js';

export const empresasRouter = Router();

empresasRouter.get('/', async (_req, res) => {
  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
  if (!org) return res.json({ organizacion: null, total: 0, empresas: [] });

  const empresas = await prisma.empresa.findMany({
    where: { organizacionId: org.id },
    orderBy: { nombre: 'asc' },
    include: { tipo: true, regimen: true },
  });

  res.json({
    organizacion: { nombre: org.nombre, slug: org.slug },
    total: empresas.length,
    empresas: empresas.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      nit: e.nit,
      tipo: e.tipo?.nombre ?? null,
      servicio: e.servicio,
      asesorNombre: e.asesorNombre,
      regimen: e.regimen?.nombre ?? null,
      // Correos omitidos a propósito en este endpoint público (privacidad).
    })),
  });
});
