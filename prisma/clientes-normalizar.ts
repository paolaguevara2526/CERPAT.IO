// prisma/clientes-normalizar.ts
// Normaliza el nombre de las empresas (clientes) a formato "Título": primera
// letra de cada palabra en mayúscula, respetando siglas (SAS, S.A.S, IPS,
// LTDA, HS, EGR…) y dejando conectores en minúscula (de, la, y…).
//
// Idempotente: solo actualiza los que cambian; imprime el antes → después.
// Ejecutar con:  npx tsx prisma/clientes-normalizar.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

const ACRONYMS = new Set(['SAS','S.A.S','S.A.S.','SA','S.A','S.A.','LTDA','LTDA.','EU','E.U','E.U.','IPS','EPS','ESP','ESE','E.S.E','E.S.E.','ESAL','ZOMAC','EGR','HS','AP','CI','POS','NIT','SCA','SCS','SC','AZ','MV2']);
const CONN = new Set(['de','del','la','las','los','el','y','e','en','a','con','para','o','u']);
const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('es') + s.slice(1).toLocaleLowerCase('es') : s);
function fixTok(tok: string, first: boolean): string {
  if (!tok) return tok;
  const up = tok.toLocaleUpperCase('es');
  if (ACRONYMS.has(up)) return up;
  if (!first && CONN.has(tok.toLocaleLowerCase('es'))) return tok.toLocaleLowerCase('es');
  if (/[0-9&]/.test(tok)) return up; // MV2, B&B, J&S, 2.0, SUR3
  return cap(tok);
}
export function titleCaseNombre(name: string): string {
  return name.trim().replace(/\s+/g, ' ').split(' ')
    .map((w, wi) => w.split('-').map((p, pi) => fixTok(p, wi === 0 && pi === 0)).join('-'))
    .join(' ');
}

async function main() {
  const empresas = await prisma.empresa.findMany({ where: { organizacionId: ORG_ID }, select: { id: true, nombre: true } });
  let cambiados = 0;
  for (const e of empresas) {
    const nuevo = titleCaseNombre(e.nombre);
    if (nuevo !== e.nombre) {
      await prisma.empresa.update({ where: { id: e.id }, data: { nombre: nuevo } });
      console.log(`  ${e.nombre}  →  ${nuevo}`);
      cambiados++;
    }
  }
  console.log(`\n✓ Nombres normalizados. Cambiados: ${cambiados} de ${empresas.length}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
