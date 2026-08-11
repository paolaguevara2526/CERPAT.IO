// apps/api/src/routes/novedades.ts
// Novedades del día: lo que impidió trabajar (internet, acceso al sistema,
// equipo lento) con su plan de acción.
//
// Los auxiliares las reportan a diario y hasta ahora se contaban de palabra,
// con lo cual "el internet nos tiene mal" era una opinión que nadie podía
// llevar a una cotización. Aquí quedan con causa de catálogo, horas y minutos:
// la misma frase se vuelve una cifra.
//
// Tres reglas que se ven en el código:
//
//  1. El PLAN DE ACCIÓN es obligatorio. Es la condición con la que se abrió el
//     espacio: reportar sin decir qué se hizo convierte esto en un buzón de
//     quejas.
//  2. Una novedad NO cambia el estado de ninguna tarea. Explica el atraso, no
//     lo disculpa; si moviera estados sería la forma de cerrar trabajo sin
//     hacerlo. Por eso este router no toca `tarea` en ninguna parte.
//  3. Cada quien ve y cierra lo suyo; la coordinación ve y cierra todo. Cerrar
//     deja registrado quién y cuándo, porque sin la fecha de cierre no se sabe
//     cuánto estuvo abierta.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';
import { esStaffAcotado } from '../auth/alcance.js';
import { empresasAsignadas } from '../auth/alcance-db.js';
import { minutosNovedad } from '../plan/tiempo-novedad.js';

export const novedadesRouter = Router();

async function orgActual(req: AuthedRequest) {
  return orgDeSesion(req);
}
// Usuario de la firma (no cliente externo del portal).
function esUsuarioFirma(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || (u.roles.length > 0 && !u.empresaCliente && !u.grupoCliente));
}
function esCoordinacion(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)));
}

const SELECT = {
  id: true, fecha: true, descripcion: true, planAccion: true,
  horaDesde: true, horaHasta: true, minutos: true, estado: true,
  cerradaEn: true, createdAt: true,
  tipo: { select: { id: true, nombre: true } },
  usuario: { select: { id: true, nombre: true } },
  cerradaPor: { select: { id: true, nombre: true } },
  empresa: { select: { id: true, nombre: true } },
  area: { select: { id: true, nombre: true } },
} as const;

/** "YYYY-MM-DD" a medianoche UTC. Sin hora no hay corrimiento por zona horaria. */
function fechaSolo(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// GET /novedades/form-datos — lo que necesita el formulario: causas, áreas y
// clientes. Los clientes vienen con el mismo alcance del resto de la
// aplicación: el asesor elige entre los suyos, la coordinación entre todos.
// Va antes que cualquier '/:id' a propósito (ver orden-rutas.test.ts).
novedadesRouter.get('/form-datos', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a novedades.' });
  const org = await orgActual(req);
  if (!org) return res.json({ tipos: [], areas: [], empresas: [] });
  const u = req.user!;
  const idsAsignadas = esStaffAcotado(u) ? await empresasAsignadas(u.sub, org.id) : null;
  const [tipos, areas, empresas] = await Promise.all([
    prisma.tipoNovedad.findMany({
      where: { organizacionId: org.id },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true },
    }),
    prisma.area.findMany({
      where: { organizacionId: org.id },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true },
    }),
    prisma.empresa.findMany({
      where: { organizacionId: org.id, activo: true, ...(idsAsignadas ? { id: { in: idsAsignadas } } : {}) },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ]);
  res.json({ tipos, areas, empresas });
});

