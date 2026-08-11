// apps/api/src/routes/admin.ts
//
// Panel de Administración: parámetros de liquidación y catálogos base
// (áreas, tipos de tarea, tipos de obligación, periodicidades, etiquetas).
// Lectura: cualquier usuario autenticado (para poblar selects). Escritura:
// solo Administrador o root.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRol, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';
import { hashPassword } from '../auth/password.js';
import { responderError } from '../errores.js';
import { nthDiaHabil } from '../vencimientos/generador.js';
import { aplicaEnMesPlan } from '../plan/periodicidad.js';

export const adminRouter = Router();

const soloAdmin = requireRol('Administrador');
const soloCoordinacion = requireRol('Administrador', 'Coordinador');
const PASSWORD_TEMPORAL_DEFECTO = 'Cerpat2026*';

// Identificador de la organización de la sesión (ver auth/tenant.ts).
async function orgId(req: AuthedRequest): Promise<string | null> {
  const org = await orgDeSesion(req);
  return org?.id ?? null;
}

// ---------- Parámetros de liquidación (una fila por organización) ----------

const CAMPOS_PARAM = ['tasaMoraMensual', 'valorUvt', 'smmlv', 'sancionMinimaUvt', 'pctSancionExtemporaneidad'] as const;

adminRouter.get('/parametros', requireAuth, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
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
  const id = await orgId(req);
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
  // El tipo de empresa decide la naturaleza jurídica, y de ahí salen reglas
  // reales (el RUB, el revisor fiscal, el 368-2). Estaba en la base pero sin
  // pantalla: los clientes sin tipo no se podían arreglar desde la aplicación.
  'tipos-empresa': { delegate: prisma.tipoEmpresa, conOrden: true },
  regimenes: { delegate: prisma.regimenTributario, conOrden: true },
};

adminRouter.get('/catalogos/:tipo', requireAuth, async (req, res) => {
  const cfg = CATALOGOS[req.params.tipo];
  if (!cfg) return res.status(404).json({ error: 'Catálogo desconocido.' });
  const id = await orgId(req);
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
  const id = await orgId(req);
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
  const id = await orgId(req);
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
  const id = await orgId(req);
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

const BOOL_ACT = ['esRegistroSoftware', 'requiereAuditoria', 'generaPago', 'activo', 'esCapturaDocumentos'] as const;
const TEXTO_ACT = ['grupo', 'descripcion', 'documentoFormato', 'periodicidad', 'obligacionVencimiento'] as const;

function datosActividad(body: any, esCreacion: boolean): Record<string, any> {
  const data: Record<string, any> = {};
  if (typeof body?.codigo === 'string' && body.codigo.trim()) data.codigo = body.codigo.trim();
  if (typeof body?.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim();
  if ('areaId' in (body ?? {})) data.areaId = body.areaId || null;
  for (const c of TEXTO_ACT) if (c in (body ?? {})) data[c] = typeof body[c] === 'string' && body[c].trim() ? body[c].trim() : null;
  for (const b of BOOL_ACT) if (b in (body ?? {})) data[b] = !!body[b];
  if ('fase' in (body ?? {})) data.fase = ['captura', 'procesamiento', 'revision'].includes(body.fase) ? body.fase : null;
  // Día hábil de entrega: 1..23 (ningún mes tiene más hábiles). Vacío = sin
  // plazo propio, la tarea vence a fin de mes como antes.
  if ('diaHabilEntrega' in (body ?? {})) {
    const v = body.diaHabilEntrega;
    const n = v === '' || v == null ? null : Number(v);
    data.diaHabilEntrega = n != null && Number.isInteger(n) && n >= 1 && n <= 23 ? n : null;
  }
  if (body?.orden !== undefined && body.orden !== null && body.orden !== '') data.orden = Number(body.orden) || 0;
  if (esCreacion && data.orden === undefined) data.orden = 0;
  return data;
}

adminRouter.get('/actividades', requireAuth, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const items = await prisma.actividadPlan.findMany({
    where: { organizacionId: id },
    orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
    select: {
      id: true, codigo: true, nombre: true, grupo: true, periodicidad: true, orden: true, activo: true,
      esRegistroSoftware: true, requiereAuditoria: true, generaPago: true, diaHabilEntrega: true,
      area: { select: { id: true, nombre: true } },
      _count: { select: { subtareas: true, tareas: true } },
    },
  });
  res.json({ total: items.length, items: items.map((a) => ({ ...a, area: a.area?.nombre ?? null, areaId: a.area?.id ?? null, subtareas: a._count.subtareas, tareas: a._count.tareas, _count: undefined })) });
});

adminRouter.get('/actividades/:id', requireAuth, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const a = await prisma.actividadPlan.findFirst({
    where: { id: req.params.id, organizacionId: id },
    include: { subtareas: { orderBy: { orden: 'asc' }, select: { id: true, texto: true, orden: true } } },
  });
  if (!a) return res.status(404).json({ error: 'Actividad no encontrada.' });
  res.json({ actividad: a });
});

adminRouter.post('/actividades', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId(req);
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
  const id = await orgId(req);
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
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const conTareas = await prisma.tarea.count({ where: { organizacionId: id, actividadPlanId: req.params.id } });
  if (conTareas > 0) return res.status(409).json({ error: `No se puede eliminar: tiene ${conTareas} tarea(s) generadas. Puedes desactivarla en su lugar.` });
  const r = await prisma.actividadPlan.deleteMany({ where: { id: req.params.id, organizacionId: id } });
  if (r.count === 0) return res.status(404).json({ error: 'Actividad no encontrada.' });
  res.json({ ok: true });
});

// Subtareas plantilla de una actividad
async function actividadDeOrg(req: AuthedRequest, actId: string): Promise<boolean> {
  const id = await orgId(req);
  if (!id) return false;
  const a = await prisma.actividadPlan.findFirst({ where: { id: actId, organizacionId: id }, select: { id: true } });
  return !!a;
}

adminRouter.post('/actividades/:id/subtareas', requireAuth, soloAdmin, async (req, res) => {
  if (!(await actividadDeOrg(req, req.params.id))) return res.status(404).json({ error: 'Actividad no encontrada.' });
  const texto = String(req.body?.texto ?? '').trim();
  if (!texto) return res.status(422).json({ error: 'El texto de la subtarea es obligatorio.' });
  const s = await prisma.subtareaPlantilla.create({ data: { actividadPlanId: req.params.id, texto, orden: Number(req.body?.orden) || 0 }, select: { id: true, texto: true, orden: true } });
  res.status(201).json({ ok: true, subtarea: s });
});

