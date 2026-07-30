// prisma/roles-sync.ts
//
// Asegura que existan todos los roles de la organización (idempotente). Se usa
// para agregar roles nuevos sin re-sembrar la base — p. ej. "Cliente" para el
// Portal de Hallazgos (Revisoría Fiscal). Correr:  npm run db:roles-sync

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_SLUG = 'cerpat';
const ROLES = ['Administrador', 'Coordinador', 'Asesor', 'Auditor', 'Auxiliar', 'Cliente'];

async function main() {
  const org = await prisma.organizacion.findFirst({ where: { slug: ORG_SLUG }, select: { id: true } });
  if (!org) throw new Error(`No existe la organización "${ORG_SLUG}".`);

  let creados = 0;
  for (const nombre of ROLES) {
    const existe = await prisma.rol.findFirst({ where: { organizacionId: org.id, nombre } });
    if (!existe) {
      await prisma.rol.create({ data: { organizacionId: org.id, nombre } });
      creados++;
      console.log(`+ Rol creado: ${nombre}`);
    }
  }
  console.log(`Roles sincronizados: ${creados} creado(s) de ${ROLES.length}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