// GET /novedades — las mías; con ?todas=1 las de la firma (solo coordinación).
//
// Filtros opcionales: ?estado=abierta|resuelta, ?desde=YYYY-MM-DD, ?hasta=…
// El resumen viene con la lista para que la vista consolidada no tenga que
// sumar en el navegador lo que ya se sumó aquí.
novedadesRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a novedades.' });
  const org = await orgActual(req);
  if (!org) return res.json({ total: 0, abiertas: 0, minutos: 0, novedades: [] });
  const u = req.user!;

  const todas = req.query.todas === '1' && esCoordinacion(u);
  const desde = fechaSolo(req.query.desde);
  const hasta = fechaSolo(req.query.hasta);
  const estado = req.query.estado === 'abierta' || req.query.estado === 'resuelta' ? req.query.estado : null;

  const novedades = await prisma.novedad.findMany({
    where: {
      organizacionId: org.id,
      ...(todas ? {} : { usuarioId: u.sub }),
      ...(estado ? { estado } : {}),
      ...(desde || hasta ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
    },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    select: SELECT,
    take: 500,
  });

  res.json({
    total: novedades.length,
    abiertas: novedades.filter((n) => n.estado === 'abierta').length,
    // Los minutos se suman aquí y no en el navegador: es la cifra con la que se
    // decide, y una suma hecha en dos lados termina dando dos números.
    minutos: novedades.reduce((s, n) => s + (n.minutos ?? 0), 0),
    novedades,
  });
});

// POST /novedades — reportar. Cualquier usuario de la firma reporta la suya.
novedadesRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a novedades.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = req.user!;

  const tipoId = texto(req.body?.tipoId);
  if (!tipoId) return res.status(422).json({ error: 'Elige el tipo de novedad.' });
  const tipo = await prisma.tipoNovedad.findFirst({ where: { id: tipoId, organizacionId: org.id }, select: { id: true } });
  if (!tipo) return res.status(422).json({ error: 'Tipo de novedad inválido.' });

  const descripcion = texto(req.body?.descripcion);
  if (!descripcion) return res.status(422).json({ error: 'Cuenta qué pasó.' });
  // Obligatorio: es la condición con la que se abrió este espacio.
  const planAccion = texto(req.body?.planAccion);
  if (!planAccion) return res.status(422).json({ error: 'Falta el plan de acción: qué hiciste o qué vas a hacer.' });

  const fecha = fechaSolo(req.body?.fecha) ?? new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');

  const horaDesde = texto(req.body?.horaDesde);
  const horaHasta = texto(req.body?.horaHasta);
  const minutos = minutosNovedad(horaDesde, horaHasta);
  // Si hay dos horas y no dan una cuenta válida, se avisa en vez de guardar
  // silenciosamente una novedad sin minutos: el que la escribió es el único que
  // sabe cuál de las dos horas está mal.
  if (horaDesde && horaHasta && minutos == null) {
    return res.status(422).json({ error: 'Revisa las horas: la de fin no puede ir antes que la de inicio.' });
  }

  // Contexto opcional: no toda novedad es de un cliente ni de un área.
  const empresaId = texto(req.body?.empresaId);
  if (empresaId) {
    const e = await prisma.empresa.findFirst({ where: { id: empresaId, organizacionId: org.id }, select: { id: true } });
    if (!e) return res.status(422).json({ error: 'Cliente inválido.' });
  }
  const areaId = texto(req.body?.areaId);
  if (areaId) {
    const a = await prisma.area.findFirst({ where: { id: areaId, organizacionId: org.id }, select: { id: true } });
    if (!a) return res.status(422).json({ error: 'Área inválida.' });
  }

  const novedad = await prisma.novedad.create({
    data: {
      organizacionId: org.id, usuarioId: u.sub, tipoId, fecha, descripcion, planAccion,
      horaDesde, horaHasta, minutos, empresaId, areaId,
    },
    select: SELECT,
  });
  res.status(201).json({ ok: true, novedad });
});