adminRouter.patch('/actividades/:id/subtareas/:subId', requireAuth, soloAdmin, async (req, res) => {
  if (!(await actividadDeOrg(req, req.params.id))) return res.status(404).json({ error: 'Actividad no encontrada.' });
  const data: Record<string, any> = {};
  if (typeof req.body?.texto === 'string' && req.body.texto.trim()) data.texto = req.body.texto.trim();
  if (req.body?.orden !== undefined && req.body.orden !== null && req.body.orden !== '') data.orden = Number(req.body.orden) || 0;
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.subtareaPlantilla.updateMany({ where: { id: req.params.subId, actividadPlanId: req.params.id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Subtarea no encontrada.' });
  res.json({ ok: true });
});

adminRouter.delete('/actividades/:id/subtareas/:subId', requireAuth, soloAdmin, async (req, res) => {
  if (!(await actividadDeOrg(req, req.params.id))) return res.status(404).json({ error: 'Actividad no encontrada.' });
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
  const id = await orgId(req);
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
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { data, error } = datosVencimiento(req.body);
  if (error) return res.status(422).json({ error });
  if (!data!.fechaVencimiento) return res.status(422).json({ error: 'La fecha de vencimiento es obligatoria.' });
  const v = await prisma.vencimiento.create({ data: { organizacionId: id, ...data } as any, select: { id: true } });
  res.status(201).json({ ok: true, id: v.id });
});

adminRouter.patch('/vencimientos/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { data, error } = datosVencimiento(req.body);
  if (error) return res.status(422).json({ error });
  if (Object.keys(data!).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.vencimiento.updateMany({ where: { id: req.params.id, organizacionId: id }, data: data! });
  if (r.count === 0) return res.status(404).json({ error: 'Vencimiento no encontrado.' });
  res.json({ ok: true });
});

adminRouter.delete('/vencimientos/:id', requireAuth, soloAdmin, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const r = await prisma.vencimiento.deleteMany({ where: { id: req.params.id, organizacionId: id } });
  if (r.count === 0) return res.status(404).json({ error: 'Vencimiento no encontrado.' });
  res.json({ ok: true });
});

// ---------- Usuarios (crear/editar/roles/activar) ----------

adminRouter.get('/roles', requireAuth, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const roles = await prisma.rol.findMany({ where: { organizacionId: id }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } });
  res.json({ roles });
});

adminRouter.get('/usuarios', requireAuth, soloCoordinacion, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
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
  const id = await orgId(req);
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

// La coordinación puede repartir roles operativos (p. ej. marcar quién revisa
// impuestos) sin depender del Administrador. Lo que NO puede es tocar
// administradores ni volver administrador a nadie: eso sería darse a sí misma
// todos los permisos del sistema por la puerta de atrás.
adminRouter.patch('/usuarios/:id', requireAuth, soloCoordinacion, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = await prisma.usuario.findFirst({
    where: { id: req.params.id, organizacionId: id },
    select: { id: true, esRootPlataforma: true, roles: { select: { rol: { select: { nombre: true } } } } },
  });
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const actor = req.user!;
  const esAdmin = actor.esRoot || actor.roles.includes('Administrador');
  if (!esAdmin) {
    const camposDeAdmin = ['activo', 'empresaClienteId', 'grupoClienteId'].filter((c) => c in (req.body ?? {}));
    if (camposDeAdmin.length) return res.status(403).json({ error: 'Solo el Administrador puede cambiar esos datos del usuario.' });
    if (u.esRootPlataforma || u.roles.some((r) => r.rol.nombre === 'Administrador')) {
      return res.status(403).json({ error: 'Solo el Administrador puede editar a otro Administrador.' });
    }
  }

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
  // Los roles llegan por id, así que "no puede volver administrador a nadie" hay
  // que verificarlo contra la tabla: comparar nombres del cuerpo sería confiar
  // en lo que manda el navegador.
  if (cambiarRoles && !esAdmin) {
    const rolAdmin = await prisma.rol.findFirst({ where: { organizacionId: id, nombre: 'Administrador' }, select: { id: true } });
    if (rolAdmin && normalizaRolIds(req.body).includes(rolAdmin.id)) {
      return res.status(403).json({ error: 'Solo el Administrador puede otorgar el rol de Administrador.' });
    }
  }
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
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = await prisma.usuario.findFirst({ where: { id: req.params.id, organizacionId: id }, select: { id: true } });
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const temporal = String(req.body?.passwordTemporal ?? '').trim() || PASSWORD_TEMPORAL_DEFECTO;
  await prisma.usuario.update({ where: { id: u.id }, data: { passwordHash: hashPassword(temporal), debeCambiarPassword: true } });
  res.json({ ok: true, passwordTemporal: temporal });
});

adminRouter.delete('/usuarios/:id', requireAuth, soloAdmin, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
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
  // Catálogos: cadena vacía significa "sin asignar", no "no tocar".
  for (const c of ['grupoId', 'tipoId', 'regimenId'] as const) if (c in (body ?? {})) data[c] = body[c] || null;
  return data;
}

adminRouter.get('/empresas', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const incluirInactivos = req.query.incluirInactivos === '1' || req.query.incluirInactivos === 'true';
  const items = await prisma.empresa.findMany({
    where: { organizacionId: id, ...(incluirInactivos ? {} : { activo: true }) },
    orderBy: { nombre: 'asc' },
    select: {
      id: true, nombre: true, nit: true, servicio: true, asesorNombre: true, activo: true, grupoId: true,
      tipoId: true, regimenId: true,
      tipo: { select: { nombre: true } }, regimen: { select: { nombre: true } },
      emailRepresentante: true, emailAdministracion: true, emailContabilidad: true, emailTalentoHumano: true, emailTesoreria: true,
    },
  });
  // Almacenamiento (bytes y nº de documentos) por cliente, para mostrar el consumo.
  const almacen = await prisma.documentoCliente.groupBy({ by: ['empresaId'], where: { organizacionId: id }, _sum: { tamanoBytes: true }, _count: { _all: true } });
  const alMap = new Map(almacen.map((a) => [a.empresaId, { bytes: Number(a._sum.tamanoBytes ?? 0), docs: a._count._all }]));
  res.json({ total: items.length, items: items.map((e) => ({ ...e, almacenBytes: alMap.get(e.id)?.bytes ?? 0, almacenDocs: alMap.get(e.id)?.docs ?? 0 })) });
});

