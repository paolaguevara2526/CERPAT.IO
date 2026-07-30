// prisma/usuarios-limpiar.ts
// Limpia usuarios duplicados que quedaron tras la migración de dominio
// @cerpat.com → @cerpat.io: el import crea/actualiza por (organización, email),
// así que al cambiar el dominio quedaron los registros viejos @cerpat.com además
// de los nuevos @cerpat.io. Este script elimina SOLO los @cerpat.com de la
// organización (los duplicados obsoletos), dejando la versión @cerpat.io.
//
// Seguro: primero lista lo que va a borrar, y solo toca la organización demo.
// Las relaciones opcionales (asesor/auxiliar en tareas y asignaciones) quedan en
// null automáticamente; los roles del usuario se borran en cascada.
//
// Ejecutar con:  npx tsx prisma/usuarios-limpiar.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

async function main() {
  const org = await prisma.organizacion.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error('No existe la organización demo (corre el seed primero).');

  const todos = await prisma.usuario.findMany({
    where: { organizacionId: ORG_ID },
    select: { id: true, nombre: true, email: true },
    orderBy: { email: 'asc' },
  });
  console.log(`Usuarios actuales en la organización: ${todos.length}`);

  const stale = todos.filter((u) => u.email.toLowerCase().endsWith('@cerpat.com'));
  if (stale.length === 0) {
    console.log('No hay usuarios @cerpat.com. Nada que limpiar. ✓');
    return;
  }

  console.log(`\nDuplicados @cerpat.com a eliminar (${stale.length}):`);
  for (const u of stale) console.log(`  - ${u.nombre} <${u.email}>`);

  const res = await prisma.usuario.deleteMany({
    where: { organizacionId: ORG_ID, email: { endsWith: '@cerpat.com' } },
  });

  const quedan = await prisma.usuario.count({ where: { organizacionId: ORG_ID } });
  console.log(`\n✓ Eliminados: ${res.count}. Quedan ${quedan} usuarios (deberían ser todos @cerpat.io).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
