// apps/api/src/routes/admin.ts
//
// Panel de Administración: parámetros de liquidación y catálogos base
// (áreas, tipos de tarea, tipos de obligación, periodicidades, etiquetas).
// Lectura: cualquier usuario autenticado (para poblar selects). Escritura:
// solo Administrador o root.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRol, type AuthedRequest } from '../auth/middleware.js';
import { hashPassword } from '../auth/password.js';

export const adminRouter = Router();

const soloAdmin = requireRol('Administrador');
const PASSWORD_TEMPORAL_DEFECTO = 'Cerpat2026*';

async function orgId(): Promise<string | null> {
  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' }, select: { id: true } });
  return org?.id ?? null;
}

// ---------- Parámetros de liquidación (una fila por organización) ----------

const CAMPOS_PARAM = ['tasaMoraMensual', 'valorUvt', 'smmlv', 'sancionMinimaUvt', 'pctSancionExtemporaneidad'] as const;

adminRouter.get('/parametros', requireAuth, async (_req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const p = await prisma.parametrosLiquidacion.findUnique({ where: { organizacionId: id } });
  const num = (v: any) => (v != null ? Number(v) : null);
  res.json({
    parametros: p
      ? { tasaMoraMensual: num(p.tasaMoraMensual), valorUvt: num(p.valorUvt), smmlv: num(p.smmlv), sancionMinimaUvt: num(p.sancionMinimaUvt), pctSancionExtemporaneidad: num(p.pctSancionExtemporaneidad) }
      : null,
  });
});

adminRouter.put('/parametros', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const data: Record<string, number> = {};
  for (const c of CAMPOS_PARAM) {
    if (req.body?.[c] !== undefined && req.body[c] !== null && req.body[c] !== '') {
      const n = Number(req.body[c]);
      if (!Number.isFinite(n) || n < 0) return res.status(422).json({ error: `Valor inválido para ${c}.` });
      data[c] = n;
    }
  }
  const p = await prisma.parametrosLiquidacion.upsert({
    where: { organizacionId: id },
    create: { organizacionId: id, ...data },
    update: data,
  });
  res.json({ ok: true, parametros: { tasaMoraMensual: Number(p.tasaMoraMensual), valorUvt: Number(p.valorUvt), smmlv: Number(p.smmlv), sancionMinimaUvt: Number(p.sancionMinimaUvt), pctSancionExtemporaneidad: Number(p.pctSancionExtemporaneidad) } });
});

// ---------- Catálogos simples (nombre + orden opcional) ----------

type CatCfg = { delegate: any; conOrden: boolean };
const CATALOGOS: Record<string, CatCfg> = {
  areas: { delegate: prisma.area, conOrden: true },
  'tipos-tarea': { delegate: prisma.tipoTarea, conOrden: true },
  'tipos-obligacion': { delegate: prisma.tipoObligacion, conOrden: true },
  periodicidades: { delegate: prisma.periodicidad, conOrden: true },
  etiquetas: { delegate: prisma.etiqueta, conOrden: false },
  grupos: { delegate: prisma.grupoEmpresarial, conOrden: false }, // grupos empresariales (Revisoría Fiscal)
};

adminRouter.get('/catalogos/:tipo', requireAuth, async (req, res) => {
  const cfg = CATALOGOS[req.params.tipo];
  if (!cfg) return res.status(404).json({ error: 'Catálogo desconocido.' });
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const items = await cfg.delegate.findMany({
    where: { organizacionId: id },
    orderBy: cfg.conOrden ? [{ orden: 'asc' }, { nombre: 'asc' }] : [{ nombre: 'asc' }],
    select: { id: true, nombre: true, ...(cfg.conOrden ? { orden: true } : {}) },
  });
  res.json({ tipo: req.params.tipo, total: items.length, items });
});