adminRouter.post('/empresas', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const data = datosEmpresa(req.body);
  if (!data.nombre) return res.status(422).json({ error: 'El nombre del cliente es obligatorio.' });
  const e = await prisma.empresa.create({ data: { organizacionId: id, activo: true, ...data } as any, select: { id: true } });
  res.status(201).json({ ok: true, id: e.id });
});

adminRouter.patch('/empresas/:id', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const data = datosEmpresa(req.body);
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.empresa.updateMany({ where: { id: req.params.id, organizacionId: id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
  res.json({ ok: true });
});

adminRouter.delete('/empresas/:id', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
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

// ---------- Documentos del cliente (actas, informes, soportes) ----------
// Se guardan en Postgres (contenido binario) con su tamaño, para medir el
// almacenamiento por cliente. Subida en base64. Solo Administrador / Coordinación.

const TIPOS_DOC = ['acta', 'informe', 'soporte', 'otro'] as const;
const MAX_DOC_BYTES = 20 * 1024 * 1024; // 20 MB por archivo

// GET /admin/empresas/:empresaId/documentos — lista (sin binario) + resumen de uso.
adminRouter.get('/empresas/:empresaId/documentos', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const docs = await prisma.documentoCliente.findMany({
    where: { empresaId: empresa.id }, orderBy: [{ createdAt: 'desc' }],
    select: { id: true, tipo: true, nombre: true, mime: true, tamanoBytes: true, createdAt: true },
  });
  const totalBytes = docs.reduce((s, d) => s + d.tamanoBytes, 0);
  const porTipo: Record<string, number> = {};
  for (const d of docs) porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + d.tamanoBytes;
  res.json({ total: docs.length, totalBytes, porTipo, documentos: docs });
});

// POST /admin/empresas/:empresaId/documentos { tipo, nombre, mime, contenidoBase64 }
adminRouter.post('/empresas/:empresaId/documentos', requireAuth, soloCoordinacion, async (req: any, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const b = req.body ?? {};
  const tipo = TIPOS_DOC.includes(b.tipo) ? b.tipo : 'otro';
  const nombre = typeof b.nombre === 'string' ? b.nombre.trim() : '';
  if (!nombre) return res.status(422).json({ error: 'Falta el nombre del archivo.' });
  const mime = typeof b.mime === 'string' && b.mime.trim() ? b.mime.trim() : 'application/octet-stream';
  const base64 = typeof b.contenidoBase64 === 'string' ? b.contenidoBase64.replace(/^data:[^;]+;base64,/, '') : '';
  if (!base64) return res.status(422).json({ error: 'El archivo está vacío.' });
  let buf: Buffer;
  try { buf = Buffer.from(base64, 'base64'); } catch { return res.status(422).json({ error: 'Archivo inválido.' }); }
  if (buf.length === 0) return res.status(422).json({ error: 'El archivo está vacío.' });
  if (buf.length > MAX_DOC_BYTES) return res.status(413).json({ error: `El archivo supera el máximo de ${Math.round(MAX_DOC_BYTES / 1024 / 1024)} MB.` });

  const doc = await prisma.documentoCliente.create({
    data: { organizacionId: id, empresaId: empresa.id, tipo: tipo as any, nombre, mime, tamanoBytes: buf.length, contenido: buf, subidoPorId: req.user?.sub ?? null },
    select: { id: true, tamanoBytes: true },
  });
  res.status(201).json({ ok: true, id: doc.id, tamanoBytes: doc.tamanoBytes });
});

// GET /admin/documentos/:id — descarga (devuelve el archivo en base64).
adminRouter.get('/documentos/:id', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  const doc = await prisma.documentoCliente.findFirst({ where: { id: req.params.id, organizacionId: id ?? undefined }, select: { nombre: true, mime: true, tamanoBytes: true, contenido: true } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
  res.json({ nombre: doc.nombre, mime: doc.mime, tamanoBytes: doc.tamanoBytes, contenidoBase64: Buffer.from(doc.contenido).toString('base64') });
});

// DELETE /admin/documentos/:id — elimina un documento del cliente.
adminRouter.delete('/documentos/:id', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  const r = await prisma.documentoCliente.deleteMany({ where: { id: req.params.id, organizacionId: id ?? undefined } });
  if (r.count === 0) return res.status(404).json({ error: 'Documento no encontrado.' });
  res.json({ ok: true });
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
  const id = await orgId(req);
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
adminRouter.put('/config-tributaria/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
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
adminRouter.post('/config-tributaria/:empresaId/ica', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
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
adminRouter.patch('/config-tributaria/:empresaId/ica/:icaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
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
adminRouter.delete('/config-tributaria/:empresaId/ica/:icaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const r = await prisma.empresaMunicipioIca.deleteMany({ where: { id: req.params.icaId, empresaId: req.params.empresaId, organizacionId: id } });
  if (r.count === 0) return res.status(404).json({ error: 'Registro ICA no encontrado.' });
  res.json({ ok: true });
});

// Búsqueda de municipios (para el selector de ICA).
adminRouter.get('/municipios', requireAuth, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.json({ items: [] });
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const items = await prisma.municipio.findMany({
    where: { organizacionId: id, ...(q ? { nombre: { contains: q, mode: 'insensitive' } } : {}) },
    orderBy: { nombre: 'asc' }, take: 20,
    select: { id: true, nombre: true, departamento: true },
  });
  res.json({ items });
});

// GET /admin/municipios/sanciones — municipios con su sanción mínima propia (UVT).
adminRouter.get('/municipios/sanciones', requireAuth, soloCoordinacion, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
  if (!id) return res.json({ municipios: [] });
  const items = await prisma.municipio.findMany({
    where: { organizacionId: id }, orderBy: [{ nombre: 'asc' }],
    select: { id: true, nombre: true, departamento: true, sancionMinimaUvt: true },
  });
  res.json({ municipios: items.map((m) => ({ id: m.id, nombre: m.nombre, departamento: m.departamento, sancionMinimaUvt: m.sancionMinimaUvt != null ? Number(m.sancionMinimaUvt) : null })) });
});

// PATCH /admin/municipios/:id { sancionMinimaUvt } — fija/limpia la sanción mínima
// propia del municipio (en UVT). Enviar null o vacío la deja en "usa la general".
adminRouter.patch('/municipios/:id', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const raw = req.body?.sancionMinimaUvt;
  let val: number | null = null;
  if (raw !== null && raw !== '' && raw !== undefined) {
    const n = Number(raw);
    if (!isFinite(n) || n < 0) return res.status(422).json({ error: 'La sanción mínima debe ser un número ≥ 0 (en UVT).' });
    val = n;
  }
  const r = await prisma.municipio.updateMany({ where: { id: req.params.id, organizacionId: id }, data: { sancionMinimaUvt: val } });
  if (r.count === 0) return res.status(404).json({ error: 'Municipio no encontrado.' });
  res.json({ ok: true, sancionMinimaUvt: val });
});

// ---------- Plan de trabajo por cliente (PlanClienteActividad) ----------

// GET /admin/plan-cliente/:empresaId — catálogo de actividades por área con el
// estado del plan del cliente (marcadas/periodicidad propia).
adminRouter.get('/plan-cliente/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
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
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const activas: string[] = Array.isArray(req.body?.activas) ? req.body.activas.map((x: any) => String(x)) : [];
  const periods: Record<string, string> = (req.body?.periodicidades && typeof req.body.periodicidades === 'object') ? req.body.periodicidades : {};
  const activasSet = new Set(activas);
  const activasIds = [...activasSet];

  // Antes esto hacía un `upsert` por actividad: con un plan de 36 actividades son
  // 37 idas y vueltas dentro de una transacción interactiva, que por defecto se
  // cancela a los 5 segundos. Ahora se agrupa: una consulta para saber cuáles ya
  // existen, un `updateMany` por periodicidad distinta (son pocas) y un
  // `createMany` para las nuevas — del orden de 8 consultas en vez de 37.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.planClienteActividad.updateMany({
        where: { organizacionId: id, empresaId: empresa.id, actividadPlanId: { notIn: activasIds.length ? activasIds : ['-'] } },
        data: { activa: false },
      });
      if (activasIds.length === 0) return;

      const existentes = await tx.planClienteActividad.findMany({
        where: { empresaId: empresa.id, actividadPlanId: { in: activasIds } },
        select: { actividadPlanId: true },
      });
      const yaEstan = new Set(existentes.map((x) => x.actividadPlanId));

      // Las que ya existen: se agrupan por periodicidad para actualizarlas en bloque.
      const porPeriodicidad = new Map<string, string[]>();
      for (const actividadPlanId of activasIds) {
        if (!yaEstan.has(actividadPlanId)) continue;
        const clave = periods[actividadPlanId] || '';
        const lista = porPeriodicidad.get(clave) ?? [];
        lista.push(actividadPlanId);
        porPeriodicidad.set(clave, lista);
      }
      for (const [clave, ids] of porPeriodicidad) {
        await tx.planClienteActividad.updateMany({
          where: { empresaId: empresa.id, actividadPlanId: { in: ids } },
          data: { activa: true, periodicidad: clave || null },
        });
      }

      const nuevas = activasIds.filter((x) => !yaEstan.has(x));
      if (nuevas.length > 0) {
        await tx.planClienteActividad.createMany({
          data: nuevas.map((actividadPlanId) => ({
            organizacionId: id, empresaId: empresa.id, actividadPlanId,
            activa: true, periodicidad: periods[actividadPlanId] || null,
          })),
          skipDuplicates: true,
        });
      }
    }, { timeout: 20000, maxWait: 10000 });
  } catch (e) {
    // Sin esto el error salía como 500 sin cuerpo, el proxy lo volvía `{}` y la
    // pantalla mostraba "No se pudo guardar el plan" — sin decir por qué.
    return responderError(res, 'plan-cliente:guardar', e, 'No se pudo guardar el plan.');
  }
  res.json({ ok: true, activas: activasSet.size });
});


