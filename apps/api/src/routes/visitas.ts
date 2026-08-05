// apps/api/src/routes/visitas.ts
// Visitas del asesor/auditor al cliente, con su "acta": objetivo, recomendaciones
// y compromisos (cada uno con fecha límite y responsable). Fuente adicional del
// calendario. Lectura: cualquier usuario de la firma. Creación: usuario de la
// firma. Edición/borrado del acta: coordinación/Administrador o el responsable.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const visitasRouter = Router();

const ESTADOS_VISITA = ['programada', 'realizada', 'cancelada'];
const ESTADOS_COMPROMISO = ['pendiente', 'cumplido', 'cancelado'];

async function orgCerpat() {
  return prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
}
// Usuario de la firma (no cliente externo).
function esUsuarioFirma(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || (u.roles.length > 0 && !u.empresaCliente && !u.grupoCliente));
}
function puedeGestionar(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)));
}
// Convierte "YYYY-MM-DD" a Date en medianoche UTC (fecha estable, sin corrimiento
// por zona horaria). Devuelve null si viene vacío o inválido.
function fechaSolo(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}
function limpiarTexto(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

// GET /visitas?anio=&mes=&empresaId=&responsableId=&estado=
// Devuelve las visitas del mes (para el calendario) o filtradas. Cualquier
// usuario de la firma.
visitasRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a visitas.' });
  const org = await orgCerpat();
  if (!org) return res.json({ visitas: [] });

  const where: any = { organizacionId: org.id };
  const anio = parseInt(String(req.query.anio ?? ''), 10);
  const mes = parseInt(String(req.query.mes ?? ''), 10);
  if (Number.isFinite(anio) && Number.isFinite(mes) && mes >= 1 && mes <= 12) {
    where.fecha = { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) };
  }
  if (typeof req.query.empresaId === 'string' && req.query.empresaId) where.empresaId = req.query.empresaId;
  if (typeof req.query.responsableId === 'string' && req.query.responsableId) where.responsableId = req.query.responsableId;
  if (typeof req.query.estado === 'string' && ESTADOS_VISITA.includes(req.query.estado)) where.estado = req.query.estado;

  const visitas = await prisma.visita.findMany({
    where,
    orderBy: { fecha: 'asc' },
    include: {
      empresa: { select: { nombre: true } },
      responsable: { select: { nombre: true } },
      compromisos: { select: { estado: true } },
    },
  });

  return res.json({
    visitas: visitas.map((v) => ({
      id: v.id,
      empresaId: v.empresaId,
      empresa: v.empresa?.nombre ?? null,
      responsableId: v.responsableId,
      responsable: v.responsable?.nombre ?? null,
      fecha: v.fecha.toISOString(),
      hora: v.hora,
      objetivo: v.objetivo,
      estado: v.estado,
      observaciones: v.observaciones,
      compromisosTotal: v.compromisos.length,
      compromisosPendientes: v.compromisos.filter((c) => c.estado === 'pendiente').length,
      compromisosCumplidos: v.compromisos.filter((c) => c.estado === 'cumplido').length,
    })),
  });
});

// GET /visitas/:id — detalle con el acta completa (compromisos + recomendaciones).
visitasRouter.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a visitas.' });
  const org = await orgCerpat();
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const v = await prisma.visita.findFirst({
    where: { id: req.params.id, organizacionId: org.id },
    include: {
      empresa: { select: { id: true, nombre: true } },
      responsable: { select: { id: true, nombre: true } },
      compromisos: {
        orderBy: [{ fechaLimite: 'asc' }, { createdAt: 'asc' }],
        include: { responsable: { select: { id: true, nombre: true } } },
      },
    },
  });
  if (!v) return res.status(404).json({ error: 'Visita no encontrada.' });
  return res.json({
    visita: {
      id: v.id,
      empresaId: v.empresaId,
      empresa: v.empresa,
      responsableId: v.responsableId,
      responsable: v.responsable,
      fecha: v.fecha.toISOString().slice(0, 10),
      hora: v.hora,
      objetivo: v.objetivo,
      recomendaciones: v.recomendaciones,
      estado: v.estado,
      observaciones: v.observaciones,
      compromisos: v.compromisos.map((c) => ({
        id: c.id,
        descripcion: c.descripcion,
        fechaLimite: c.fechaLimite ? c.fechaLimite.toISOString().slice(0, 10) : null,
        responsableId: c.responsableId,
        responsable: c.responsable,
        estado: c.estado,
      })),
    },
  });
});