adminRouter.post('/catalogos/:tipo', requireAuth, soloAdmin, async (req, res) => {
  const cfg = CATALOGOS[req.params.tipo];
  if (!cfg) return res.status(404).json({ error: 'Catálogo desconocido.' });
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const nombre = String(req.body?.nombre ?? '').trim();
  if (!nombre) return res.status(422).json({ error: 'El nombre es obligatorio.' });
  try {
    const item = await cfg.delegate.create({
      data: { organizacionId: id, nombre, ...(cfg.conOrden ? { orden: Number(req.body?.orden) || 0 } : {}) },
      select: { id: true, nombre: true, ...(cfg.conOrden ? { orden: true } : {}) },
    });
    res.status(201).json({ ok: true, item });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Ya existe un elemento con ese nombre.' });
    throw e;
  }
});

adminRouter.patch('/catalogos/:tipo/:id', requireAuth, soloAdmin, async (req, res) => {
  const cfg = CATALOGOS[req.params.tipo];
  if (!cfg) return res.status(404).json({ error: 'Catálogo desconocido.' });
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const data: Record<string, any> = {};
  if (typeof req.body?.nombre === 'string' && req.body.nombre.trim()) data.nombre = req.body.nombre.trim();
  if (cfg.conOrden && req.body?.orden !== undefined && req.body.orden !== null && req.body.orden !== '') data.orden = Number(req.body.orden) || 0;
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  try {
    const r = await cfg.delegate.updateMany({ where: { id: req.params.id, organizacionId: id }, data });
    if (r.count === 0) return res.status(404).json({ error: 'Elemento no encontrado.' });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Ya existe un elemento con ese nombre.' });
    throw e;
  }
});

adminRouter.delete('/catalogos/:tipo/:id', requireAuth, soloAdmin, async (req, res) => {
  const cfg = CATALOGOS[req.params.tipo];
  if (!cfg) return res.status(404).json({ error: 'Catálogo desconocido.' });
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  try {
    const r = await cfg.delegate.deleteMany({ where: { id: req.params.id, organizacionId: id } });
    if (r.count === 0) return res.status(404).json({ error: 'Elemento no encontrado.' });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2003') return res.status(409).json({ error: 'No se puede eliminar: está en uso por tareas u otros registros.' });
    throw e;
  }
});

// ---------- Cat. Tareas: actividades del plan + subtareas plantilla ----------

const BOOL_ACT = ['esRegistroSoftware', 'requiereAuditoria', 'generaPago', 'activo'] as const;
const TEXTO_ACT = ['grupo', 'descripcion', 'documentoFormato', 'periodicidad'] as const;

function datosActividad(body: any, esCreacion: boolean): Record<string, any> {
  const data: Record<string, any> = {};
  if (typeof body?.codigo === 'string' && body.codigo.trim()) data.codigo = body.codigo.trim();
  if (typeof body?.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim();
  if ('areaId' in (body ?? {})) data.areaId = body.areaId || null;
  for (const c of TEXTO_ACT) if (c in (body ?? {})) data[c] = typeof body[c] === 'string' && body[c].trim() ? body[c].trim() : null;
  for (const b of BOOL_ACT) if (b in (body ?? {})) data[b] = !!body[b];
  if (body?.orden !== undefined && body.orden !== null && body.orden !== '') data.orden = Number(body.orden) || 0;
  if (esCreacion && data.orden === undefined) data.orden = 0;
  return data;
}

adminRouter.get('/actividades', requireAuth, async (_req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const items = await prisma.actividadPlan.findMany({
    where: { organizacionId: id },
    orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
    select: {
      id: true, codigo: true, nombre: true, grupo: true, periodicidad: true, orden: true, activo: true,
      esRegistroSoftware: true, requiereAuditoria: true, generaPago: true,
      area: { select: { id: true, nombre: true } },
      _count: { select: { subtareas: true, tareas: true } },
    },
  });
  res.json({ total: items.length, items: items.map((a) => ({ ...a, area: a.area?.nombre ?? null, areaId: a.area?.id ?? null, subtareas: a._count.subtareas, tareas: a._count.tareas, _count: undefined })) });
});

adminRouter.get('/actividades/:id', requireAuth, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const a = await prisma.actividadPlan.findFirst({
    where: { id: req.params.id, organizacionId: id },
    include: { subtareas: { orderBy: { orden: 'asc' }, select: { id: true, texto: true, orden: true } } },
  });
  if (!a) return res.status(404).json({ error: 'Actividad no encontrada.' });
  res.json({ actividad: a });
});