// POST /admin/plan-cliente/recalcular-fechas { periodo, dryRun }
//
// Aplica el día hábil del catálogo a las tareas YA generadas de un período.
// Hace falta porque cambiar el catálogo no toca lo que ya existe, y "Generar"
// tampoco: solo crea lo que falta. Sin esto, el día hábil solo valdría a partir
// del mes siguiente.
//
// No toca las terminadas ni las auditadas: su fecha de vencimiento es parte de
// lo que ya pasó, y reescribirla falsearía cualquier medición posterior de
// cumplimiento.
adminRouter.post('/plan-cliente/recalcular-fechas', requireAuth, soloCoordinacion, async (req: any, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const periodo = typeof req.body?.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.body.periodo) ? req.body.periodo : null;
  if (!periodo) return res.status(422).json({ error: 'Período inválido (YYYY-MM).' });
  const dryRun = req.body?.dryRun === true;
  const [anio, mes] = periodo.split('-').map(Number);

  try {
    const tareas = await prisma.tarea.findMany({
      where: {
        organizacionId: id, periodo,
        actividadPlanId: { not: null },
        estado: { notIn: ['terminado', 'auditado'] },
        actividadPlan: { diaHabilEntrega: { not: null } },
      },
      select: {
        id: true, fechaVencimiento: true,
        actividadPlan: { select: { nombre: true, diaHabilEntrega: true } },
      },
    });

    // La fecha depende solo de la actividad, no del cliente: se calcula una vez
    // por día hábil y se reutiliza para las cientos de tareas que la comparten.
    const fechaPorDia = new Map<number, Date>();
    const porFecha = new Map<string, string[]>();
    const ejemplos = new Map<string, string>();
    for (const t of tareas) {
      const dia = t.actividadPlan?.diaHabilEntrega;
      if (!dia) continue;
      let nueva = fechaPorDia.get(dia);
      if (!nueva) { nueva = nthDiaHabil(anio, mes, dia); fechaPorDia.set(dia, nueva); }
      if (t.fechaVencimiento && t.fechaVencimiento.getTime() === nueva.getTime()) continue; // ya está bien
      const clave = nueva.toISOString();
      const lista = porFecha.get(clave) ?? [];
      lista.push(t.id);
      porFecha.set(clave, lista);
      const nombre = t.actividadPlan?.nombre ?? '';
      if (nombre && !ejemplos.has(nombre)) {
        ejemplos.set(nombre, `${nombre} → día hábil ${dia} (${nueva.toISOString().slice(0, 10)})`);
      }
    }

    const total = [...porFecha.values()].reduce((a, l) => a + l.length, 0);
    if (dryRun) {
      return res.json({ periodo, afectadas: total, revisadas: tareas.length, ejemplos: [...ejemplos.values()].slice(0, 30) });
    }
    for (const [iso, ids] of porFecha) {
      await prisma.tarea.updateMany({ where: { id: { in: ids } }, data: { fechaVencimiento: new Date(iso) } });
    }
    res.json({ periodo, afectadas: total, revisadas: tareas.length });
  } catch (e) {
    responderError(res, 'plan-cliente:recalcular-fechas', e, 'No se pudieron recalcular las fechas.');
  }
});

