// Otorga (o quita) el rol ROOT de plataforma a una cuenta, por correo.
// Requiere DATABASE_URL con acceso a la base.
//
//   npx tsx prisma/set-root.ts gerencia@cerpat.io          → otorga
//   npx tsx prisma/set-root.ts gerencia@cerpat.io --quitar → revoca
//
// Alternativa sin acceso a la base: variable PROMOVER_ROOT_EMAIL en Railway
// (ver apps/api/src/bootstrap-root.ts).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  const quitar = process.argv.includes('--quitar');
  if (!email) {
    console.error('Uso: npx tsx prisma/set-root.ts <correo> [--quitar]');
    process.exit(1);
  }

  const usuario = await prisma.usuario.findFirst({
    where: { email },
    select: { id: true, nombre: true, email: true, esRootPlataforma: true },
  });
  if (!usuario) {
    console.error(`No existe ningún usuario con el correo "${email}".`);
    process.exit(1);
  }

  const valor = !quitar;
  if (usuario.esRootPlataforma === valor) {
    console.log(`Sin cambios: "${usuario.email}" ya ${valor ? 'es' : 'no es'} root de plataforma.`);
  } else {
    await prisma.usuario.update({ where: { id: usuario.id }, data: { esRootPlataforma: valor, ...(valor ? { activo: true } : {}) } });
    console.log(`${valor ? '✅ Otorgado' : '⛔ Revocado'}: "${usuario.email}" (${usuario.nombre}).`);
  }

  const roots = await prisma.usuario.findMany({ where: { esRootPlataforma: true }, select: { email: true } });
  console.log('Root de plataforma ahora:', roots.map((r) => r.email).join(', ') || '(ninguno)');
}

main().finally(() => prisma.$disconnect());