adminRouter.post('/actividades', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const data = datosActividad(req.body, true);
  if (!data.codigo || !data.nombre) return res.status(422).json({ error: 'Código y nombre son obligatorios.' });
  try {
    const a = await prisma.actividadPlan.create({ data: { organizacionId: id, ...data } as any, select: { id: true } });
    res.status(201).json({ ok: true, id: a.id });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Ya existe una actividad con ese código.' });
    throw e;
  }
});

adminRouter.patch('/actividades/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const data = datosActividad(req.body, false);
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  try {
    const r = await prisma.actividadPlan.updateMany({ where: { id: req.params.id, organizacionId: id }, data });
    if (r.count === 0) return res.status(404).json({ error: 'Actividad no encontrada.' });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Ya existe una actividad con ese código.' });
    throw e;
  }
});

adminRouter.delete('/actividades/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const conTareas = await prisma.tarea.count({ where: { organizacionId: id, actividadPlanId: req.params.id } });
  if (conTareas > 0) return res.status(409).json({ error: `No se puede eliminar: tiene ${conTareas} tarea(s) generadas. Puedes desactivarla en su lugar.` });
  const r = await prisma.actividadPlan.deleteMany({ where: { id: req.params.id, organizacionId: id } });
  if (r.count === 0) return res.status(404).json({ error: 'Actividad no encontrada.' });
  res.json({ ok: true });
});

// Subtareas plantilla de una actividad
async function actividadDeOrg(actId: string): Promise<boolean> {
  const id = await orgId();
  if (!id) return false;
  const a = await prisma.actividadPlan.findFirst({ where: { id: actId, organizacionId: id }, select: { id: true } });
  return !!a;
}

adminRouter.post('/actividades/:id/subtareas', requireAuth, soloAdmin, async (req, res) => {
  if (!(await actividadDeOrg(req.params.id))) return res.status(404).json({ error: 'Actividad no encontrada.' });
  const texto = String(req.body?.texto ?? '').trim();
  if (!texto) return res.status(422).json({ error: 'El texto de la subtarea es obligatorio.' });
  const s = await prisma.subtareaPlantilla.create({ data: { actividadPlanId: req.params.id, texto, orden: Number(req.body?.orden) || 0 }, select: { id: true, texto: true, orden: true } });
  res.status(201).json({ ok: true, subtarea: s });
});