// POST /admin/plan-cliente/generar-masivo { periodo, dryRun }
//
// Genera el período completo para TODOS los clientes activos con plan, de una
// sola vez. Antes había que entrar cliente por cliente y darle "Generar": con
// ~90 clientes eso son ~90 vueltas a mano cada mes, y basta olvidar una para
// que a un asesor no le aparezca trabajo que sí tiene que hacer.
//
// Es la misma regla que la generación por cliente, aplicada en bloque. Y es
// igual de idempotente: lo ya generado no se duplica ni se toca, así que se
// puede correr las veces que haga falta — al agregar un cliente nuevo a mitad
// de mes, por ejemplo.
//
// Todo se resuelve con cinco consultas y el resto en memoria. Repetir la
// versión por cliente noventa veces serían miles de consultas y un tiempo de
// respuesta que Railway corta a la mitad.
//
// A diferencia de la generación por cliente, esta NO borra las tareas-duplicado
// heredadas de actividades ligadas a un vencimiento. Es a propósito: aquí nunca
// se crean, y un borrado masivo sobre toda la organización es un riesgo mayor
// que el problema que resolvería. Si a algún cliente le quedaron de antes, su
// "Generar" individual sigue limpiándolas.
adminRouter.post('/plan-cliente/generar-masivo', requireAuth, soloCoordinacion, async (req: any, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const periodo = typeof req.body?.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.body.periodo) ? req.body.periodo : null;
  if (!periodo) return res.status(422).json({ error: 'Período inválido (YYYY-MM).' });
  const dryRun = req.body?.dryRun === true;
  const [anio, mes] = periodo.split('-').map(Number);
  if (mes < 1 || mes > 12) return res.status(422).json({ error: 'Período inválido (el mes debe estar entre 01 y 12).' });
  const fechaInicio = new Date(Date.UTC(anio, mes - 1, 1));
  const finDeMes = new Date(Date.UTC(anio, mes, 0));

  try {
    const [empresas, planes, asign, existentes, areas] = await Promise.all([
      // Los inactivos quedan fuera: generarles tareas pondría trabajo fantasma
      // en el tablero de alguien por un cliente que la firma ya no atiende.
      prisma.empresa.findMany({ where: { organizacionId: id, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.planClienteActividad.findMany({
        where: { organizacionId: id, activa: true },
        select: {
          empresaId: true, actividadPlanId: true, periodicidad: true,
          actividad: { select: { nombre: true, areaId: true, periodicidad: true, requiereAuditoria: true, generaPago: true, obligacionVencimiento: true, diaHabilEntrega: true } },
        },
      }),
      prisma.asignacionClienteArea.findMany({ where: { organizacionId: id }, select: { empresaId: true, areaId: true, asesorId: true, auxiliarId: true } }),
      prisma.tarea.findMany({ where: { organizacionId: id, periodo, actividadPlanId: { not: null } }, select: { empresaId: true, actividadPlanId: true } }),
      prisma.area.findMany({ where: { organizacionId: id }, select: { id: true, nombre: true } }),
    ]);

    const activas = new Set(empresas.map((e) => e.id));
    const nombreEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));
    const nombreArea = new Map(areas.map((a) => [a.id, a.nombre]));
    const asignPorClienteArea = new Map(asign.map((a) => [`${a.empresaId}|${a.areaId}`, a]));
    const yaExiste = new Set(existentes.map((t) => `${t.empresaId}|${t.actividadPlanId}`));

    // La fecha depende solo del día hábil, no del cliente: se calcula una vez
    // por día y la comparten las cientos de tareas que caen en el mismo plazo.
    const fechaPorDia = new Map<number, Date>();
    const venceDe = (dia: number | null | undefined) => {
      if (!dia) return finDeMes;
      let d = fechaPorDia.get(dia);
      if (!d) { d = nthDiaHabil(anio, mes, dia); fechaPorDia.set(dia, d); }
      return d;
    };

    const nuevas: any[] = [];
    const porCliente = new Map<string, number>();
    const porArea = new Map<string, number>();
    const conPlan = new Set<string>();

    for (const p of planes) {
      if (!p.actividad) continue;
      if (!activas.has(p.empresaId)) continue;
      conPlan.add(p.empresaId);
      if (p.actividad.obligacionVencimiento) continue; // se controla en Vencimientos, no se duplica como tarea
      if (!aplicaEnMesPlan(p.periodicidad || p.actividad.periodicidad, mes)) continue;
      if (yaExiste.has(`${p.empresaId}|${p.actividadPlanId}`)) continue;

      const a = p.actividad.areaId ? asignPorClienteArea.get(`${p.empresaId}|${p.actividad.areaId}`) : undefined;
      nuevas.push({
        organizacionId: id, titulo: p.actividad.nombre, empresaId: p.empresaId,
        fechaInicio, fechaVencimiento: venceDe(p.actividad.diaHabilEntrega),
        actividadPlanId: p.actividadPlanId, areaId: p.actividad.areaId, generaPago: p.actividad.generaPago,
        requiereRevisionTecnica: p.actividad.requiereAuditoria, periodo,
        asesorId: a?.asesorId ?? null, auxiliarId: a?.auxiliarId ?? null,
      });
      const cli = nombreEmpresa.get(p.empresaId) ?? p.empresaId;
      porCliente.set(cli, (porCliente.get(cli) ?? 0) + 1);
      const ar = p.actividad.areaId ? (nombreArea.get(p.actividad.areaId) ?? 'Sin área') : 'Sin área';
      porArea.set(ar, (porArea.get(ar) ?? 0) + 1);
    }

    // Un cliente activo sin plan no genera nada y nadie se entera. Se nombran
    // para que la coordinación sepa a quién le falta configurar el plan.
    const sinPlan = empresas.filter((e) => !conPlan.has(e.id)).map((e) => e.nombre);
    const resumen = {
      periodo,
      porCrear: nuevas.length,
      clientesActivos: empresas.length,
      clientesConPlan: conPlan.size,
      clientesAfectados: porCliente.size,
      yaExistian: existentes.length,
      sinPlan: sinPlan.slice(0, 50),
      sinPlanTotal: sinPlan.length,
      porArea: [...porArea.entries()].map(([area, n]) => ({ area, n })).sort((x, y) => y.n - x.n),
    };
    if (dryRun) return res.json({ ...resumen, dryRun: true });

    // Por lotes y FUERA de una transacción: una transacción con miles de filas
    // se pasa del tiempo límite y no deja nada. Como la operación es
    // idempotente, si un lote falla se vuelve a correr y termina el trabajo,
    // que es preferible a perderlo todo por el último lote.
    //
    // Lo que evita duplicar es el conjunto `yaExiste`, no la base: no hay un
    // índice único sobre (empresa, actividad, período). Alcanza porque quien
    // genera es una sola persona y el botón se bloquea mientras trabaja, pero
    // dos pestañas a la vez sí podrían duplicar. Poner el índice es la solución
    // de fondo y hay que hacerlo revisando antes si los datos actuales lo
    // admiten: una migración de índice único que falle deja la API abajo.
    let creadas = 0;
    for (let i = 0; i < nuevas.length; i += 500) {
      const r = await prisma.tarea.createMany({ data: nuevas.slice(i, i + 500) });
      creadas += r.count;
    }
    res.json({ ...resumen, creadas });
  } catch (e) {
    responderError(res, 'plan-cliente:generar-masivo', e, 'No se pudo generar el período.');
  }
});

