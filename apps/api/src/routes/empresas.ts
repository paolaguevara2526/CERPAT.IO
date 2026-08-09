// apps/api/src/routes/empresas.ts
//
// Lista de empresas cliente (por organización / tenant).
//
// Requiere sesión: la cartera de clientes (nombre, NIT, servicio, asesor) es
// información confidencial de la firma. Los correos de contacto siguen fuera de
// este endpoint (se sirven en Administración).

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';

export const empresasRouter = Router();

empresasRouter.get('/', requireAuth, async (req, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ organizacion: null, total: 0, empresas: [] });

  // Por defecto solo clientes activos. ?incluirInactivos=1 los incluye (opción futura).
  const incluirInactivos = req.query.incluirInactivos === '1' || req.query.incluirInactivos === 'true';

  const empresas = await prisma.empresa.findMany({
    where: { organizacionId: org.id, ...(incluirInactivos ? {} : { activo: true }) },
    orderBy: { nombre: 'asc' },
    include: { tipo: true, regimen: true },
  });

  // El nombre de la firma se consulta aparte: el token solo trae su identificador.
  const datosOrg = await prisma.organizacion.findUnique({ where: { id: org.id }, select: { nombre: true, slug: true } });

  res.json({
    organizacion: datosOrg ? { nombre: datosOrg.nombre, slug: datosOrg.slug } : null,
    total: empresas.length,
    empresas: empresas.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      nit: e.nit,
      tipo: e.tipo?.nombre ?? null,
      servicio: e.servicio,
      asesorNombre: e.asesorNombre,
      regimen: e.regimen?.nombre ?? null,
      activo: e.activo,
      // Correos omitidos a propósito en este endpoint público (privacidad).
    })),
  });
});
