// apps/api/src/routes/empresas.ts
//
// Lista de empresas cliente (por organización / tenant).
//
// Requiere sesión: la cartera de clientes (nombre, NIT, servicio, asesor) es
// información confidencial de la firma. Los correos de contacto siguen fuera de
// este endpoint (se sirven en Administración).

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';
import { empresasAsignadas } from '../auth/alcance-db.js';
import { esStaffAcotado } from '../auth/alcance.js';

export const empresasRouter = Router();

empresasRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ organizacion: null, total: 0, empresas: [] });

  // Por defecto solo clientes activos. ?incluirInactivos=1 los incluye (opción futura).
  const incluirInactivos = req.query.incluirInactivos === '1' || req.query.incluirInactivos === 'true';

  // Un Asesor/Auxiliar ve SOLO su cartera, igual que en el resto de las vistas
  // internas. La cartera completa de la firma es información de la dirección, no
  // de cada asesor: no hay razón para que uno vea los clientes de otro.
  const idsAsignadas = esStaffAcotado(req.user) ? await empresasAsignadas(req.user!.sub, org.id) : null;

  const empresas = await prisma.empresa.findMany({
    where: {
      organizacionId: org.id,
      ...(incluirInactivos ? {} : { activo: true }),
      ...(idsAsignadas ? { id: { in: idsAsignadas } } : {}),
    },
    orderBy: { nombre: 'asc' },
    include: { tipo: true, regimen: true },
  });

  // El nombre de la firma se consulta aparte: el token solo trae su identificador.
  const datosOrg = await prisma.organizacion.findUnique({ where: { id: org.id }, select: { nombre: true, slug: true } });

  // Asesor según ASIGNACIONES, que es donde la coordinación reparte el trabajo de
  // verdad. `Empresa.asesorNombre` es un texto suelto que vino de la importación:
  // sirvió al principio, pero nadie lo mantiene, así que un cliente podía figurar
  // sin asesor aquí y tener uno trabajándolo en el tablero. Se manda la asignación
  // por área —un cliente puede tener asesores distintos por área— y el texto viejo
  // queda solo como respaldo, marcado como tal.
  const asignaciones = await prisma.asignacionClienteArea.findMany({
    where: { organizacionId: org.id, empresaId: { in: empresas.map((e) => e.id) }, asesorId: { not: null } },
    select: { empresaId: true, area: { select: { nombre: true, orden: true } }, asesor: { select: { nombre: true } } },
  });
  const porEmpresa = new Map<string, { area: string; asesor: string }[]>();
  for (const a of asignaciones) {
    if (!a.asesor?.nombre) continue;
    const lista = porEmpresa.get(a.empresaId) ?? [];
    lista.push({ area: a.area?.nombre ?? '—', asesor: a.asesor.nombre });
    porEmpresa.set(a.empresaId, lista);
  }
  for (const lista of porEmpresa.values()) lista.sort((x, y) => x.area.localeCompare(y.area, 'es'));

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
      asignaciones: porEmpresa.get(e.id) ?? [],
      regimen: e.regimen?.nombre ?? null,
      activo: e.activo,
      // Correos omitidos a propósito en este endpoint público (privacidad).
    })),
  });
});