// POST /admin/plan-cliente/:empresaId/generar?periodo=YYYY-MM — genera las tareas
// del cliente para ese período según su plan activo (idempotente).
adminRouter.post('/plan-cliente/:empresaId/generar', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
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
    select: { actividadPlanId: true, periodicidad: true, actividad: { select: { nombre: true, areaId: true, periodicidad: true, requiereAuditoria: true, generaPago: true, obligacionVencimiento: true, diaHabilEntrega: true } } },
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
    // El plazo sale del día hábil del catálogo; sin él, fin de mes como antes.
    const vence = p.actividad.diaHabilEntrega ? nthDiaHabil(year, month, p.actividad.diaHabilEntrega) : fechaVencimiento;
    nuevas.push({
      organizacionId: id, titulo: p.actividad.nombre, empresaId: empresa.id, fechaInicio, fechaVencimiento: vence,
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

// GET /admin/asignaciones/revision — asignaciones con el responsable mal puesto.
//
// De la asignación cliente×área heredan asesor y auxiliar TODAS las tareas y los
// vencimientos. Un auxiliar puesto en la casilla de asesor no se nota al
// guardarlo: se nota semanas después, cuando a esa persona le aparece en su lista
// trabajo de procesamiento que no le toca — y para entonces hay que buscarlo a
// mano entre noventa clientes por varias áreas cada uno.
//
// Solo se reportan los casos inequívocos, para que la lista sirva y no se ignore
// por ruidosa.
const ROLES_ASESOR = ['Asesor', 'Coordinador', 'Administrador'];
const ROLES_EJECUTOR = ['Auxiliar', ...ROLES_ASESOR];

adminRouter.get('/asignaciones/revision', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });

  const [asigs, usuarios] = await Promise.all([
    prisma.asignacionClienteArea.findMany({
      where: { organizacionId: id, empresa: { activo: true }, OR: [{ asesorId: { not: null } }, { auxiliarId: { not: null } }] },
      select: {
        empresaId: true, areaId: true, asesorId: true, auxiliarId: true,
        empresa: { select: { nombre: true } }, area: { select: { nombre: true } },
      },
    }),
    prisma.usuario.findMany({
      where: { organizacionId: id },
      select: { id: true, nombre: true, esRootPlataforma: true, roles: { select: { rol: { select: { nombre: true } } } } },
    }),
  ]);
  const porId = new Map(usuarios.map((u) => [u.id, { nombre: u.nombre, esRoot: u.esRootPlataforma, roles: u.roles.map((r) => r.rol.nombre) }]));
  const tiene = (uid: string, roles: string[]) => {
    const u = porId.get(uid);
    return !u || u.esRoot || u.roles.some((r) => roles.includes(r));
  };

  const casos: any[] = [];
  for (const a of asigs) {
    const base = { empresa: a.empresa?.nombre ?? '—', area: a.area?.nombre ?? '—', empresaId: a.empresaId, areaId: a.areaId };
    if (a.asesorId && !tiene(a.asesorId, ROLES_ASESOR)) {
      const u = porId.get(a.asesorId);
      casos.push({ ...base, campo: 'asesor', persona: u?.nombre ?? '(usuario eliminado)', roles: u?.roles ?? [],
        motivo: 'Está puesto como ASESOR y no tiene el rol Asesor. Todo el procesamiento de esta área le va a aparecer como suyo.' });
    }
    if (a.auxiliarId && !tiene(a.auxiliarId, ROLES_EJECUTOR)) {
      const u = porId.get(a.auxiliarId);
      casos.push({ ...base, campo: 'auxiliar', persona: u?.nombre ?? '(usuario eliminado)', roles: u?.roles ?? [],
        motivo: 'Está puesto como AUXILIAR y no tiene un rol que ejecute trabajo.' });
    }
    // La misma persona en las dos casillas rompe el circuito de captura y
    // liberación: se estaría liberando el insumo a sí misma.
    if (a.asesorId && a.asesorId === a.auxiliarId) {
      const u = porId.get(a.asesorId);
      casos.push({ ...base, campo: 'ambos', persona: u?.nombre ?? '—', roles: u?.roles ?? [],
        motivo: 'Es asesor Y auxiliar de la misma área: se liberaría el insumo a sí misma.' });
    }
  }
  casos.sort((x, y) => x.empresa.localeCompare(y.empresa, 'es'));
  res.json({ total: casos.length, casos });
});

