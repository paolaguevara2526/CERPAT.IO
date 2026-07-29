// prisma/plan-asignar.ts
// Fase 3 (Opción A): asigna el catálogo base del plan a TODOS los clientes de la
// organización demo — crea PlanClienteActividad (activa=true) para cada
// empresa × actividad. Idempotente (skipDuplicates por [empresaId, actividadPlanId]).
// Luego, por cliente, se pueden desactivar las que no apliquen.
//
// Ejecutar con:  npx tsx prisma/plan-asignar.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

async function main() {
  const org = await prisma.organizacion.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error('No existe la organización demo (corre el seed primero).');

  const empresas = await prisma.empresa.findMany({ where: { organizacionId: ORG_ID }, select: { id: true } });
  const actividades = await prisma.actividadPlan.findMany({
    where: { organizacionId: ORG_ID, activo: true },
    select: { id: true, periodicidad: true },
  });

  const data = empresas.flatMap((e) =>
    actividades.map((a) => ({
      organizacionId: ORG_ID,
      empresaId: e.id,
      actividadPlanId: a.id,
      activa: true,
      periodicidad: a.periodicidad,
    })),
  );

  const res = await prisma.planClienteActividad.createMany({ data, skipDuplicates: true });
  console.log(`✓ Plan asignado. Empresas: ${empresas.length}, actividades: ${actividades.length}, vínculos nuevos: ${res.count} (de ${data.length} posibles).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
