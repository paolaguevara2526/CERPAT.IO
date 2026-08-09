// apps/api/src/routes/hallazgos.ts
//
// Revisoría Fiscal · Portal de Hallazgos. Aislamiento por empresa/grupo forzado
// en el backend a partir del token de sesión:
//   - Revisor (Auditor) / Administrador / root: ven y editan todo el tenant.
//   - Cliente ligado a empresa: ve SOLO su empresa (solo lectura).
//   - Cliente ligado a grupo: ve las empresas de su grupo (solo lectura).
// "Vencido" es derivado (estado != resuelto && plazo < hoy).

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';

export const hallazgosRouter = Router();

const RIESGOS = ['alto', 'medio', 'bajo'];
const PRIORIDADES = ['alta', 'media', 'baja'];
const ESTADOS = ['pendiente', 'en_gestion', 'resuelto'];

function esGestor(u: { esRoot: boolean; roles: string[] }): boolean {
  return u.esRoot || u.roles.some((r) => ['Administrador', 'Auditor'].includes(r));
}

// Devuelve el alcance de empresas visibles: 'todas' (gestor) | string[] (cliente)
// | null (sin acceso).
async function alcanceEmpresas(u: AuthedRequest['user'], orgId: string): Promise<'todas' | string[] | null> {
  if (!u) return null;
  if (esGestor(u)) return 'todas';
  if (u.empresaCliente) return [u.empresaCliente];
  if (u.grupoCliente) {
    const empresas = await prisma.empresa.findMany({ where: { organizacionId: orgId, grupoId: u.grupoCliente }, select: { id: true } });
    return empresas.map((e) => e.id);
  }
  return null;
}

function vencido(estado: string, plazo: Date | null): boolean {
  return estado !== 'resuelto' && !!plazo && plazo < new Date();
}

// Empresas que el usuario puede ver (para selector de grupo / revisor).
hallazgosRouter.get('/empresas', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ empresas: [] });
  const alcance = await alcanceEmpresas(req.user, org.id);
  if (alcance === null) return res.status(403).json({ error: 'Sin acceso al portal de hallazgos.' });
  const empresas = await prisma.empresa.findMany({
    where: { organizacionId: org.id, ...(alcance === 'todas' ? {} : { id: { in: alcance } }) },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, grupo: { select: { id: true, nombre: true } } },
  });
  res.json({ gestor: alcance === 'todas', empresas: empresas.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupo?.nombre ?? null, grupoId: e.grupo?.id ?? null })) });
});

// Resolución de la empresa consultada respetando el alcance.
async function empresasConsulta(req: AuthedRequest, orgId: string): Promise<{ ids: string[] | 'todas'; error?: { code: number; msg: string } }> {
  const alcance = await alcanceEmpresas(req.user, orgId);
  if (alcance === null) return { ids: [], error: { code: 403, msg: 'Sin acceso al portal de hallazgos.' } };
  const filtro = typeof req.query.empresaId === 'string' && req.query.empresaId ? req.query.empresaId : undefined;
  if (alcance === 'todas') return { ids: filtro ? [filtro] : 'todas' };
  if (filtro) {
    if (!alcance.includes(filtro)) return { ids: [], error: { code: 403, msg: 'No puedes ver esa empresa.' } };
    return { ids: [filtro] };
  }
  return { ids: alcance };
}

