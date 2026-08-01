// prisma/import-municipios.ts
// Carga el catálogo de municipios de Colombia (prisma/data/municipios-colombia.csv)
// a la tabla Municipio, bajo la organización demo (seed-org-cerpat). Idempotente:
// no duplica (empareja por nombre + departamento).
//
// Ejecutar con:  npx tsx prisma/import-municipios.ts

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';
const CSV_PATH = path.resolve(process.cwd(), 'prisma/data/municipios-colombia.csv');

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const key = (nombre: string, depto: string) => `${nombre.trim().toLowerCase()}|${depto.trim().toLowerCase()}`;

async function main() {
  const filas = parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).slice(1).filter((r) => r[1]?.trim());

  const existentes = await prisma.municipio.findMany({ where: { organizacionId: ORG_ID }, select: { nombre: true, departamento: true } });
  const yaHay = new Set(existentes.map((m) => key(m.nombre, m.departamento)));

  const nuevos = [];
  for (const r of filas) {
    const orden = Number(r[0]) || 0;
    const nombre = r[1].trim();
    const departamento = (r[2] || '').trim();
    if (yaHay.has(key(nombre, departamento))) continue;
    yaHay.add(key(nombre, departamento));
    nuevos.push({ organizacionId: ORG_ID, nombre, departamento, orden });
  }

  if (nuevos.length) await prisma.municipio.createMany({ data: nuevos });
  const total = await prisma.municipio.count({ where: { organizacionId: ORG_ID } });
  console.log(`✓ Municipios: creados ${nuevos.length}, ya existían ${filas.length - nuevos.length}. Total en catálogo: ${total}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
