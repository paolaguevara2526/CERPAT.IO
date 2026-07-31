// prisma/plan-retirar-inactivos.ts
// Retira del Plan de Trabajo a los clientes inactivos (Empresa.activo = false):
// borra sus tareas generadas por el plan (Tarea con actividadPlanId; la cascada
// elimina subtareas/asignados/etiquetas), sus PlanClienteActividad y sus
// AsignacionClienteArea. Base nueva: borrado directo, sin trazabilidad.
//
// No toca Pago (es independiente del plan) ni las tareas manuales sin plan.
// Idempotente: correrlo de nuevo no encuentra nada que borrar.
//
// Ejecutar con:  npx tsx prisma/plan-retirar-inactivos.ts
//   (requiere DATABASE_URL de la base a limpiar)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

async function main() {
  const total = await prisma.empresa.count({ where: { organizacionId: ORG_ID } });
  const activos = await prisma.empresa.count({ where: { organizacionId: ORG_ID, activo: true } });
  const inactivos = await prisma.empresa.findMany({
    where: { organizacionId: ORG_ID, activo: false },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
  console.log(`Clientes: ${total} en total · ${activos} activos · ${inactivos.length} inactivos.`);

  if (inactivos.length === 0) {
    console.log('No hay clientes inactivos. Nada que retirar del plan.');
    return;
  }

  const ids = inactivos.map((e) => e.id);

  // Orden seguro de borrado. Las tareas cascadan sus subtareas/asignados/etiquetas.
  const tareas = await prisma.tarea.deleteMany({
    where: { organizacionId: ORG_ID, empresaId: { in: ids }, actividadPlanId: { not: null } },
  });
  const plan = await prisma.planClienteActividad.deleteMany({
    where: { organizacionId: ORG_ID, empresaId: { in: ids } },
  });
  const asig = await prisma.asignacionClienteArea.deleteMany({
    where: { organizacionId: ORG_ID, empresaId: { in: ids } },
  });

  for (const e of inactivos) console.log(`  retirado del plan → ${e.nombre}`);

  const planRestante = await prisma.planClienteActividad.count({ where: { organizacionId: ORG_ID } });
  const tareasPlanRestantes = await prisma.tarea.count({ where: { organizacionId: ORG_ID, actividadPlanId: { not: null } } });

  console.log(`\n✓ Clientes inactivos retirados del plan: ${inactivos.length}.`);
  console.log(`  Tareas del plan borradas:        ${tareas.count}`);
  console.log(`  PlanClienteActividad borradas:   ${plan.count}`);
  console.log(`  AsignacionClienteArea borradas:  ${asig.count}`);
  console.log(`  Restan (clientes activos): ${planRestante} actividades y ${tareasPlanRestantes} tareas del plan.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
