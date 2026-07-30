// apps/api/src/routes/admin.ts
//
// Panel de Administración: parámetros de liquidación y catálogos base
// (áreas, tipos de tarea, tipos de obligación, periodicidades, etiquetas).
// Lectura: cualquier usuario autenticado (para poblar selects). Escritura:
// solo Administrador o root.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRol, type AuthedRequest } from '../auth/middleware.js';

export const adminRouter = Router();

const soloAdmin = requireRol('Administrador');

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
