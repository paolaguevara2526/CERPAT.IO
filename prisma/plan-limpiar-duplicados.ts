// prisma/plan-limpiar-duplicados.ts
// Limpieza puntual tras vincular actividades del plan a vencimientos (paso 3 de la
// unificación plan↔vencimientos). Borra las tareas del plan que ahora se controlan
// en Vencimientos —su actividad tiene obligacionVencimiento != null— PERO solo las
// que están VACÍAS (sin ningún avance). Las que ya tengan trabajo se conservan.
//
// "Vacía" = estado 'por_iniciar' + auditoría 'pendiente' + ninguna subtarea
// 'realizada' + sin comprobantes ni cantidad de registros.
//
// Por seguridad, por defecto es DRY-RUN (solo informa). Para borrar de verdad:
//   npx tsx prisma/plan-limpiar-duplicados.ts --apply
// (Sin --apply solo imprime cuántas borraría y cuántas conserva.)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

async function main() {
  const apply = process.argv.includes('--apply');

  // Actividades vinculadas a un vencimiento (se controlan en Vencimientos).
  const acts = await prisma.actividadPlan.findMany({
    where: { organizacionId: ORG_ID, obligacionVencimiento: { not: null } },
    select: { id: true },
  });
  const actIds = acts.map((a) => a.id);
  if (actIds.length === 0) {
    console.log('No hay actividades vinculadas a un vencimiento; nada que limpiar.');
    return;
  }

  const tareas = await prisma.tarea.findMany({
    where: { organizacionId: ORG_ID, actividadPlanId: { in: actIds } },
    select: {
      id: true, titulo: true, estado: true, auditoria: true,
      comprobanteDesde: true, comprobanteHasta: true, cantidadRegistros: true,
      empresa: { select: { nombre: true } },
      subtareas: { select: { estado: true } },
    },
  });

  const vacia = (t: (typeof tareas)[number]) =>
    t.estado === 'por_iniciar' &&
    t.auditoria === 'pendiente' &&
    !t.subtareas.some((s) => s.estado === 'realizada') &&
    !t.comprobanteDesde && !t.comprobanteHasta && t.cantidadRegistros == null;

  const aBorrar = tareas.filter(vacia);
  const conservadas = tareas.length - aBorrar.length;

  console.log(`Tareas del plan vinculadas a un vencimiento: ${tareas.length}`);
  console.log(`  · Con avance (se conservan): ${conservadas}`);
  console.log(`  · Vacías (${apply ? 'a borrar' : 'se borrarían'}): ${aBorrar.length}`);

  if (!apply) {
    console.log('\nDRY-RUN: no se borró nada. Corre con --apply para borrar las vacías.');
    return;
  }
  if (aBorrar.length === 0) {
    console.log('\nNada que borrar.');
    return;
  }
  const res = await prisma.tarea.deleteMany({ where: { id: { in: aBorrar.map((t) => t.id) } } });
  console.log(`\n✓ Borradas ${res.count} tareas-duplicado vacías (se conservaron ${conservadas} con avance).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
