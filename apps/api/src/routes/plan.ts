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

export const planRouter = Router();

const EJECUTADA = ['terminado', 'auditado'];

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
