// apps/api/src/routes/vencimientos.ts
// Vencimientos tributarios generados por empresa (config × calendario × NIT).
// Lectura: cualquier usuario de la firma. Edición (estado, fecha, notas): solo
// Administrador / root por ahora (más adelante, permisos por rol).

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const vencimientosRouter = Router();

const ESTADOS = ['pendiente', 'presentado_sin_pago', 'presentado_pagado', 'presentado_cero', 'no_presentado', 'no_obligado'];
// Estados que cuentan como "presentado" (cumplido) en los KPIs.
const PRESENTADOS = ['presentado_sin_pago', 'presentado_pagado', 'presentado_cero'];

// Usuario de la firma (no cliente externo).
function esUsuarioFirma(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || (u.roles.length > 0 && !u.empresaCliente && !u.grupoCliente));
}
// Puede editar vencimientos: por ahora, solo Administrador / root.
function puedeEditar(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || u.roles.includes('Administrador'));
}
async function orgCerpat() {
  return prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
}

// GET /vencimientos?anio=&empresaId=&mes=&estado=
vencimientosRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgCerpat();
  if (!org) return res.json({ total: 0, vencimientos: [] });
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const empresaId = typeof req.query.empresaId === 'string' && req.query.empresaId ? req.query.empresaId : undefined;
  const estado = typeof req.query.estado === 'string' && ESTADOS.includes(req.query.estado) ? req.query.estado : undefined;
  const mes = Number(req.query.mes);

  const items = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio, ...(empresaId ? { empresaId } : {}), ...(estado ? { estado: estado as any } : {}) },
    orderBy: [{ fechaVencimiento: 'asc' }],
    select: {
      id: true, empresaId: true, obligacion: true, periodicidad: true, periodo: true,
      fechaVencimiento: true, estado: true, notas: true,
      empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } },
    },
  });
  const hoy = new Date();
  let list = items.map((v) => ({
    ...v, empresa: v.empresa?.nombre ?? null, municipio: v.municipio?.nombre ?? null,
    vencido: v.estado === 'pendiente' && v.fechaVencimiento < hoy,
  }));
  if (mes >= 1 && mes <= 12) list = list.filter((v) => v.fechaVencimiento.getMonth() + 1 === mes);
  res.json({ total: list.length, vencimientos: list });
});

// GET /vencimientos/resumen?anio= — KPIs + por empresa + por mes.
vencimientosRouter.get('/resumen', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgCerpat();
  if (!org) return res.json({ kpis: null, porEmpresa: [], porMes: [] });
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const items = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio },
    select: { estado: true, fechaVencimiento: true, empresa: { select: { id: true, nombre: true } } },
  });
  const hoy = new Date();
  let total = 0, presentados = 0, pendientes = 0, vencidos = 0;
  const emp = new Map<string, { empresa: string; total: number; presentados: number; vencidos: number }>();
  const porMes = new Array(12).fill(0);
  for (const v of items) {
    // "No obligado" no es una obligación real: no cuenta en total ni en cumplimiento.
    if (v.estado === 'no_obligado') continue;
    total++;
    const pres = PRESENTADOS.includes(v.estado);
    const venc = v.estado === 'pendiente' && v.fechaVencimiento < hoy;
    if (pres) presentados++; else if (venc) vencidos++; else pendientes++;
    const k = v.empresa.id;
    const a = emp.get(k) ?? { empresa: v.empresa.nombre, total: 0, presentados: 0, vencidos: 0 };
    a.total++; if (pres) a.presentados++; if (venc) a.vencidos++; emp.set(k, a);
    porMes[v.fechaVencimiento.getMonth()]++;
  }
  res.json({
    anio, kpis: { total, presentados, pendientes, vencidos },
    porEmpresa: Array.from(emp.values()).sort((x, y) => y.vencidos - x.vencidos || y.total - x.total),
    porMes,
  });
});

// GET /vencimientos/empresas?anio= — empresas con vencimientos (para el filtro).
vencimientosRouter.get('/empresas', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgCerpat();
  if (!org) return res.json({ empresas: [] });
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const rows = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio }, distinct: ['empresaId'],
    select: { empresa: { select: { id: true, nombre: true } } },
  });
  res.json({ empresas: rows.map((r) => r.empresa).sort((a, b) => a.nombre.localeCompare(b.nombre)) });
});

// PATCH /vencimientos/:id — estado / fecha / notas (Administrador / root).
vencimientosRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede editar vencimientos.' });
  const org = await orgCerpat();
  const data: Record<string, any> = {};
  if (typeof req.body?.estado === 'string') {
    if (!ESTADOS.includes(req.body.estado)) return res.status(422).json({ error: 'Estado inválido.' });
    data.estado = req.body.estado;
  }
  if ('notas' in (req.body ?? {})) data.notas = typeof req.body.notas === 'string' && req.body.notas.trim() ? req.body.notas.trim() : null;
  if ('fechaVencimiento' in (req.body ?? {})) {
    const d = new Date(req.body.fechaVencimiento);
    if (isNaN(d.getTime())) return res.status(422).json({ error: 'Fecha inválida.' });
    data.fechaVencimiento = d;
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.vencimientoEmpresa.updateMany({ where: { id: req.params.id, organizacionId: org?.id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Vencimiento no encontrado.' });
  res.json({ ok: true });
});