adminRouter.patch('/actividades/:id/subtareas/:subId', requireAuth, soloAdmin, async (req, res) => {
  if (!(await actividadDeOrg(req.params.id))) return res.status(404).json({ error: 'Actividad no encontrada.' });
  const data: Record<string, any> = {};
  if (typeof req.body?.texto === 'string' && req.body.texto.trim()) data.texto = req.body.texto.trim();
  if (req.body?.orden !== undefined && req.body.orden !== null && req.body.orden !== '') data.orden = Number(req.body.orden) || 0;
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.subtareaPlantilla.updateMany({ where: { id: req.params.subId, actividadPlanId: req.params.id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Subtarea no encontrada.' });
  res.json({ ok: true });
});

adminRouter.delete('/actividades/:id/subtareas/:subId', requireAuth, soloAdmin, async (req, res) => {
  if (!(await actividadDeOrg(req.params.id))) return res.status(404).json({ error: 'Actividad no encontrada.' });
  const r = await prisma.subtareaPlantilla.deleteMany({ where: { id: req.params.subId, actividadPlanId: req.params.id } });
  if (r.count === 0) return res.status(404).json({ error: 'Subtarea no encontrada.' });
  res.json({ ok: true });
});

// ---------- Vencimientos (calendario tributario general) ----------

function datosVencimiento(body: any): { data?: Record<string, any>; error?: string } {
  const data: Record<string, any> = {};
  if ('obligacionId' in (body ?? {})) data.obligacionId = body.obligacionId || null;
  for (const c of ['municipio', 'periodo', 'nitRango'] as const) {
    if (c in (body ?? {})) data[c] = typeof body[c] === 'string' && body[c].trim() ? body[c].trim() : null;
  }
  if ('fechaVencimiento' in (body ?? {})) {
    const raw = String(body.fechaVencimiento ?? '');
    const d = raw ? new Date(raw) : null;
    if (!d || isNaN(d.getTime())) return { error: 'Fecha de vencimiento inválida.' };
    data.fechaVencimiento = d;
  }
  return { data };
}

adminRouter.get('/vencimientos', requireAuth, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const periodo = typeof req.query.periodo === 'string' && req.query.periodo ? req.query.periodo : undefined;
  const obligacionId = typeof req.query.obligacionId === 'string' && req.query.obligacionId ? req.query.obligacionId : undefined;
  const items = await prisma.vencimiento.findMany({
    where: { organizacionId: id, ...(periodo ? { periodo } : {}), ...(obligacionId ? { obligacionId } : {}) },
    orderBy: [{ fechaVencimiento: 'asc' }],
    select: {
      id: true, municipio: true, periodo: true, fechaVencimiento: true, nitRango: true,
      obligacion: { select: { id: true, nombre: true } },
    },
    take: 1000,
  });
  res.json({ total: items.length, items: items.map((v) => ({ ...v, obligacion: v.obligacion?.nombre ?? null, obligacionId: v.obligacion?.id ?? null })) });
});

adminRouter.post('/vencimientos', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { data, error } = datosVencimiento(req.body);
  if (error) return res.status(422).json({ error });
  if (!data!.fechaVencimiento) return res.status(422).json({ error: 'La fecha de vencimiento es obligatoria.' });
  const v = await prisma.vencimiento.create({ data: { organizacionId: id, ...data } as any, select: { id: true } });
  res.status(201).json({ ok: true, id: v.id });
});

adminRouter.patch('/vencimientos/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { data, error } = datosVencimiento(req.body);
  if (error) return res.status(422).json({ error });
  if (Object.keys(data!).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.vencimiento.updateMany({ where: { id: req.params.id, organizacionId: id }, data: data! });
  if (r.count === 0) return res.status(404).json({ error: 'Vencimiento no encontrado.' });
  res.json({ ok: true });
});

adminRouter.delete('/vencimientos/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const r = await prisma.vencimiento.deleteMany({ where: { id: req.params.id, organizacionId: id } });
  if (r.count === 0) return res.status(404).json({ error: 'Vencimiento no encontrado.' });
  res.json({ ok: true });
});

// ---------- Usuarios (crear/editar/roles/activar) ----------

adminRouter.get('/roles', requireAuth, async (_req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const roles = await prisma.rol.findMany({ where: { organizacionId: id }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } });
  res.json({ roles });
});

adminRouter.get('/usuarios', requireAuth, soloAdmin, async (_req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const usuarios = await prisma.usuario.findMany({
    where: { organizacionId: id },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    select: {
      id: true, nombre: true, email: true, cargo: true, area: true, activo: true, esRootPlataforma: true,
      debeCambiarPassword: true, empresaClienteId: true, grupoClienteId: true,
      roles: { select: { rolId: true, rol: { select: { nombre: true } } } },
    },
  });
  res.json({ total: usuarios.length, usuarios: usuarios.map((u) => ({ ...u, esRoot: u.esRootPlataforma, roles: u.roles.map((r) => ({ id: r.rolId, nombre: r.rol.nombre })), esRootPlataforma: undefined })) });
});

function normalizaRolIds(body: any): string[] {
  return Array.isArray(body?.roles) ? body.roles.map((r: any) => String(r)).filter(Boolean) : [];
}

