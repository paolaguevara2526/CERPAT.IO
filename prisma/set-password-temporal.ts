// prisma/set-password-temporal.ts
// Asigna una contraseña TEMPORAL (con hash scrypt) a todos los usuarios activos
// de la organización y marca debeCambiarPassword=true (deben cambiarla al entrar).
//
// No pisa contraseñas que ya fueron cambiadas por el usuario (solo actúa sobre
// las que aún no tienen hash scrypt válido). Idempotente.
//
// Uso:  npx tsx prisma/set-password-temporal.ts [ContraseñaTemporal]
//       (si no se pasa, usa TEMP_PASSWORD o el valor por defecto)

import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const temp = process.argv[2] || process.env.TEMP_PASSWORD || 'Cerpat2026*';
  if (temp.length < 8) throw new Error('La contraseña temporal debe tener al menos 8 caracteres.');

  const users = await prisma.usuario.findMany({ where: { organizacionId: ORG_ID, activo: true } });
  let asignadas = 0, respetadas = 0;
  for (const u of users) {
    // No pisar a quien ya tiene una contraseña real (scrypt) puesta por sí mismo.
    if (u.passwordHash && u.passwordHash.startsWith('scrypt$') && !u.debeCambiarPassword) { respetadas++; continue; }
    await prisma.usuario.update({ where: { id: u.id }, data: { passwordHash: hashPassword(temp), debeCambiarPassword: true } });
    asignadas++;
  }

  console.log(`✓ Contraseña temporal asignada a ${asignadas} usuarios (respetadas ${respetadas} ya cambiadas).`);
  console.log(`  Usuarios activos: ${users.length}`);
  console.log(`  Contraseña temporal: ${temp}  (deben cambiarla al ingresar)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
