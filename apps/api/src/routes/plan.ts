// apps/api/src/routes/plan.ts
//
// Panel de Coordinación: indicadores de cumplimiento del Plan de Trabajo,
// agregados desde las tareas del plan (Tarea con actividadPlanId) de un período.
//
// TODO (auth/tenant): resolver la organización desde la sesión y restringir a rol
// Coordinador. Mientras no hay auth, resuelve la organización demo (slug "cerpat").
// Los ejes asesor/auxiliar quedarán poblados cuando existan usuarios y asignaciones.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const planRouter = Router();

const EJECUTADA = ['terminado', 'auditado'];

// GET /plan/tareas — lista de tareas reales del plan (autenticado).
// Filtros: ?periodo=YYYY-MM &estado= &area= &q= (empresa/actividad) &mias=1
planRouter.get('/tareas', requireAuth, async (req: AuthedRequest, res) => {
  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
  if (!org) return res.json({ periodo: null, total: 0, tareas: [] });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const estado = typeof req.query.estado === 'string' ? req.query.estado : undefined;
  const area = typeof req.query.area === 'string' ? req.query.area : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const mias = req.query.mias === '1' || req.query.mias === 'true';
  const uid = req.user!.sub;

  const tareas = await prisma.tarea.findMany({
    where: {
      organizacionId: org.id,
      actividadPlanId: { not: null },
      periodo,
      ...(estado ? { estado: estado as any } : {}),
      ...(area ? { area: { nombre: area } } : {}),
      ...(mias ? { OR: [{ asesorId: uid }, { auxiliarId: uid }] } : {}),
      ...(q ? { OR: [{ empresa: { nombre: { contains: q, mode: 'insensitive' } } }, { titulo: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    select: {
      id: true, titulo: true, estado: true, prioridad: true, auditoria: true,
      fechaInicio: true, fechaVencimiento: true, periodo: true,
      empresa: { select: { nombre: true } },
      area: { select: { nombre: true } },
      asesor: { select: { nombre: true } },
      auxiliar: { select: { nombre: true } },
    },
    orderBy: [{ fechaVencimiento: 'asc' }, { titulo: 'asc' }],
    take: 500,
  });

  res.json({
    periodo,
    total: tareas.length,
    tareas: tareas.map((t) => ({
      id: t.id, titulo: t.titulo, estado: t.estado, prioridad: t.prioridad, auditoria: t.auditoria,
      fechaVencimiento: t.fechaVencimiento, periodo: t.periodo,
      empresa: t.empresa?.nombre ?? null, area: t.area?.nombre ?? null,
      asesor: t.asesor?.nombre ?? null, auxiliar: t.auxiliar?.nombre ?? null,
    })),
  });
});

const ESTADOS_VALIDOS = ['por_iniciar', 'en_curso', 'en_revision', 'terminado', 'auditado', 'no_realizado'];
const REQUIEREN_SUBTAREAS = ['terminado', 'auditado'];

// PATCH /plan/tareas/:id/estado  { estado }  — cambia el estado con reglas de negocio.
planRouter.patch('/tareas/:id/estado', requireAuth, async (req: AuthedRequest, res) => {
  const estado = String(req.body?.estado ?? '');
  if (!ESTADOS_VALIDOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });

  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
  const tarea = await prisma.tarea.findFirst({
    where: { id: req.params.id, organizacionId: org?.id },
    include: { subtareas: true },
  });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });

  // Permiso: root, Administrador/Coordinador, o el asesor/auxiliar de la tarea.
  const u = req.user!;
  const puede = u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)) || tarea.asesorId === u.sub || tarea.auxiliarId === u.sub;
  if (!puede) return res.status(403).json({ error: 'No puedes cambiar esta tarea (no eres su asesor/auxiliar ni tienes rol de coordinación).' });

  // Regla: no editar una tarea ya aprobada en auditoría sin desbloquear primero.
  if (tarea.auditoria === 'aprobada') return res.status(403).json({ error: 'La tarea está bloqueada (aprobada en Auditoría). Debe desbloquearse primero.' });

  // Regla: no marcar Terminado/Auditado con subtareas pendientes.
  if (REQUIEREN_SUBTAREAS.includes(estado) && tarea.subtareas.some((s) => s.estado === 'pendiente')) {
    return res.status(422).json({ error: `No se puede marcar "${estado}" con subtareas sin resolver.` });
  }

  const actualizada = await prisma.tarea.update({ where: { id: tarea.id }, data: { estado: estado as any } });
  res.json({ ok: true, id: actualizada.id, estado: actualizada.estado });
});

