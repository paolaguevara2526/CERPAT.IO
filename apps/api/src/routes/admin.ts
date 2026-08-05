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
  // Si aún no se han guardado, se devuelven los valores por defecto (los mismos
  // del esquema) para que el panel no aparezca vacío.
  res.json({
    parametros: {
      tasaMoraMensual: num(p?.tasaMoraMensual) ?? 0.2679,
      valorUvt: num(p?.valorUvt) ?? 52374,
      smmlv: num(p?.smmlv) ?? 1423500,
      sancionMinimaUvt: num(p?.sancionMinimaUvt) ?? 10,
      pctSancionExtemporaneidad: num(p?.pctSancionExtemporaneidad) ?? 0.05,
    },
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
const TEXTO_ACT = ['grupo', 'descripcion', 'documentoFormato', 'periodicidad', 'obligacionVencimiento'] as const;

function datosActividad(body: any, esCreacion: boolean): Record<string, any> {
  const data: Record<string, any> = {};
  if (typeof body?.codigo === 'string' && body.codigo.trim()) data.codigo = body.codigo.trim();
  if (typeof body?.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim();
  if ('areaId' in (body ?? {})) data.areaId = body.areaId || null;
  for (const c of TEXTO_ACT) if (c in (body ?? {})) data[c] = typeof body[c] === 'string' && body[c].trim() ? body[c].trim() : null;
  for (const b of BOOL_ACT) if (b in (body ?? {})) data[b] = !!body[b];
  if ('fase' in (body ?? {})) data.fase = ['captura', 'procesamiento', 'revision'].includes(body.fase) ? body.fase : null;
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

// ---------- Configuración tributaria por cliente ----------

const IVA_OPTS = ['bimestral', 'cuatrimestral', 'anual_rst', 'no_responsable'];
const CONSUMO_OPTS = ['bimestral', 'anual_rst'];
const RENTA_OPTS = ['persona_juridica', 'persona_natural', 'gran_contribuyente', 'rst_consolidada', 'na'];
const ANTICIPO_OPTS = ['bimestral'];
const ICA_PERIOD_OPTS = ['anual', 'bimestral', 'mensual'];
const opt = (v: unknown, allowed: string[]) => (typeof v === 'string' && allowed.includes(v) ? v : null);
// Fecha 'YYYY-MM-DD' → Date (medianoche UTC); vacío/ inválido → null.
const optFecha = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null;
  const d = new Date(`${v.trim()}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
};

// Config nacional + ICA por municipio de una empresa.
adminRouter.get('/config-tributaria/:empresaId', requireAuth, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true, nombre: true, nit: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const config = await prisma.configuracionTributaria.findUnique({ where: { empresaId: empresa.id } });
  const ica = await prisma.empresaMunicipioIca.findMany({
    where: { empresaId: empresa.id },
    select: { id: true, municipioId: true, icaPeriodicidad: true, reteica: true, reteicaPeriodicidad: true, autoica: true, autoicaPeriodicidad: true, fechaInscripcion: true, municipio: { select: { nombre: true, departamento: true } } },
    orderBy: { municipio: { nombre: 'asc' } },
  });
  res.json({ empresa, config, municipiosIca: ica.map((m) => ({ id: m.id, municipioId: m.municipioId, municipio: m.municipio?.nombre ?? null, departamento: m.municipio?.departamento ?? null, icaPeriodicidad: m.icaPeriodicidad, reteica: m.reteica, reteicaPeriodicidad: m.reteicaPeriodicidad, autoica: m.autoica, autoicaPeriodicidad: m.autoicaPeriodicidad, fechaInscripcion: m.fechaInscripcion ? m.fechaInscripcion.toISOString().slice(0, 10) : null })) });
});

// Guardar config nacional (upsert).
adminRouter.put('/config-tributaria/:empresaId', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const b = req.body ?? {};
  const data = {
    ivaPeriodicidad: opt(b.ivaPeriodicidad, IVA_OPTS),
    retencionFuente: !!b.retencionFuente,
    fopat: !!b.fopat,
    nominaElectronica: !!b.nominaElectronica,
    seguridadSocial: !!b.seguridadSocial,
    consumoPeriodicidad: opt(b.consumoPeriodicidad, CONSUMO_OPTS),
    rentaTipo: opt(b.rentaTipo, RENTA_OPTS),
    anticipoRstPeriodicidad: opt(b.anticipoRstPeriodicidad, ANTICIPO_OPTS),
  };
  await prisma.configuracionTributaria.upsert({ where: { empresaId: empresa.id }, update: data, create: { organizacionId: id, empresaId: empresa.id, ...data } });
  res.json({ ok: true });
});

// Agregar un municipio ICA a la empresa.
adminRouter.post('/config-tributaria/:empresaId/ica', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const b = req.body ?? {};
  if (typeof b.municipioId !== 'string' || !b.municipioId) return res.status(422).json({ error: 'Falta el municipio.' });
  try {
    const row = await prisma.empresaMunicipioIca.create({
      data: {
        organizacionId: id, empresaId: empresa.id, municipioId: b.municipioId,
        icaPeriodicidad: opt(b.icaPeriodicidad, ICA_PERIOD_OPTS),
        reteica: !!b.reteica, reteicaPeriodicidad: opt(b.reteicaPeriodicidad, ICA_PERIOD_OPTS),
        autoica: !!b.autoica, autoicaPeriodicidad: opt(b.autoicaPeriodicidad, ICA_PERIOD_OPTS),
        fechaInscripcion: optFecha(b.fechaInscripcion),
      },
      select: { id: true },
    });
    res.status(201).json({ ok: true, id: row.id });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Ese municipio ya está configurado para el cliente.' });
    throw e;
  }
});

// Editar un municipio ICA.
adminRouter.patch('/config-tributaria/:empresaId/ica/:icaId', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const b = req.body ?? {};
  const data: Record<string, any> = {};
  if ('icaPeriodicidad' in b) data.icaPeriodicidad = opt(b.icaPeriodicidad, ICA_PERIOD_OPTS);
  if ('reteica' in b) data.reteica = !!b.reteica;
  if ('reteicaPeriodicidad' in b) data.reteicaPeriodicidad = opt(b.reteicaPeriodicidad, ICA_PERIOD_OPTS);
  if ('autoica' in b) data.autoica = !!b.autoica;
  if ('autoicaPeriodicidad' in b) data.autoicaPeriodicidad = opt(b.autoicaPeriodicidad, ICA_PERIOD_OPTS);
  if ('fechaInscripcion' in b) data.fechaInscripcion = optFecha(b.fechaInscripcion);
  const r = await prisma.empresaMunicipioIca.updateMany({ where: { id: req.params.icaId, empresaId: req.params.empresaId, organizacionId: id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Registro ICA no encontrado.' });
  res.json({ ok: true });
});

// Quitar un municipio ICA.
adminRouter.delete('/config-tributaria/:empresaId/ica/:icaId', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const r = await prisma.empresaMunicipioIca.deleteMany({ where: { id: req.params.icaId, empresaId: req.params.empresaId, organizacionId: id } });
  if (r.count === 0) return res.status(404).json({ error: 'Registro ICA no encontrado.' });
  res.json({ ok: true });
});

// Búsqueda de municipios (para el selector de ICA).
adminRouter.get('/municipios', requireAuth, async (req, res) => {
  const id = await orgId();
  if (!id) return res.json({ items: [] });
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const items = await prisma.municipio.findMany({
    where: { organizacionId: id, ...(q ? { nombre: { contains: q, mode: 'insensitive' } } : {}) },
    orderBy: { nombre: 'asc' }, take: 20,
    select: { id: true, nombre: true, departamento: true },
  });
  res.json({ items });
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
    select: { actividadPlanId: true, periodicidad: true, actividad: { select: { nombre: true, areaId: true, periodicidad: true, requiereAuditoria: true, generaPago: true, obligacionVencimiento: true } } },
  });
  const asign = await prisma.asignacionClienteArea.findMany({ where: { organizacionId: id, empresaId: empresa.id }, select: { areaId: true, asesorId: true, auxiliarId: true } });
  const asignPorArea = new Map(asign.map((a) => [a.areaId, { asesorId: a.asesorId, auxiliarId: a.auxiliarId }]));
  const existentes = await prisma.tarea.findMany({ where: { organizacionId: id, empresaId: empresa.id, periodo, actividadPlanId: { not: null } }, select: { actividadPlanId: true } });
  const yaExiste = new Set(existentes.map((t) => t.actividadPlanId));

  const nuevas = [];
  for (const p of planes) {
    if (!p.actividad) continue;
    if (p.actividad.obligacionVencimiento) continue; // se controla en Vencimientos, no se duplica como tarea
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

  // Limpia las tareas-duplicado ya generadas de este cliente cuya actividad está
  // vinculada a un vencimiento, pero SOLO las vacías (sin avance): estado
  // 'por_iniciar', auditoría 'pendiente', sin subtareas realizadas y sin
  // comprobantes/registros. Conserva las que tengan trabajo y las no vinculadas.
  let eliminadasDuplicadas = 0;
  const linkedActs = await prisma.actividadPlan.findMany({ where: { organizacionId: id, obligacionVencimiento: { not: null } }, select: { id: true } });
  const linkedIds = linkedActs.map((a) => a.id);
  if (linkedIds.length) {
    const dup = await prisma.tarea.findMany({
      where: { organizacionId: id, empresaId: empresa.id, actividadPlanId: { in: linkedIds } },
      select: { id: true, estado: true, auditoria: true, comprobanteDesde: true, comprobanteHasta: true, cantidadRegistros: true, subtareas: { select: { estado: true } } },
    });
    const vacias = dup.filter((t) => t.estado === 'por_iniciar' && t.auditoria === 'pendiente'
      && !t.subtareas.some((s) => s.estado === 'realizada') && !t.comprobanteDesde && !t.comprobanteHasta && t.cantidadRegistros == null);
    if (vacias.length) eliminadasDuplicadas = (await prisma.tarea.deleteMany({ where: { id: { in: vacias.map((t) => t.id) } } })).count;
  }

  res.json({ ok: true, periodo, creadas: r.count, yaExistian: existentes.length, eliminadasDuplicadas });
});

// ---------- Asignaciones cliente × área (asesor responsable / auxiliar ejecutor / talla) ----------
// De aquí heredan el responsable las tareas del plan y los vencimientos vinculados.

// GET /admin/asignaciones/:empresaId — todas las áreas con su asignación actual.
adminRouter.get('/asignaciones/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true, nombre: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const [areas, asign] = await Promise.all([
    prisma.area.findMany({ where: { organizacionId: id }, orderBy: { orden: 'asc' }, select: { id: true, nombre: true } }),
    prisma.asignacionClienteArea.findMany({ where: { organizacionId: id, empresaId: empresa.id }, select: { areaId: true, asesorId: true, auxiliarId: true, talla: true, insumoCliente: true } }),
  ]);
  const byArea = new Map(asign.map((a) => [a.areaId, a]));
  res.json({
    empresa,
    areas: areas.map((ar) => {
      const a = byArea.get(ar.id);
      return { areaId: ar.id, area: ar.nombre, asesorId: a?.asesorId ?? null, auxiliarId: a?.auxiliarId ?? null, talla: a?.talla ?? null, insumoCliente: !!a?.insumoCliente };
    }),
  });
});

// PUT /admin/asignaciones/:empresaId  { asignaciones: [{ areaId, asesorId|null, auxiliarId|null, talla|null }] }
adminRouter.put('/asignaciones/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const items: any[] = Array.isArray(req.body?.asignaciones) ? req.body.asignaciones : [];
  const [areas, users] = await Promise.all([
    prisma.area.findMany({ where: { organizacionId: id }, select: { id: true } }),
    prisma.usuario.findMany({ where: { organizacionId: id }, select: { id: true } }),
  ]);
  const areaOk = new Set(areas.map((a) => a.id));
  const userOk = new Set(users.map((u) => u.id));

  await prisma.$transaction(async (tx) => {
    for (const it of items) {
      const areaId = String(it?.areaId ?? '');
      if (!areaOk.has(areaId)) continue;
      const asesorId = it?.asesorId && userOk.has(String(it.asesorId)) ? String(it.asesorId) : null;
      const auxiliarId = it?.auxiliarId && userOk.has(String(it.auxiliarId)) ? String(it.auxiliarId) : null;
      const talla = typeof it?.talla === 'string' && it.talla.trim() ? it.talla.trim() : null;
      const insumoCliente = !!it?.insumoCliente;
      await tx.asignacionClienteArea.upsert({
        where: { empresaId_areaId: { empresaId: empresa.id, areaId } },
        create: { organizacionId: id, empresaId: empresa.id, areaId, asesorId, auxiliarId, talla, insumoCliente },
        update: { asesorId, auxiliarId, talla, insumoCliente },
      });
    }
  });
  res.json({ ok: true });
});

// ---------- Entregas de insumo (F1.2): liberar el insumo por cliente/período ----------
// Modelo híbrido: entrega general (areaId null) o por área. Habilita el procesamiento.

// GET /admin/entregas/:empresaId?periodo=YYYY-MM — estado de entregas del período.
adminRouter.get('/entregas/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo) ? req.query.periodo : null;
  if (!periodo) return res.status(422).json({ error: 'Período inválido (YYYY-MM).' });

  const [areas, entregas] = await Promise.all([
    prisma.area.findMany({ where: { organizacionId: id }, orderBy: { orden: 'asc' }, select: { id: true, nombre: true } }),
    prisma.entregaInsumo.findMany({ where: { organizacionId: id, empresaId: empresa.id, periodo }, select: { areaId: true, entregadoEn: true, origen: true, entregadoPor: { select: { nombre: true } } } }),
  ]);
  const byArea = new Map(entregas.map((e) => [e.areaId ?? '__general__', e]));
  const fmt = (e: any) => e ? { entregado: true, en: e.entregadoEn, origen: e.origen, por: e.entregadoPor?.nombre ?? null } : { entregado: false };
  res.json({
    periodo,
    general: fmt(byArea.get('__general__')),
    areas: areas.map((ar) => ({ areaId: ar.id, area: ar.nombre, ...fmt(byArea.get(ar.id)) })),
  });
});

// POST /admin/entregas/:empresaId { periodo, areaId|null } — libera (idempotente).
adminRouter.post('/entregas/:empresaId', requireAuth, soloCoordinacion, async (req: any, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const periodo = typeof req.body?.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.body.periodo) ? req.body.periodo : null;
  if (!periodo) return res.status(422).json({ error: 'Período inválido (YYYY-MM).' });
  const areaId = req.body?.areaId ? String(req.body.areaId) : null;
  if (areaId) {
    const ok = await prisma.area.findFirst({ where: { id: areaId, organizacionId: id }, select: { id: true } });
    if (!ok) return res.status(422).json({ error: 'Área inválida.' });
  }
  const existe = await prisma.entregaInsumo.findFirst({ where: { empresaId: empresa.id, periodo, areaId } });
  if (!existe) {
    await prisma.entregaInsumo.create({
      data: { organizacionId: id, empresaId: empresa.id, periodo, areaId, origen: 'manual', entregadoPorId: req.user?.sub ?? null },
    });
  }
  res.json({ ok: true });
});

// DELETE /admin/entregas/:empresaId { periodo, areaId|null } — revierte la entrega.
adminRouter.delete('/entregas/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId();
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const periodo = typeof req.body?.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.body.periodo) ? req.body.periodo : null;
  if (!periodo) return res.status(422).json({ error: 'Período inválido (YYYY-MM).' });
  const areaId = req.body?.areaId ? String(req.body.areaId) : null;
  await prisma.entregaInsumo.deleteMany({ where: { organizacionId: id, empresaId: empresa.id, periodo, areaId } });
  res.json({ ok: true });
});
