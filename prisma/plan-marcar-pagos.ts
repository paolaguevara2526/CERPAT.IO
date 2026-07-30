// prisma/plan-marcar-pagos.ts
//
// Marca qué actividades del catálogo "generan pago" (obligaciones DIAN/entidades)
// y lo propaga a las tareas ya generadas, para alimentar la vista de Pagos.
//
// Criterio (definido con el equipo):
//   - Todas las actividades del área de IMPUESTOS.
//   - La actividad de seguridad social del área de Nómina (código EF-10).
//
// Idempotente: solo actualiza lo que cambia. Correr:  npm run db:plan-marcar-pagos

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_SLUG = 'cerpat';

// Códigos de actividades de Nómina que generan pago (seguridad social / parafiscales).
const CODIGOS_PAGO_EXTRA = ['EF-10'];

async function main() {
  const org = await prisma.organizacion.findFirst({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización "${ORG_SLUG}".`);

  const areaImpuestos = await prisma.area.findFirst({ where: { organizacionId: org.id, nombre: 'Impuestos' } });

  // Actividades objetivo: área Impuestos + códigos extra (seguridad social de Nómina).
  const actividades = await prisma.actividadPlan.findMany({
    where: {
      organizacionId: org.id,
      OR: [
        ...(areaImpuestos ? [{ areaId: areaImpuestos.id }] : []),
        { codigo: { in: CODIGOS_PAGO_EXTRA } },
      ],
    },
    select: { id: true, codigo: true, nombre: true, generaPago: true },
    orderBy: { codigo: 'asc' },
  });

  if (actividades.length === 0) {
    console.log('No se encontraron actividades objetivo. ¿Ya se importó el catálogo del plan?');
    return;
  }

  const ids = actividades.map((a) => a.id);
  const porMarcar = actividades.filter((a) => !a.generaPago);

  console.log(`Actividades que generan pago (${actividades.length}):`);
  for (const a of actividades) console.log(`  ${a.generaPago ? '•' : '+'} ${a.codigo} — ${a.nombre}`);

  if (porMarcar.length > 0) {
    await prisma.actividadPlan.updateMany({ where: { id: { in: porMarcar.map((a) => a.id) } }, data: { generaPago: true } });
  }
  console.log(`\nCatálogo: ${porMarcar.length} actividades marcadas (de ${actividades.length}).`);

  // Propaga a las tareas ya generadas de esas actividades.
  const res = await prisma.tarea.updateMany({
    where: { organizacionId: org.id, actividadPlanId: { in: ids }, generaPago: false },
    data: { generaPago: true },
  });
  const total = await prisma.tarea.count({ where: { organizacionId: org.id, generaPago: true } });
  console.log(`Tareas: ${res.count} actualizadas a generaPago=true. Total con pago ahora: ${total}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