// GET /admin/asignaciones/:empresaId — todas las áreas con su asignación actual.
adminRouter.get('/asignaciones/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
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
  const id = await orgId(req);
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

// POST /admin/asignaciones/importar  { dryRun, filas: [{ cliente, area, asesor, auxiliar, talla, insumo }] }
// Carga masiva de asignaciones desde el Excel "Planes por cliente" (asesor/auxiliar/
// talla por Cliente × Área). Empareja por nombre (cliente, área, usuario). Con
// dryRun devuelve la previsualización sin escribir. Idempotente (upsert por área).
adminRouter.post('/asignaciones/importar', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const dryRun = !!req.body?.dryRun;
  const filas: any[] = Array.isArray(req.body?.filas) ? req.body.filas : [];
  if (!filas.length) return res.status(400).json({ error: 'No hay filas para importar.' });

  const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const [empresas, areas, usuarios] = await Promise.all([
    prisma.empresa.findMany({ where: { organizacionId: id }, select: { id: true, nombre: true } }),
    prisma.area.findMany({ where: { organizacionId: id }, select: { id: true, nombre: true } }),
    prisma.usuario.findMany({ where: { organizacionId: id }, select: { id: true, nombre: true } }),
  ]);
  // Mapa nombre→id; marca ambiguos (mismo nombre en dos registros) como 'DUP'.
  const mapa = (arr: { id: string; nombre: string }[]) => {
    const m = new Map<string, string>();
    for (const x of arr) { const k = norm(x.nombre); m.set(k, m.has(k) ? 'DUP' : x.id); }
    return m;
  };
  const empMap = mapa(empresas), areaMap = mapa(areas), userMap = mapa(usuarios);
  const TALLAS = new Set(['S', 'M', 'L', 'XL']);

  // Deduplica a Cliente × Área (el Excel repite la asignación por cada actividad).
  const grupos = new Map<string, { cliente: string; area: string; asesor: string; auxiliar: string; talla: string; insumo: string }>();
  for (const f of filas) {
    const cliente = String(f?.cliente ?? '').trim();
    const area = String(f?.area ?? '').trim();
    if (!cliente || !area) continue;
    const k = `${norm(cliente)}||${norm(area)}`;
    const prev = grupos.get(k) ?? { cliente, area, asesor: '', auxiliar: '', talla: '', insumo: '' };
    const nz = (a: string, b: unknown) => (String(b ?? '').trim() || a); // conserva no vacío
    grupos.set(k, { cliente, area, asesor: nz(prev.asesor, f?.asesor), auxiliar: nz(prev.auxiliar, f?.auxiliar), talla: nz(prev.talla, f?.talla), insumo: nz(prev.insumo, f?.insumo) });
  }

  const problemas: string[] = [];
  const preview: string[] = [];
  const aplicar: { empresaId: string; areaId: string; asesorId: string | null; auxiliarId: string | null; talla: string | null; insumoCliente: boolean }[] = [];

  for (const g of grupos.values()) {
    const empresaId = empMap.get(norm(g.cliente));
    if (!empresaId) { problemas.push(`Cliente no encontrado: "${g.cliente}"`); continue; }
    if (empresaId === 'DUP') { problemas.push(`Cliente duplicado (nombre ambiguo): "${g.cliente}"`); continue; }
    const areaId = areaMap.get(norm(g.area));
    if (!areaId || areaId === 'DUP') { problemas.push(`Área no encontrada: "${g.area}" (cliente ${g.cliente})`); continue; }

    const resolver = (nombre: string, rol: string): { id: string | null; ok: boolean } => {
      if (!nombre) return { id: null, ok: true }; // vacío = sin asignar
      const uid = userMap.get(norm(nombre));
      if (!uid || uid === 'DUP') { problemas.push(`${rol} no encontrado: "${nombre}" (${g.cliente} · ${g.area})`); return { id: null, ok: false }; }
      return { id: uid, ok: true };
    };
    const as = resolver(g.asesor, 'Asesor');
    const au = resolver(g.auxiliar, 'Auxiliar');
    if (!as.ok || !au.ok) continue; // no aplicar si un nombre indicado no coincide

    const talla = TALLAS.has(g.talla.toUpperCase()) ? g.talla.toUpperCase() : null;
    const insumoCliente = /^(s[ií]|si|x|1|true|verdadero)$/i.test(g.insumo.trim());
    aplicar.push({ empresaId, areaId, asesorId: as.id, auxiliarId: au.id, talla, insumoCliente });
    if (preview.length < 40) preview.push(`${g.cliente} · ${g.area} → asesor: ${g.asesor || '—'}, aux: ${g.auxiliar || '—'}${talla ? `, talla ${talla}` : ''}`);
  }

  if (dryRun) return res.json({ actualizar: aplicar.length, problemas, preview, totalFilas: grupos.size });

  await prisma.$transaction(async (tx) => {
    for (const a of aplicar) {
      await tx.asignacionClienteArea.upsert({
        where: { empresaId_areaId: { empresaId: a.empresaId, areaId: a.areaId } },
        create: { organizacionId: id, empresaId: a.empresaId, areaId: a.areaId, asesorId: a.asesorId, auxiliarId: a.auxiliarId, talla: a.talla, insumoCliente: a.insumoCliente },
        update: { asesorId: a.asesorId, auxiliarId: a.auxiliarId, talla: a.talla, insumoCliente: a.insumoCliente },
      });
    }
  });
  res.json({ ok: true, actualizadas: aplicar.length, problemas });
});

// POST /admin/asignaciones/sincronizar-tareas  { dryRun?, alcance? }
// Re-estampa el asesor/auxiliar de las TAREAS del plan YA generadas según la
// Asignación cliente×área ACTUAL. La generación estampa el responsable al crear la
// tarea y no se actualiza sola; tras cambiar asignaciones (import o a mano) hay que
// correr esto para que el nuevo responsable las vea. Alcance:
//   'actual'   → período actual y siguientes, sin auditadas (recomendado; conserva historia)
//   'abiertas' → todas las no auditadas de cualquier período
//   'todas'    → absolutamente todas (incluye auditadas) — p. ej. antes de iniciar operación
// Con dryRun solo cuenta lo que cambiaría. Solo Administrador / Coordinación / root.
adminRouter.post('/asignaciones/sincronizar-tareas', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const dryRun = req.body?.dryRun === true;
  const alcance = ['todas', 'abiertas', 'actual'].includes(req.body?.alcance) ? req.body.alcance : 'actual';

  const now = new Date();
  const periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const asigns = await prisma.asignacionClienteArea.findMany({ where: { organizacionId: id }, select: { empresaId: true, areaId: true, asesorId: true, auxiliarId: true } });
  const asigMap = new Map(asigns.map((a) => [`${a.empresaId}|${a.areaId}`, { asesorId: a.asesorId, auxiliarId: a.auxiliarId }]));

  const where: any = { organizacionId: id, actividadPlanId: { not: null }, areaId: { not: null } };
  if (alcance !== 'todas') where.auditoria = { not: 'aprobada' };
  if (alcance === 'actual') where.periodo = { gte: periodoActual };

  const tareas = await prisma.tarea.findMany({ where, select: { id: true, empresaId: true, areaId: true, asesorId: true, auxiliarId: true } });

  // Agrupa las tareas que cambian por (asesorId|auxiliarId) → pocas updateMany.
  const buckets = new Map<string, string[]>();
  let sinAsignacion = 0;
  for (const t of tareas) {
    const a = asigMap.get(`${t.empresaId}|${t.areaId}`);
    if (!a) { sinAsignacion++; continue; }
    if (t.asesorId === a.asesorId && t.auxiliarId === a.auxiliarId) continue;
    const k = `${a.asesorId ?? ''}|${a.auxiliarId ?? ''}`;
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(t.id);
  }
  const aCambiar = [...buckets.values()].reduce((n, ids) => n + ids.length, 0);

  if (dryRun) return res.json({ dryRun: true, alcance, revisadas: tareas.length, aCambiar, sinAsignacion });

  let actualizadas = 0;
  for (const [k, ids] of buckets) {
    const [as, au] = k.split('|');
    await prisma.tarea.updateMany({ where: { id: { in: ids } }, data: { asesorId: as || null, auxiliarId: au || null } });
    actualizadas += ids.length;
  }
  res.json({ ok: true, alcance, actualizadas, sinAsignacion });
});