// POST /visitas — agenda una visita (con compromisos iniciales opcionales).
visitasRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a visitas.' });
  const org = await orgCerpat();
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const b = req.body ?? {};
  const empresaId = typeof b.empresaId === 'string' ? b.empresaId : '';
  const fecha = fechaSolo(b.fecha);
  if (!empresaId) return res.status(400).json({ error: 'El cliente es obligatorio.' });
  if (!fecha) return res.status(400).json({ error: 'La fecha de la visita es obligatoria (YYYY-MM-DD).' });
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, organizacionId: org.id }, select: { id: true } });
  if (!empresa) return res.status(400).json({ error: 'Cliente no válido.' });
  const estado = typeof b.estado === 'string' && ESTADOS_VISITA.includes(b.estado) ? b.estado : 'programada';

  const compromisosIn = Array.isArray(b.compromisos) ? b.compromisos : [];
  const compromisosData = compromisosIn
    .map((c: any) => ({ descripcion: limpiarTexto(c?.descripcion), fechaLimite: fechaSolo(c?.fechaLimite), responsableId: typeof c?.responsableId === 'string' && c.responsableId ? c.responsableId : null }))
    .filter((c: any) => c.descripcion)
    .map((c: any) => ({ organizacionId: org.id, descripcion: c.descripcion as string, fechaLimite: c.fechaLimite, responsableId: c.responsableId, estado: 'pendiente' as const }));

  const visita = await prisma.visita.create({
    data: {
      organizacionId: org.id,
      empresaId,
      responsableId: typeof b.responsableId === 'string' && b.responsableId ? b.responsableId : null,
      fecha,
      hora: limpiarTexto(b.hora),
      objetivo: limpiarTexto(b.objetivo),
      recomendaciones: limpiarTexto(b.recomendaciones),
      estado: estado as any,
      observaciones: limpiarTexto(b.observaciones),
      creadoPorId: req.user!.sub,
      compromisos: compromisosData.length ? { create: compromisosData } : undefined,
    },
    select: { id: true },
  });
  return res.status(201).json({ id: visita.id });
});

// Permiso para editar el acta: coordinación/Administrador o el responsable.
async function puedeEditarVisita(req: AuthedRequest, orgId: string, visitaId: string) {
  const v = await prisma.visita.findFirst({ where: { id: visitaId, organizacionId: orgId }, select: { id: true, responsableId: true } });
  if (!v) return { v: null, ok: false };
  const ok = puedeGestionar(req.user) || v.responsableId === req.user!.sub;
  return { v, ok };
}

// PATCH /visitas/:id — edita datos del acta.
visitasRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgCerpat();
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { v, ok } = await puedeEditarVisita(req, org.id, req.params.id);
  if (!v) return res.status(404).json({ error: 'Visita no encontrada.' });
  if (!ok) return res.status(403).json({ error: 'Solo coordinación o el responsable pueden editar la visita.' });

  const b = req.body ?? {};
  const data: any = {};
  if ('empresaId' in b && typeof b.empresaId === 'string' && b.empresaId) {
    const emp = await prisma.empresa.findFirst({ where: { id: b.empresaId, organizacionId: org.id }, select: { id: true } });
    if (!emp) return res.status(400).json({ error: 'Cliente no válido.' });
    data.empresaId = b.empresaId;
  }
  if ('responsableId' in b) data.responsableId = typeof b.responsableId === 'string' && b.responsableId ? b.responsableId : null;
  if ('fecha' in b) { const f = fechaSolo(b.fecha); if (!f) return res.status(400).json({ error: 'Fecha inválida.' }); data.fecha = f; }
  if ('hora' in b) data.hora = limpiarTexto(b.hora);
  if ('objetivo' in b) data.objetivo = limpiarTexto(b.objetivo);
  if ('recomendaciones' in b) data.recomendaciones = limpiarTexto(b.recomendaciones);
  if ('observaciones' in b) data.observaciones = limpiarTexto(b.observaciones);
  if ('estado' in b) { if (!ESTADOS_VISITA.includes(b.estado)) return res.status(400).json({ error: 'Estado inválido.' }); data.estado = b.estado; }

  await prisma.visita.update({ where: { id: v.id }, data });
  return res.json({ ok: true });
});