// GET /plan/auditoria — cola de tareas enviadas a auditoría (estado en_revision,
// sin aprobar aún) del período. Autenticado.
planRouter.get('/auditoria', requireAuth, async (req: AuthedRequest, res) => {
  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
  if (!org) return res.json({ periodo: null, total: 0, tareas: [] });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const tareas = await prisma.tarea.findMany({
    where: {
      organizacionId: org.id,
      actividadPlanId: { not: null },
      periodo,
      estado: 'en_revision',
      auditoria: { not: 'aprobada' },
    },
    select: {
      id: true, titulo: true, estado: true, auditoria: true, requiereRevisionTecnica: true,
      observaciones: true, fechaVencimiento: true, periodo: true,
      empresa: { select: { nombre: true } },
      area: { select: { nombre: true } },
      asesor: { select: { id: true, nombre: true } },
      auxiliar: { select: { id: true, nombre: true } },
    },
    orderBy: [{ fechaVencimiento: 'asc' }, { titulo: 'asc' }],
    take: 500,
  });

  res.json({
    periodo,
    total: tareas.length,
    tareas: tareas.map((t) => ({
      id: t.id, titulo: t.titulo, estado: t.estado, auditoria: t.auditoria,
      requiereRevisionTecnica: t.requiereRevisionTecnica, observaciones: t.observaciones,
      fechaVencimiento: t.fechaVencimiento, periodo: t.periodo,
      empresa: t.empresa?.nombre ?? null, area: t.area?.nombre ?? null,
      asesor: t.asesor?.nombre ?? null, auxiliar: t.auxiliar?.nombre ?? null,
    })),
  });
});

// PATCH /plan/tareas/:id/auditoria  { accion: 'aprobar' | 'devolver', observaciones? }
// Aprobar: estado -> auditado, auditoria -> aprobada (bloquea). Devolver: estado ->
// en_curso, auditoria -> rechazada, guarda observaciones. Solo coordinación o el asesor.
planRouter.patch('/tareas/:id/auditoria', requireAuth, async (req: AuthedRequest, res) => {
  const accion = String(req.body?.accion ?? '');
  if (accion !== 'aprobar' && accion !== 'devolver') return res.status(400).json({ error: 'Acción inválida.' });

  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });

  // Permiso: root, Administrador/Coordinador, o el asesor de la tarea (aprueba lo de
  // sus auxiliares). El auxiliar no puede auditar su propia tarea.
  const u = req.user!;
  const puede = u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)) || tarea.asesorId === u.sub;
  if (!puede) return res.status(403).json({ error: 'Solo coordinación o el asesor del área puede auditar esta tarea.' });

  if (tarea.auditoria === 'aprobada') return res.status(409).json({ error: 'La tarea ya fue aprobada en auditoría.' });

  if (accion === 'aprobar') {
    const actualizada = await prisma.tarea.update({
      where: { id: tarea.id },
      data: { estado: 'auditado', auditoria: 'aprobada' },
    });
    return res.json({ ok: true, id: actualizada.id, estado: actualizada.estado, auditoria: actualizada.auditoria });
  }

  // devolver
  const observaciones = String(req.body?.observaciones ?? '').trim();
  if (!observaciones) return res.status(422).json({ error: 'Indica las observaciones para devolver la tarea.' });
  const actualizada = await prisma.tarea.update({
    where: { id: tarea.id },
    data: { estado: 'en_curso', auditoria: 'rechazada', observaciones },
  });
  res.json({ ok: true, id: actualizada.id, estado: actualizada.estado, auditoria: actualizada.auditoria });
});

