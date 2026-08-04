// prisma/plan-generar.ts
// Fase 3: genera las Tarea del Plan de Trabajo para un período (mes), a partir de
// las PlanClienteActividad activas y su periodicidad. Las tareas generadas SON las
// que aparecen en Calendario/Mi Día (misma entidad Tarea).
// Idempotente: no duplica una tarea ya existente para (empresa, actividad, período).
//
// NO genera tarea para las actividades vinculadas a un vencimiento
// (ActividadPlan.obligacionVencimiento != null): esas declaraciones se controlan
// en Vencimientos (con su checklist y avance) y no se duplican como tarea del plan.
// Para limpiar las tareas-duplicado ya generadas: prisma/plan-limpiar-duplicados.ts.
//
// Ejecutar con:  npx tsx prisma/plan-generar.ts [YYYY-MM]   (por defecto, mes actual)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

// Meses en que "cae" cada periodicidad (arranca en enero).
const PASO: Record<string, number> = {
  Mensual: 1, Bimestral: 2, Trimestral: 3, Cuatrimestral: 4, Semestral: 6, Anual: 12,
};
function aplicaEnMes(periodicidad: string | null, mes1a12: number): boolean {
  const n = PASO[(periodicidad || '').trim()];
  if (!n) return false; // "No aplica"/eventual/desconocida → no genera
  return (mes1a12 - 1) % n === 0;
}

async function main() {
  const arg = process.argv[2];
  const now = new Date();
  const periodo = /^\d{4}-\d{2}$/.test(arg || '') ? arg : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = periodo.split('-').map(Number); // month 1..12

  const org = await prisma.organizacion.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error('No existe la organización demo (corre el seed primero).');

  const actividades = await prisma.actividadPlan.findMany({
    where: { organizacionId: ORG_ID },
    select: { id: true, nombre: true, areaId: true, periodicidad: true, requiereAuditoria: true, generaPago: true, obligacionVencimiento: true },
  });
  const actById = new Map(actividades.map((a) => [a.id, a]));

  const planes = await prisma.planClienteActividad.findMany({
    where: { organizacionId: ORG_ID, activa: true },
    select: { empresaId: true, actividadPlanId: true, periodicidad: true },
  });

  // Asignaciones cliente×área (asesor responsable / auxiliar ejecutor), para
  // heredarlas en cada tarea generada. Clave: `${empresaId}|${areaId}`.
  const asignaciones = await prisma.asignacionClienteArea.findMany({
    where: { organizacionId: ORG_ID },
    select: { empresaId: true, areaId: true, asesorId: true, auxiliarId: true },
  });
  const asignPorEmpresaArea = new Map(
    asignaciones.map((a) => [`${a.empresaId}|${a.areaId}`, { asesorId: a.asesorId, auxiliarId: a.auxiliarId }]),
  );

  // Tareas del plan ya existentes para este período (para no duplicar).
  const existentes = await prisma.tarea.findMany({
    where: { organizacionId: ORG_ID, periodo, actividadPlanId: { not: null } },
    select: { empresaId: true, actividadPlanId: true },
  });
  const yaExiste = new Set(existentes.map((t) => `${t.empresaId}|${t.actividadPlanId}`));

  const fechaInicio = new Date(Date.UTC(year, month - 1, 1));
  const fechaVencimiento = new Date(Date.UTC(year, month, 0)); // último día del mes

  const tareas = [];
  for (const p of planes) {
    const act = actById.get(p.actividadPlanId);
    if (!act) continue;
    if (act.obligacionVencimiento) continue; // se controla en Vencimientos, no se duplica
    const per = p.periodicidad || act.periodicidad;
    if (!aplicaEnMes(per, month)) continue;
    if (yaExiste.has(`${p.empresaId}|${p.actividadPlanId}`)) continue;
    const asign = act.areaId ? asignPorEmpresaArea.get(`${p.empresaId}|${act.areaId}`) : undefined;
    tareas.push({
      organizacionId: ORG_ID,
      titulo: act.nombre,
      empresaId: p.empresaId,
      fechaInicio,
      fechaVencimiento,
      actividadPlanId: p.actividadPlanId,
      areaId: act.areaId,
      generaPago: act.generaPago,
      periodo,
      asesorId: asign?.asesorId ?? null,
      auxiliarId: asign?.auxiliarId ?? null,
    });
  }

  const res = await prisma.tarea.createMany({ data: tareas });
  console.log(`✓ Tareas generadas para ${periodo}: ${res.count} creadas (de ${planes.length} vínculos de plan activos; ya existían ${existentes.length}).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
