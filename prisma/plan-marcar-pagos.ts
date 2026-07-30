// prisma/plan-marcar-pagos.ts
//
// Marca qué actividades del catálogo "generan pago" (obligaciones DIAN/entidades)
// y lo propaga a las tareas ya generadas, para alimentar la vista de Pagos.
//
// Criterio (definido con el equipo):
//   - Actividades del área de IMPUESTOS que implican un pago real
//     (declaraciones/pagos), EXCLUYENDO las informativas (exógena,
//     conciliaciones, revisiones).
//   - La actividad de seguridad social del área de Nómina (código EF-10).
//
// Idempotente: marca las que generan pago y DESMARCA las informativas (por si
// una corrida previa las dejó marcadas). Correr:  npm run db:plan-marcar-pagos

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_SLUG = 'cerpat';

// Códigos de actividades de otras áreas que generan pago (seguridad social / parafiscales).
const CODIGOS_PAGO_EXTRA = ['EF-10'];

// Actividades del área Impuestos que son INFORMATIVAS (no implican pago): se excluyen.
const CODIGOS_INFORMATIVOS = ['EF-08', 'IN-04', 'IN-05', 'IM-03', 'IM-05'];

async function main() {
  const org = await prisma.organizacion.findFirst({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización "${ORG_SLUG}".`);

  const areaImpuestos = await prisma.area.findFirst({ where: { organizacionId: org.id, nombre: 'Impuestos' } });

  // Candidatas: área Impuestos + códigos extra. Luego separamos por informativas.
  const candidatas = await prisma.actividadPlan.findMany({
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

  if (candidatas.length === 0) {
    console.log('No se encontraron actividades objetivo. ¿Ya se importó el catálogo del plan?');
    return;
  }

  const conPago = candidatas.filter((a) => !CODIGOS_INFORMATIVOS.includes(a.codigo));
  const informativas = candidatas.filter((a) => CODIGOS_INFORMATIVOS.includes(a.codigo));
  const idsPago = conPago.map((a) => a.id);
  const idsInfo = informativas.map((a) => a.id);

  console.log(`Actividades que GENERAN pago (${conPago.length}):`);
  for (const a of conPago) console.log(`  ${a.generaPago ? '•' : '+'} ${a.codigo} — ${a.nombre}`);
  if (informativas.length > 0) {
    console.log(`\nExcluidas (informativas, sin pago) (${informativas.length}):`);
    for (const a of informativas) console.log(`  ${a.generaPago ? '-' : '·'} ${a.codigo} — ${a.nombre}`);
  }

  // Catálogo: marcar las que generan pago, desmarcar las informativas.
  const marcadas = await prisma.actividadPlan.updateMany({ where: { id: { in: idsPago }, generaPago: false }, data: { generaPago: true } });
  const desmarcadas = idsInfo.length
    ? await prisma.actividadPlan.updateMany({ where: { id: { in: idsInfo }, generaPago: true }, data: { generaPago: false } })
    : { count: 0 };
  console.log(`\nCatálogo: ${marcadas.count} marcadas, ${desmarcadas.count} desmarcadas.`);

  // Propaga a las tareas ya generadas: true para las que pagan, false para informativas.
  const tMarcadas = await prisma.tarea.updateMany({ where: { organizacionId: org.id, actividadPlanId: { in: idsPago }, generaPago: false }, data: { generaPago: true } });
  const tDesmarcadas = idsInfo.length
    ? await prisma.tarea.updateMany({ where: { organizacionId: org.id, actividadPlanId: { in: idsInfo }, generaPago: true }, data: { generaPago: false } })
    : { count: 0 };
  const total = await prisma.tarea.count({ where: { organizacionId: org.id, generaPago: true } });
  console.log(`Tareas: ${tMarcadas.count} marcadas, ${tDesmarcadas.count} desmarcadas. Total con pago ahora: ${total}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
