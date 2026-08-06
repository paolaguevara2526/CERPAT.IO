// apps/api/src/routes/visitas.ts
// Visitas del asesor/auditor al cliente, con su "acta": objetivo, actividades,
// recomendaciones y observaciones (enumeradas), y compromisos (cada uno con fecha
// límite y responsable, que puede ser de la firma o del cliente). Fuente adicional
// del calendario. Lectura: cualquier usuario de la firma. Creación: usuario de la
// firma. Edición/borrado del acta: coordinación/Administrador o el responsable.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const visitasRouter = Router();

const ESTADOS_VISITA = ['programada', 'realizada', 'cancelada'];
const ESTADOS_COMPROMISO = ['pendiente', 'cumplido', 'cancelado'];
const TIPOS_ITEM = ['actividad', 'recomendacion', 'observacion'] as const;
type TipoItem = (typeof TIPOS_ITEM)[number];

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

// Normaliza el responsable de un compromiso: firma (usuario interno) o cliente
// (persona externa, con nombre/cargo en responsableExterno).
function datosResponsable(c: any): { responsableTipo: 'firma' | 'cliente'; responsableId: string | null; responsableExterno: string | null } {
  const tipo = c?.responsableTipo === 'cliente' ? 'cliente' : 'firma';
  if (tipo === 'cliente') return { responsableTipo: 'cliente', responsableId: null, responsableExterno: limpiarTexto(c?.responsableExterno) };
  return { responsableTipo: 'firma', responsableId: typeof c?.responsableId === 'string' && c.responsableId ? c.responsableId : null, responsableExterno: null };
}
// Compromisos válidos desde el body (para crear junto con la visita).
function compromisosDesde(org: string, arr: any): any[] {
  return (Array.isArray(arr) ? arr : [])
    .map((c: any) => ({ descripcion: limpiarTexto(c?.descripcion), fechaLimite: fechaSolo(c?.fechaLimite), area: limpiarTexto(c?.area), ...datosResponsable(c) }))
    .filter((c: any) => c.descripcion)
    .map((c: any) => ({ organizacionId: org, descripcion: c.descripcion, fechaLimite: c.fechaLimite, area: c.area, responsableTipo: c.responsableTipo, responsableId: c.responsableId, responsableExterno: c.responsableExterno, estado: 'pendiente' as const }));
}
// Ítems (actividades/recomendaciones/observaciones) desde el body, en orden.
function itemsDesde(org: string, arr: any): any[] {
  return (Array.isArray(arr) ? arr : [])
    .map((it: any, i: number) => ({ tipo: it?.tipo as TipoItem, texto: limpiarTexto(it?.texto), orden: i }))
    .filter((it: any) => TIPOS_ITEM.includes(it.tipo) && it.texto)
    .map((it: any) => ({ organizacionId: org, tipo: it.tipo, orden: it.orden, texto: it.texto as string }));
}

// GET /visitas?anio=&mes=&empresaId=&responsableId=&estado=
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
      area: v.area,
      objetivo: v.objetivo,
      estado: v.estado,
      compromisosTotal: v.compromisos.length,
      compromisosPendientes: v.compromisos.filter((c) => c.estado === 'pendiente').length,
      compromisosCumplidos: v.compromisos.filter((c) => c.estado === 'cumplido').length,
    })),
  });
});

// GET /visitas/:id — detalle con el acta completa.
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
      items: { orderBy: { orden: 'asc' } },
    },
  });
  if (!v) return res.status(404).json({ error: 'Visita no encontrada.' });
  const itemsDe = (t: TipoItem) => v.items.filter((it) => it.tipo === t).map((it) => it.texto);
  return res.json({
    visita: {
      id: v.id,
      empresaId: v.empresaId,
      empresa: v.empresa,
      responsableId: v.responsableId,
      responsable: v.responsable,
      fecha: v.fecha.toISOString().slice(0, 10),
      hora: v.hora,
      lugar: v.lugar,
      area: v.area,
      objetivo: v.objetivo,
      estado: v.estado,
      // Legado (texto) por compatibilidad; la UI nueva usa las listas.
      recomendacionesTexto: v.recomendaciones,
      observacionesTexto: v.observaciones,
      actividades: itemsDe('actividad'),
      recomendaciones: itemsDe('recomendacion'),
      observaciones: itemsDe('observacion'),
      compromisos: v.compromisos.map((c) => ({
        id: c.id,
        descripcion: c.descripcion,
        fechaLimite: c.fechaLimite ? c.fechaLimite.toISOString().slice(0, 10) : null,
        responsableTipo: c.responsableTipo,
        responsableId: c.responsableId,
        responsable: c.responsable,
        responsableExterno: c.responsableExterno,
        area: c.area,
        estado: c.estado,
      })),
    },
  });
});

// POST /visitas — agenda una visita con su acta (compromisos e ítems opcionales).
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

  const compromisosData = compromisosDesde(org.id, b.compromisos);
  const itemsData = itemsDesde(org.id, b.items);

  const visita = await prisma.visita.create({
    data: {
      organizacionId: org.id,
      empresaId,
      responsableId: typeof b.responsableId === 'string' && b.responsableId ? b.responsableId : null,
      fecha,
      hora: limpiarTexto(b.hora),
      lugar: limpiarTexto(b.lugar),
      area: limpiarTexto(b.area),
      objetivo: limpiarTexto(b.objetivo),
      estado: estado as any,
      creadoPorId: req.user!.sub,
      compromisos: compromisosData.length ? { create: compromisosData } : undefined,
      items: itemsData.length ? { create: itemsData } : undefined,
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

// PATCH /visitas/:id — edita datos del acta. Si el body trae `items`, reemplaza
// por completo las listas enumeradas (actividades/recomendaciones/observaciones).
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
  if ('lugar' in b) data.lugar = limpiarTexto(b.lugar);
  if ('area' in b) data.area = limpiarTexto(b.area);
  if ('objetivo' in b) data.objetivo = limpiarTexto(b.objetivo);
  if ('estado' in b) { if (!ESTADOS_VISITA.includes(b.estado)) return res.status(400).json({ error: 'Estado inválido.' }); data.estado = b.estado; }

  const reemplazarItems = 'items' in b;
  const itemsData = reemplazarItems ? itemsDesde(org.id, b.items) : [];

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.visita.update({ where: { id: v.id }, data });
    if (reemplazarItems) {
      await tx.itemActa.deleteMany({ where: { visitaId: v.id } });
      if (itemsData.length) await tx.itemActa.createMany({ data: itemsData.map((it) => ({ ...it, visitaId: v.id })) });
    }
  });
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
      area: limpiarTexto(b.area),
      ...datosResponsable(b),
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
  if ('area' in b) data.area = limpiarTexto(b.area);
  // Responsable: si viene responsableTipo, se normaliza tipo + interno/externo juntos.
  if ('responsableTipo' in b || 'responsableId' in b || 'responsableExterno' in b) {
    const r = datosResponsable({ responsableTipo: b.responsableTipo ?? c.responsableTipo, responsableId: b.responsableId, responsableExterno: b.responsableExterno });
    data.responsableTipo = r.responsableTipo; data.responsableId = r.responsableId; data.responsableExterno = r.responsableExterno;
  }
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
