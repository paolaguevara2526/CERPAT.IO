// prisma/clientes-inactivos.ts
// Marca como inactivos (activo=false) los clientes cuyo "asesor" quedó como
// "Inactivo" en la base original, y limpia ese valor del campo asesorNombre.
// Los inactivos dejan de aparecer en el listado (la API filtra activo=true).
// El campo `activo` queda disponible para marcar inactivos a futuro.
//
// Idempotente. Ejecutar con:  npx tsx prisma/clientes-inactivos.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

async function main() {
  const inactivos = await prisma.empresa.findMany({
    where: { organizacionId: ORG_ID, asesorNombre: { equals: 'Inactivo', mode: 'insensitive' } },
    select: { id: true, nombre: true },
  });

  for (const e of inactivos) {
    await prisma.empresa.update({ where: { id: e.id }, data: { activo: false, asesorNombre: null } });
    console.log(`  inactivo → ${e.nombre}`);
  }

  const activos = await prisma.empresa.count({ where: { organizacionId: ORG_ID, activo: true } });
  const total = await prisma.empresa.count({ where: { organizacionId: ORG_ID } });
  console.log(`\n✓ Marcados inactivos: ${inactivos.length}. Activos: ${activos} de ${total}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