adminRouter.post('/usuarios', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const nombre = String(req.body?.nombre ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!nombre || !email) return res.status(422).json({ error: 'Nombre y correo son obligatorios.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(422).json({ error: 'Correo inválido.' });
  const rolIds = normalizaRolIds(req.body);
  const temporal = String(req.body?.passwordTemporal ?? '').trim() || PASSWORD_TEMPORAL_DEFECTO;
  try {
    const u = await prisma.usuario.create({
      data: {
        organizacionId: id, nombre, email, passwordHash: hashPassword(temporal), debeCambiarPassword: true,
        cargo: req.body?.cargo?.trim() || null, area: req.body?.area?.trim() || null, activo: req.body?.activo !== false,
        empresaClienteId: req.body?.empresaClienteId || null, grupoClienteId: req.body?.grupoClienteId || null,
        ...(rolIds.length ? { roles: { create: rolIds.map((rolId) => ({ rolId })) } } : {}),
      },
      select: { id: true },
    });
    res.status(201).json({ ok: true, id: u.id, passwordTemporal: temporal });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
    if (e?.code === 'P2003') return res.status(422).json({ error: 'Alguno de los roles no es válido.' });
    throw e;
  }
});

adminRouter.patch('/usuarios/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = await prisma.usuario.findFirst({ where: { id: req.params.id, organizacionId: id }, select: { id: true, esRootPlataforma: true } });
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const data: Record<string, any> = {};
  if (typeof req.body?.nombre === 'string' && req.body.nombre.trim()) data.nombre = req.body.nombre.trim();
  if ('cargo' in req.body) data.cargo = req.body.cargo?.trim() || null;
  if ('area' in req.body) data.area = req.body.area?.trim() || null;
  if ('activo' in req.body) {
    if (u.esRootPlataforma && req.body.activo === false) return res.status(403).json({ error: 'No se puede desactivar al usuario root.' });
    data.activo = !!req.body.activo;
  }
  if ('empresaClienteId' in req.body) data.empresaClienteId = req.body.empresaClienteId || null;
  if ('grupoClienteId' in req.body) data.grupoClienteId = req.body.grupoClienteId || null;

  const cambiarRoles = Array.isArray(req.body?.roles);
  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.usuario.update({ where: { id: u.id }, data });
      if (cambiarRoles) {
        const rolIds = normalizaRolIds(req.body);
        await tx.usuarioRol.deleteMany({ where: { usuarioId: u.id } });
        if (rolIds.length) await tx.usuarioRol.createMany({ data: rolIds.map((rolId) => ({ usuarioId: u.id, rolId })) });
      }
    });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2003') return res.status(422).json({ error: 'Alguno de los roles no es válido.' });
    throw e;
  }
});

adminRouter.post('/usuarios/:id/reset-password', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = await prisma.usuario.findFirst({ where: { id: req.params.id, organizacionId: id }, select: { id: true } });
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const temporal = String(req.body?.passwordTemporal ?? '').trim() || PASSWORD_TEMPORAL_DEFECTO;
  await prisma.usuario.update({ where: { id: u.id }, data: { passwordHash: hashPassword(temporal), debeCambiarPassword: true } });
  res.json({ ok: true, passwordTemporal: temporal });
});