// ---------- Entregas de insumo (F1.2): liberar el insumo por cliente/período ----------
// Modelo híbrido: entrega general (areaId null) o por área. Habilita el procesamiento.

// GET /admin/entregas/:empresaId?periodo=YYYY-MM — estado de entregas del período.
adminRouter.get('/entregas/:empresaId', requireAuth, soloCoordinacion, async (req, res) => {
  const id = await orgId(req);
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

// POST /admin/entregas/liberar-periodo { periodo, dryRun, revertir }
//
// Libera el insumo de TODOS los clientes activos de una vez, con una entrega
// GENERAL (sin área) y origen 'manual'.
//
// Existe por el desfase real del ciclo contable: el asesor trabaja en agosto
// sobre lo que se capturó en julio. El sistema, en cambio, exige la entrega del
// MISMO período, así que al arrancar un mes todo el procesamiento aparece
// bloqueado esperando una captura que no terminará hasta el mes siguiente. Sin
// esto, la salida era entrar cliente por cliente: 90 veces.
//
// 'manual' es deliberado: la auto-entrega nunca revierte lo manual, así que una
// captura reabierta no vuelve a bloquear al asesor que ya estaba trabajando.
adminRouter.post('/entregas/liberar-periodo', requireAuth, soloCoordinacion, async (req: any, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const periodo = typeof req.body?.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.body.periodo) ? req.body.periodo : null;
  if (!periodo) return res.status(422).json({ error: 'Período inválido (YYYY-MM).' });
  const dryRun = req.body?.dryRun === true;
  const revertir = req.body?.revertir === true;

  try {
    const empresas = await prisma.empresa.findMany({
      where: { organizacionId: id, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' },
    });
    // Solo las generales y manuales: una entrega por área, o una automática que
    // nació de una captura terminada, no son de este mecanismo y no se tocan.
    const yaLiberadas = await prisma.entregaInsumo.findMany({
      where: { organizacionId: id, periodo, areaId: null, origen: 'manual' },
      select: { empresaId: true },
    });
    const set = new Set(yaLiberadas.map((e) => e.empresaId));

    if (revertir) {
      const afectadas = empresas.filter((e) => set.has(e.id));
      if (dryRun) return res.json({ periodo, revertir: true, afectadas: afectadas.length, nombres: afectadas.slice(0, 40).map((e) => e.nombre), total: empresas.length });
      const r = await prisma.entregaInsumo.deleteMany({ where: { organizacionId: id, periodo, areaId: null, origen: 'manual' } });
      return res.json({ periodo, revertir: true, afectadas: r.count });
    }

    const faltantes = empresas.filter((e) => !set.has(e.id));
    if (dryRun) return res.json({ periodo, afectadas: faltantes.length, nombres: faltantes.slice(0, 40).map((e) => e.nombre), total: empresas.length, yaLiberadas: set.size });
    if (faltantes.length > 0) {
      await prisma.entregaInsumo.createMany({
        data: faltantes.map((e) => ({ organizacionId: id, empresaId: e.id, periodo, areaId: null, origen: 'manual', entregadoPorId: req.user?.sub ?? null })),
        skipDuplicates: true,
      });
    }
    res.json({ periodo, afectadas: faltantes.length, yaLiberadas: set.size, total: empresas.length });
  } catch (e) {
    responderError(res, 'entregas:liberar-periodo', e, 'No se pudo liberar el período.');
  }
});

// POST /admin/entregas/:empresaId { periodo, areaId|null } — libera (idempotente).
adminRouter.post('/entregas/:empresaId', requireAuth, soloCoordinacion, async (req: any, res) => {
  const id = await orgId(req);
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
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const periodo = typeof req.body?.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.body.periodo) ? req.body.periodo : null;
  if (!periodo) return res.status(422).json({ error: 'Período inválido (YYYY-MM).' });
  const areaId = req.body?.areaId ? String(req.body.areaId) : null;
  await prisma.entregaInsumo.deleteMany({ where: { organizacionId: id, empresaId: empresa.id, periodo, areaId } });
  res.json({ ok: true });
});

// ---------- Parámetros por año (UVT y SMMLV) ----------
//
// Los topes de las normas se expresan en UVT o SMMLV y se comparan contra el
// "año inmediatamente anterior". Con un solo valor vigente, en enero todos esos
// cálculos quedarían mal sin que nadie se entere: por eso van por año, y las
// reglas se niegan a calcular mientras falte el año que necesitan.

adminRouter.get('/parametros-anuales', requireAuth, soloCoordinacion, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
  if (!id) return res.json({ anios: [] });
  const anios = await prisma.parametroAnual.findMany({ where: { organizacionId: id }, orderBy: { anio: 'desc' } });
  res.json({ anios });
});

adminRouter.put('/parametros-anuales/:anio', requireAuth, soloAdmin, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const anio = Number(req.params.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return res.status(422).json({ error: 'Año inválido.' });
  const uvt = Number(String(req.body?.uvt ?? '').replace(/[^\d.]/g, ''));
  const smmlv = Number(String(req.body?.smmlv ?? '').replace(/[^\d.]/g, ''));
  if (!(uvt > 0) || !(smmlv > 0)) return res.status(422).json({ error: 'La UVT y el SMMLV deben ser mayores que cero.' });

  await prisma.parametroAnual.upsert({
    where: { organizacionId_anio: { organizacionId: id, anio } },
    create: { organizacionId: id, anio, uvt, smmlv },
    update: { uvt, smmlv },
  });
  res.json({ ok: true });
});

adminRouter.delete('/parametros-anuales/:anio', requireAuth, soloAdmin, async (req: AuthedRequest, res) => {
  const id = await orgId(req);
  if (!id) return res.status(404).json({ error: 'Organización no encontrada.' });
  const r = await prisma.parametroAnual.deleteMany({ where: { organizacionId: id, anio: Number(req.params.anio) } });
  if (r.count === 0) return res.status(404).json({ error: 'Año no encontrado.' });
  res.json({ ok: true });
});