planRouter.get('/cumplimiento', async (req, res) => {
  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
  if (!org) return res.json({ organizacion: null, periodo: null, kpis: null, porArea: [], porCliente: [] });

  const now = new Date();
  const periodoParam = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const tareas = await prisma.tarea.findMany({
    where: { organizacionId: org.id, periodo: periodoParam, actividadPlanId: { not: null } },
    select: {
      estado: true, auditoria: true, fechaVencimiento: true,
      area: { select: { nombre: true } },
      empresa: { select: { id: true, nombre: true } },
      asesor: { select: { id: true, nombre: true } },
      auxiliar: { select: { id: true, nombre: true } },
    },
  });

  const hoy = new Date();
  let ejecutadas = 0, vencidas = 0, porAuditar = 0;
  const areaMap = new Map<string, { total: number; ejecutadas: number }>();
  const cliMap = new Map<string, { empresa: string; total: number; ejecutadas: number; vencidas: number }>();
  type Persona = { nombre: string; total: number; ejecutadas: number; vencidas: number };
  const asesorMap = new Map<string, Persona>();
  const auxiliarMap = new Map<string, Persona>();

  const acumPersona = (map: Map<string, Persona>, id: string, nombre: string, esEjec: boolean, esVenc: boolean) => {
    const p = map.get(id) ?? { nombre, total: 0, ejecutadas: 0, vencidas: 0 };
    p.total++; if (esEjec) p.ejecutadas++; if (esVenc) p.vencidas++; map.set(id, p);
  };

  for (const t of tareas) {
    const esEjec = EJECUTADA.includes(t.estado);
    const esVenc = !esEjec && t.fechaVencimiento < hoy;
    if (esEjec) ejecutadas++;
    if (esVenc) vencidas++;
    if (t.estado === 'terminado' && t.auditoria !== 'aprobada') porAuditar++;

    const areaNombre = t.area?.nombre ?? 'Sin área';
    const a = areaMap.get(areaNombre) ?? { total: 0, ejecutadas: 0 };
    a.total++; if (esEjec) a.ejecutadas++; areaMap.set(areaNombre, a);

    const c = cliMap.get(t.empresa.id) ?? { empresa: t.empresa.nombre, total: 0, ejecutadas: 0, vencidas: 0 };
    c.total++; if (esEjec) c.ejecutadas++; if (esVenc) c.vencidas++; cliMap.set(t.empresa.id, c);

    if (t.asesor) acumPersona(asesorMap, t.asesor.id, t.asesor.nombre, esEjec, esVenc);
    if (t.auxiliar) acumPersona(auxiliarMap, t.auxiliar.id, t.auxiliar.nombre, esEjec, esVenc);
  }

  const total = tareas.length;
  const pct = (e: number, t: number) => (t ? Math.round((e / t) * 100) : 0);

  const porArea = Array.from(areaMap.entries())
    .map(([area, v]) => ({ area, total: v.total, ejecutadas: v.ejecutadas, cumplimiento: pct(v.ejecutadas, v.total) }))
    .sort((x, y) => y.total - x.total);

  const porCliente = Array.from(cliMap.values())
    .map((v) => ({ empresa: v.empresa, total: v.total, ejecutadas: v.ejecutadas, vencidas: v.vencidas, cumplimiento: pct(v.ejecutadas, v.total) }))
    .sort((x, y) => x.cumplimiento - y.cumplimiento); // en riesgo primero

  const mapPersona = (m: Map<string, Persona>) =>
    Array.from(m.values())
      .map((v) => ({ nombre: v.nombre, total: v.total, ejecutadas: v.ejecutadas, vencidas: v.vencidas, cumplimiento: pct(v.ejecutadas, v.total) }))
      .sort((x, y) => x.cumplimiento - y.cumplimiento || y.total - x.total);

  res.json({
    organizacion: { nombre: org.nombre },
    periodo: periodoParam,
    kpis: { total, ejecutadas, vencidas, porAuditar, cumplimiento: pct(ejecutadas, total) },
    porArea,
    porCliente,
    porAsesor: mapPersona(asesorMap),
    porAuxiliar: mapPersona(auxiliarMap),
  });
});