// GET /hallazgos?empresaId= — lista de hallazgos en el alcance.
hallazgosRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ total: 0, hallazgos: [] });
  const { ids, error } = await empresasConsulta(req, org.id);
  if (error) return res.status(error.code).json({ error: error.msg });

  const estado = typeof req.query.estado === 'string' && ESTADOS.includes(req.query.estado) ? req.query.estado : undefined;
  const hallazgos = await prisma.hallazgo.findMany({
    where: { organizacionId: org.id, ...(ids === 'todas' ? {} : { empresaId: { in: ids } }), ...(estado ? { estado: estado as any } : {}) },
    orderBy: [{ estado: 'asc' }, { plazo: 'asc' }],
    select: {
      id: true, empresaId: true, area: true, titulo: true, descripcion: true, normatividad: true,
      riesgo: true, riesgoDescripcion: true, prioridad: true, responsable: true, planAccion: true, plazo: true, estado: true, observaciones: true,
      empresa: { select: { nombre: true } },
    },
  });
  res.json({
    total: hallazgos.length,
    hallazgos: hallazgos.map((h) => ({ ...h, empresa: h.empresa?.nombre ?? null, vencido: vencido(h.estado, h.plazo) })),
  });
});

// GET /hallazgos/resumen?empresaId= — KPIs y desglose por empresa.
hallazgosRouter.get('/resumen', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ kpis: null, porEmpresa: [] });
  const { ids, error } = await empresasConsulta(req, org.id);
  if (error) return res.status(error.code).json({ error: error.msg });

  const hallazgos = await prisma.hallazgo.findMany({
    where: { organizacionId: org.id, ...(ids === 'todas' ? {} : { empresaId: { in: ids } }) },
    select: { estado: true, plazo: true, empresa: { select: { id: true, nombre: true } } },
  });

  type Acc = { empresa: string; total: number; resueltos: number; enGestion: number; vencidos: number };
  const porEmp = new Map<string, Acc>();
  let total = 0, resueltos = 0, enGestion = 0, vencidos = 0;
  for (const h of hallazgos) {
    const esVenc = vencido(h.estado, h.plazo);
    const esRes = h.estado === 'resuelto';
    total++; if (esRes) resueltos++; else if (esVenc) vencidos++; else enGestion++;
    const k = h.empresa.id;
    const a = porEmp.get(k) ?? { empresa: h.empresa.nombre, total: 0, resueltos: 0, enGestion: 0, vencidos: 0 };
    a.total++; if (esRes) a.resueltos++; else if (esVenc) a.vencidos++; else a.enGestion++;
    porEmp.set(k, a);
  }
  const pct = (r: number, t: number) => (t ? Math.round((r / t) * 100) : 0);
  res.json({
    kpis: { total, resueltos, enGestion, vencidos, pct: pct(resueltos, total) },
    porEmpresa: Array.from(porEmp.entries())
      .map(([empresaId, v]) => ({ empresaId, ...v, pct: pct(v.resueltos, v.total) }))
      .sort((x, y) => x.pct - y.pct),
  });
});

// ---- Escritura (revisor / Administrador / root) ----

function datosHallazgo(body: any): { data: Record<string, any>; error?: string } {
  const data: Record<string, any> = {};
  if (typeof body?.titulo === 'string' && body.titulo.trim()) data.titulo = body.titulo.trim();
  for (const c of ['area', 'descripcion', 'normatividad', 'responsable', 'planAccion', 'observaciones', 'riesgoDescripcion'] as const) {
    if (c in (body ?? {})) data[c] = typeof body[c] === 'string' && body[c].trim() ? body[c].trim() : null;
  }
  if (typeof body?.riesgo === 'string') { if (!RIESGOS.includes(body.riesgo)) return { data, error: 'Riesgo inválido.' }; data.riesgo = body.riesgo; }
  if (typeof body?.prioridad === 'string') { if (!PRIORIDADES.includes(body.prioridad)) return { data, error: 'Prioridad inválida.' }; data.prioridad = body.prioridad; }
  if (typeof body?.estado === 'string') { if (!ESTADOS.includes(body.estado)) return { data, error: 'Estado inválido.' }; data.estado = body.estado; }
  if ('plazo' in (body ?? {})) {
    if (!body.plazo) data.plazo = null;
    else { const d = new Date(body.plazo); if (isNaN(d.getTime())) return { data, error: 'Plazo inválido.' }; data.plazo = d; }
  }
  return { data };
}

hallazgosRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esGestor(req.user!)) return res.status(403).json({ error: 'Solo el revisor fiscal puede crear hallazgos.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresaId = String(req.body?.empresaId ?? '');
  const empresa = empresaId ? await prisma.empresa.findFirst({ where: { id: empresaId, organizacionId: org.id }, select: { id: true } }) : null;
  if (!empresa) return res.status(422).json({ error: 'Debes indicar una empresa válida.' });
  const { data, error } = datosHallazgo(req.body);
  if (error) return res.status(422).json({ error });
  if (!data.titulo) return res.status(422).json({ error: 'El título del hallazgo es obligatorio.' });
  const h = await prisma.hallazgo.create({ data: { organizacionId: org.id, empresaId, creadoPorId: req.user!.sub, ...data } as any, select: { id: true } });
  res.status(201).json({ ok: true, id: h.id });
});

hallazgosRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!esGestor(req.user!)) return res.status(403).json({ error: 'Solo el revisor fiscal puede editar hallazgos.' });
  const org = await orgDeSesion(req);
  const { data, error } = datosHallazgo(req.body);
  if (error) return res.status(422).json({ error });
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.hallazgo.updateMany({ where: { id: req.params.id, organizacionId: org?.id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Hallazgo no encontrado.' });
  res.json({ ok: true });
});

hallazgosRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!esGestor(req.user!)) return res.status(403).json({ error: 'Solo el revisor fiscal puede eliminar hallazgos.' });
  const org = await orgDeSesion(req);
  const r = await prisma.hallazgo.deleteMany({ where: { id: req.params.id, organizacionId: org?.id } });
  if (r.count === 0) return res.status(404).json({ error: 'Hallazgo no encontrado.' });
  res.json({ ok: true });
});

// POST /hallazgos/vaciar  { empresaId } — borra TODOS los hallazgos de una
// empresa (revisor). Útil para reimportar limpio.
hallazgosRouter.post('/vaciar', requireAuth, async (req: AuthedRequest, res) => {
  if (!esGestor(req.user!)) return res.status(403).json({ error: 'Solo el revisor fiscal puede vaciar los hallazgos.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresaId = String(req.body?.empresaId ?? '');
  const empresa = empresaId ? await prisma.empresa.findFirst({ where: { id: empresaId, organizacionId: org.id }, select: { id: true } }) : null;
  if (!empresa) return res.status(422).json({ error: 'Debes indicar una empresa válida.' });
  const r = await prisma.hallazgo.deleteMany({ where: { organizacionId: org.id, empresaId } });
  res.json({ ok: true, eliminados: r.count });
});

// POST /hallazgos/importar  { empresaId, items: [...] } — carga masiva (revisor).
hallazgosRouter.post('/importar', requireAuth, async (req: AuthedRequest, res) => {
  if (!esGestor(req.user!)) return res.status(403).json({ error: 'Solo el revisor fiscal puede importar hallazgos.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresaId = String(req.body?.empresaId ?? '');
  const empresa = empresaId ? await prisma.empresa.findFirst({ where: { id: empresaId, organizacionId: org.id }, select: { id: true } }) : null;
  if (!empresa) return res.status(422).json({ error: 'Debes indicar una empresa válida.' });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return res.status(422).json({ error: 'No hay filas para importar.' });

  const data = [];
  let omitidas = 0;
  for (const it of items) {
    const { data: d, error } = datosHallazgo(it);
    if (error || !d.titulo) { omitidas++; continue; }
    data.push({ organizacionId: org.id, empresaId, creadoPorId: req.user!.sub, ...d });
  }
  if (data.length === 0) return res.status(422).json({ error: 'Ninguna fila válida (falta el título del hallazgo).' });
  const r = await prisma.hallazgo.createMany({ data: data as any });
  res.status(201).json({ ok: true, creadas: r.count, omitidas });
});