adminRouter.delete('/usuarios/:id', requireAuth, soloAdmin, async (req: AuthedRequest, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  if (req.params.id === req.user!.sub) return res.status(403).json({ error: 'No puedes eliminar tu propio usuario.' });
  const u = await prisma.usuario.findFirst({ where: { id: req.params.id, organizacionId: id }, select: { id: true, esRootPlataforma: true } });
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (u.esRootPlataforma) return res.status(403).json({ error: 'No se puede eliminar al usuario root.' });
  try {
    await prisma.usuario.delete({ where: { id: u.id } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2003') return res.status(409).json({ error: 'No se puede eliminar: el usuario tiene tareas asignadas o creadas. Desactívalo en su lugar.' });
    throw e;
  }
});

// ---------- Empresas / Clientes ----------

const EMAILS_EMPRESA = ['emailRepresentante', 'emailAdministracion', 'emailContabilidad', 'emailTalentoHumano', 'emailTesoreria'] as const;

function datosEmpresa(body: any): Record<string, any> {
  const data: Record<string, any> = {};
  if (typeof body?.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim();
  for (const c of ['nit', 'servicio', 'asesorNombre'] as const) if (c in (body ?? {})) data[c] = typeof body[c] === 'string' && body[c].trim() ? body[c].trim() : null;
  for (const e of EMAILS_EMPRESA) if (e in (body ?? {})) data[e] = typeof body[e] === 'string' && body[e].trim() ? body[e].trim() : null;
  if ('activo' in (body ?? {})) data.activo = !!body.activo;
  if ('grupoId' in (body ?? {})) data.grupoId = body.grupoId || null;
  return data;
}

adminRouter.get('/empresas', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const incluirInactivos = req.query.incluirInactivos === '1' || req.query.incluirInactivos === 'true';
  const items = await prisma.empresa.findMany({
    where: { organizacionId: id, ...(incluirInactivos ? {} : { activo: true }) },
    orderBy: { nombre: 'asc' },
    select: {
      id: true, nombre: true, nit: true, servicio: true, asesorNombre: true, activo: true, grupoId: true,
      emailRepresentante: true, emailAdministracion: true, emailContabilidad: true, emailTalentoHumano: true, emailTesoreria: true,
    },
  });
  res.json({ total: items.length, items });
});

adminRouter.post('/empresas', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const data = datosEmpresa(req.body);
  if (!data.nombre) return res.status(422).json({ error: 'El nombre del cliente es obligatorio.' });
  const e = await prisma.empresa.create({ data: { organizacionId: id, activo: true, ...data } as any, select: { id: true } });
  res.status(201).json({ ok: true, id: e.id });
});

adminRouter.patch('/empresas/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const data = datosEmpresa(req.body);
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.empresa.updateMany({ where: { id: req.params.id, organizacionId: id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
  res.json({ ok: true });
});

adminRouter.delete('/empresas/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  try {
    const r = await prisma.empresa.deleteMany({ where: { id: req.params.id, organizacionId: id } });
    if (r.count === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2003') return res.status(409).json({ error: 'No se puede eliminar: el cliente tiene tareas o pagos. Desactívalo en su lugar.' });
    throw e;
  }
});

// ---------- Plan de trabajo por cliente (PlanClienteActividad) ----------

const soloCoordinacion = requireRol('Administrador', 'Coordinador');
const PASO_PLAN: Record<string, number> = { Mensual: 1, Bimestral: 2, Trimestral: 3, Cuatrimestral: 4, Semestral: 6, Anual: 12 };
function aplicaEnMesPlan(periodicidad: string | null, mes1a12: number): boolean {
  const n = PASO_PLAN[(periodicidad || '').trim()];
  return n ? (mes1a12 - 1) % n === 0 : false;
}

// GET /admin/plan-cliente/:empresaId — catálogo de actividades por área con el
// estado del plan del cliente (marcadas/periodicidad propia).
adminRouter.get('/plan-cliente/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true, nombre: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const [actividades, planes] = await Promise.all([
    prisma.actividadPlan.findMany({
      where: { organizacionId: id, activo: true },
      orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
      select: { id: true, codigo: true, nombre: true, periodicidad: true, area: { select: { id: true, nombre: true } } },
    }),
    prisma.planClienteActividad.findMany({ where: { organizacionId: id, empresaId: empresa.id }, select: { actividadPlanId: true, activa: true, periodicidad: true } }),
  ]);
  const planMap = new Map(planes.map((p) => [p.actividadPlanId, p]));

  const areasMap = new Map<string, { area: string; areaId: string | null; actividades: any[] }>();
  for (const a of actividades) {
    const key = a.area?.id ?? 'sin';
    if (!areasMap.has(key)) areasMap.set(key, { area: a.area?.nombre ?? 'Sin área', areaId: a.area?.id ?? null, actividades: [] });
    const p = planMap.get(a.id);
    areasMap.get(key)!.actividades.push({
      id: a.id, codigo: a.codigo, nombre: a.nombre, periodicidadCatalogo: a.periodicidad,
      enPlan: !!p && p.activa, periodicidad: p?.periodicidad ?? null,
    });
  }
  res.json({ empresa, areas: Array.from(areasMap.values()) });
});