// PATCH /novedades/:id — corregir lo reportado o cerrarla.
//
// La cierra quien la reportó o la coordinación, y en ambos casos queda el
// registro de quién y cuándo. Reabrir también es posible (una novedad que se
// dio por resuelta y volvió a pasar), y ahí se limpia el cierre anterior para
// no dejar una fecha de cierre de algo que sigue abierto.
novedadesRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a novedades.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = req.user!;

  const actual = await prisma.novedad.findFirst({
    where: { id: req.params.id, organizacionId: org.id },
    select: { id: true, usuarioId: true, horaDesde: true, horaHasta: true },
  });
  if (!actual) return res.status(404).json({ error: 'Novedad no encontrada.' });
  if (actual.usuarioId !== u.sub && !esCoordinacion(u)) {
    return res.status(403).json({ error: 'Esta novedad no es tuya.' });
  }

  const data: Record<string, any> = {};
  if ('descripcion' in (req.body ?? {})) {
    const v = texto(req.body.descripcion);
    if (!v) return res.status(422).json({ error: 'La descripción no puede quedar vacía.' });
    data.descripcion = v;
  }
  if ('planAccion' in (req.body ?? {})) {
    const v = texto(req.body.planAccion);
    if (!v) return res.status(422).json({ error: 'El plan de acción no puede quedar vacío.' });
    data.planAccion = v;
  }
  if ('tipoId' in (req.body ?? {})) {
    const v = texto(req.body.tipoId);
    const t = v ? await prisma.tipoNovedad.findFirst({ where: { id: v, organizacionId: org.id }, select: { id: true } }) : null;
    if (!t) return res.status(422).json({ error: 'Tipo de novedad inválido.' });
    data.tipoId = t.id;
  }
  if ('fecha' in (req.body ?? {})) {
    const f = fechaSolo(req.body.fecha);
    if (!f) return res.status(422).json({ error: 'Fecha inválida.' });
    data.fecha = f;
  }
  // Las horas se recalculan juntas: cambiar solo una y no volver a calcular
  // dejaría los minutos guardados contando un rato que ya no es el que dicen
  // las horas.
  if ('horaDesde' in (req.body ?? {}) || 'horaHasta' in (req.body ?? {})) {
    const desde = 'horaDesde' in req.body ? texto(req.body.horaDesde) : actual.horaDesde;
    const hasta = 'horaHasta' in req.body ? texto(req.body.horaHasta) : actual.horaHasta;
    const min = minutosNovedad(desde, hasta);
    if (desde && hasta && min == null) {
      return res.status(422).json({ error: 'Revisa las horas: la de fin no puede ir antes que la de inicio.' });
    }
    data.horaDesde = desde; data.horaHasta = hasta; data.minutos = min;
  }
  if ('empresaId' in (req.body ?? {})) {
    const v = texto(req.body.empresaId);
    if (v) {
      const e = await prisma.empresa.findFirst({ where: { id: v, organizacionId: org.id }, select: { id: true } });
      if (!e) return res.status(422).json({ error: 'Cliente inválido.' });
    }
    data.empresaId = v;
  }
  if ('areaId' in (req.body ?? {})) {
    const v = texto(req.body.areaId);
    if (v) {
      const a = await prisma.area.findFirst({ where: { id: v, organizacionId: org.id }, select: { id: true } });
      if (!a) return res.status(422).json({ error: 'Área inválida.' });
    }
    data.areaId = v;
  }
  if ('estado' in (req.body ?? {})) {
    if (req.body.estado === 'resuelta') {
      data.estado = 'resuelta'; data.cerradaEn = new Date(); data.cerradaPorId = u.sub;
    } else if (req.body.estado === 'abierta') {
      data.estado = 'abierta'; data.cerradaEn = null; data.cerradaPorId = null;
    } else {
      return res.status(422).json({ error: 'Estado inválido.' });
    }
  }

  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const novedad = await prisma.novedad.update({ where: { id: actual.id }, data, select: SELECT });
  res.json({ ok: true, novedad });
});

// DELETE /novedades/:id — borrar la propia (un error al digitar). La
// coordinación puede borrar cualquiera.
novedadesRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a novedades.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = req.user!;
  const actual = await prisma.novedad.findFirst({
    where: { id: req.params.id, organizacionId: org.id },
    select: { id: true, usuarioId: true },
  });
  if (!actual) return res.status(404).json({ error: 'Novedad no encontrada.' });
  if (actual.usuarioId !== u.sub && !esCoordinacion(u)) {
    return res.status(403).json({ error: 'Esta novedad no es tuya.' });
  }
  await prisma.novedad.delete({ where: { id: actual.id } });
  res.json({ ok: true });
});