// DELETE /visitas/:id
visitasRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgCerpat();
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { v, ok } = await puedeEditarVisita(req, org.id, req.params.id);
  if (!v) return res.status(404).json({ error: 'Visita no encontrada.' });
  if (!ok) return res.status(403).json({ error: 'Solo coordinación o el responsable pueden eliminar la visita.' });
  await prisma.visita.delete({ where: { id: v.id } });
  return res.json({ ok: true });
});

// POST /visitas/:id/compromisos — agrega un compromiso al acta.
visitasRouter.post('/:id/compromisos', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgCerpat();
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { v, ok } = await puedeEditarVisita(req, org.id, req.params.id);
  if (!v) return res.status(404).json({ error: 'Visita no encontrada.' });
  if (!ok) return res.status(403).json({ error: 'Sin permiso para editar el acta.' });
  const b = req.body ?? {};
  const descripcion = limpiarTexto(b.descripcion);
  if (!descripcion) return res.status(400).json({ error: 'La descripción del compromiso es obligatoria.' });
  const c = await prisma.compromisoVisita.create({
    data: {
      organizacionId: org.id,
      visitaId: v.id,
      descripcion,
      fechaLimite: fechaSolo(b.fechaLimite),
      responsableId: typeof b.responsableId === 'string' && b.responsableId ? b.responsableId : null,
      estado: typeof b.estado === 'string' && ESTADOS_COMPROMISO.includes(b.estado) ? (b.estado as any) : 'pendiente',
    },
    select: { id: true },
  });
  return res.status(201).json({ id: c.id });
});

// PATCH /visitas/compromisos/:cid — edita/estado de un compromiso.
visitasRouter.patch('/compromisos/:cid', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgCerpat();
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const c = await prisma.compromisoVisita.findFirst({ where: { id: req.params.cid, organizacionId: org.id }, include: { visita: { select: { responsableId: true } } } });
  if (!c) return res.status(404).json({ error: 'Compromiso no encontrado.' });
  if (!(puedeGestionar(req.user) || c.visita.responsableId === req.user!.sub || c.responsableId === req.user!.sub))
    return res.status(403).json({ error: 'Sin permiso para editar el compromiso.' });
  const b = req.body ?? {};
  const data: any = {};
  if ('descripcion' in b) { const d = limpiarTexto(b.descripcion); if (!d) return res.status(400).json({ error: 'La descripción no puede quedar vacía.' }); data.descripcion = d; }
  if ('fechaLimite' in b) data.fechaLimite = fechaSolo(b.fechaLimite);
  if ('responsableId' in b) data.responsableId = typeof b.responsableId === 'string' && b.responsableId ? b.responsableId : null;
  if ('estado' in b) { if (!ESTADOS_COMPROMISO.includes(b.estado)) return res.status(400).json({ error: 'Estado inválido.' }); data.estado = b.estado; }
  await prisma.compromisoVisita.update({ where: { id: c.id }, data });
  return res.json({ ok: true });
});

// DELETE /visitas/compromisos/:cid
visitasRouter.delete('/compromisos/:cid', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgCerpat();
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const c = await prisma.compromisoVisita.findFirst({ where: { id: req.params.cid, organizacionId: org.id }, include: { visita: { select: { responsableId: true } } } });
  if (!c) return res.status(404).json({ error: 'Compromiso no encontrado.' });
  if (!(puedeGestionar(req.user) || c.visita.responsableId === req.user!.sub))
    return res.status(403).json({ error: 'Sin permiso para eliminar el compromiso.' });
  await prisma.compromisoVisita.delete({ where: { id: c.id } });
  return res.json({ ok: true });
});