// PUT /admin/plan-cliente/:empresaId  { activas: [id], periodicidades: {id: 'Mensual'} }
adminRouter.put('/plan-cliente/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const activas: string[] = Array.isArray(req.body?.activas) ? req.body.activas.map((x: any) => String(x)) : [];
  const periods: Record<string, string> = (req.body?.periodicidades && typeof req.body.periodicidades === 'object') ? req.body.periodicidades : {};
  const activasSet = new Set(activas);

  await prisma.$transaction(async (tx) => {
    // Desactiva las que ya no están.
    await tx.planClienteActividad.updateMany({ where: { organizacionId: id, empresaId: empresa.id, actividadPlanId: { notIn: activas.length ? activas : ['-'] } }, data: { activa: false } });
    // Activa/actualiza las marcadas.
    for (const actividadPlanId of activasSet) {
      const periodicidad = periods[actividadPlanId] || null;
      await tx.planClienteActividad.upsert({
        where: { empresaId_actividadPlanId: { empresaId: empresa.id, actividadPlanId } },
        create: { organizacionId: id, empresaId: empresa.id, actividadPlanId, activa: true, periodicidad },
        update: { activa: true, periodicidad },
      });
    }
  });
  res.json({ ok: true, activas: activasSet.size });
});

// POST /admin/plan-cliente/:empresaId/generar?periodo=YYYY-MM — genera las tareas
// del cliente para ese período según su plan activo (idempotente).
adminRouter.post('/plan-cliente/:empresaId/generar', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo) ? req.query.periodo : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = periodo.split('-').map(Number);
  const fechaInicio = new Date(Date.UTC(year, month - 1, 1));
  const fechaVencimiento = new Date(Date.UTC(year, month, 0));

  const planes = await prisma.planClienteActividad.findMany({
    where: { organizacionId: id, empresaId: empresa.id, activa: true },
    select: { actividadPlanId: true, periodicidad: true, actividad: { select: { nombre: true, areaId: true, periodicidad: true, requiereAuditoria: true, generaPago: true } } },
  });
  const asign = await prisma.asignacionClienteArea.findMany({ where: { organizacionId: id, empresaId: empresa.id }, select: { areaId: true, asesorId: true, auxiliarId: true } });
  const asignPorArea = new Map(asign.map((a) => [a.areaId, { asesorId: a.asesorId, auxiliarId: a.auxiliarId }]));
  const existentes = await prisma.tarea.findMany({ where: { organizacionId: id, empresaId: empresa.id, periodo, actividadPlanId: { not: null } }, select: { actividadPlanId: true } });
  const yaExiste = new Set(existentes.map((t) => t.actividadPlanId));

  const nuevas = [];
  for (const p of planes) {
    if (!p.actividad) continue;
    const per = p.periodicidad || p.actividad.periodicidad;
    if (!aplicaEnMesPlan(per, month)) continue;
    if (yaExiste.has(p.actividadPlanId)) continue;
    const a = p.actividad.areaId ? asignPorArea.get(p.actividad.areaId) : undefined;
    nuevas.push({
      organizacionId: id, titulo: p.actividad.nombre, empresaId: empresa.id, fechaInicio, fechaVencimiento,
      actividadPlanId: p.actividadPlanId, areaId: p.actividad.areaId, generaPago: p.actividad.generaPago,
      requiereRevisionTecnica: p.actividad.requiereAuditoria, periodo,
      asesorId: a?.asesorId ?? null, auxiliarId: a?.auxiliarId ?? null,
    });
  }
  const r = nuevas.length ? await prisma.tarea.createMany({ data: nuevas as any }) : { count: 0 };
  res.json({ ok: true, periodo, creadas: r.count, yaExistian: existentes.length });
});
