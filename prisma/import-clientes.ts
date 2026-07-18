// prisma/import-clientes.ts
// Importa la base de clientes de CERPAT (prisma/data/clientes-cerpat.csv) a la
// tabla Empresa, bajo la organización demo (seed-org-cerpat). Idempotente: usa
// un id determinístico por NIT (o por nombre si no hay NIT), así que puede
// re-ejecutarse sin duplicar.
//
// Requiere que el esquema esté aplicado y el seed corrido antes (organización +
// catálogos). Ejecutar con:  npx tsx prisma/import-clientes.ts
//
// Nota de privacidad: este CSV contiene datos de clientes reales (NITs, correos).
// Vive en un repositorio privado por decisión explícita del equipo.

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';
// Ruta relativa al directorio de ejecución (en Railway Console = /app, la raíz
// del repo). Evita __dirname para funcionar igual en CJS y ESM bajo tsx.
const CSV_PATH = path.resolve(process.cwd(), 'prisma/data/clientes-cerpat.csv');

// Mapeos de los valores abreviados del CSV a los nombres de catálogo del seed.
const REGIMEN_MAP: Record<string, string> = {
  'regimen ord.': 'Régimen Ordinario',
  'regimen ord': 'Régimen Ordinario',
  'rst': 'Régimen Simple de Tributación (RST)',
  'regimen especial': 'Régimen Especial',
};
const TIPO_MAP: Record<string, string> = {
  nit: 'Persona Jurídica',
  cc: 'Persona Natural',
};

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

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const nn = (s: string | undefined) => { const v = (s || '').trim(); return v.length ? v : null; };

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(raw);
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const data = rows.slice(1).filter((r) => (r[idx('nombre')] || '').trim());

  // Catálogos para resolver FKs (por organización).
  const tipos = await prisma.tipoEmpresa.findMany({ where: { organizacionId: ORG_ID } });
  const regimenes = await prisma.regimenTributario.findMany({ where: { organizacionId: ORG_ID } });
  const tipoIdByName = new Map(tipos.map((t) => [t.nombre, t.id]));
  const regimenIdByName = new Map(regimenes.map((r) => [r.nombre, r.id]));

  let creados = 0, actualizados = 0;
  const regimenesNoMapeados = new Set<string>();

  for (const r of data) {
    const tipoCsv = (r[idx('tipo')] || '').trim();
    const nit = nn(r[idx('nit')]);
    const nombre = (r[idx('nombre')] || '').trim();
    const regimenCsv = (r[idx('regimen')] || '').trim();

    const tipoNombre = TIPO_MAP[tipoCsv.toLowerCase()];
    const regimenNombre = REGIMEN_MAP[regimenCsv.toLowerCase()];
    if (regimenCsv && !regimenNombre) regimenesNoMapeados.add(regimenCsv);

    const id = nit ? `cli-nit-${nit}` : `cli-${slug(nombre)}`;
    const payload = {
      organizacionId: ORG_ID,
      nombre,
      nit,
      tipoId: tipoNombre ? tipoIdByName.get(tipoNombre) ?? null : null,
      regimenId: regimenNombre ? regimenIdByName.get(regimenNombre) ?? null : null,
      servicio: nn(r[idx('servicio')]),
      asesorNombre: nn(r[idx('asesor')]),
      emailRepresentante: nn(r[idx('emailRepresentante')]),
      emailAdministracion: nn(r[idx('emailAdministracion')]),
      emailContabilidad: nn(r[idx('emailContabilidad')]),
      emailTalentoHumano: nn(r[idx('emailTalentoHumano')]),
      emailTesoreria: nn(r[idx('emailTesoreria')]),
    };

    const existing = await prisma.empresa.findUnique({ where: { id } });
    await prisma.empresa.upsert({ where: { id }, update: payload, create: { id, ...payload } });
    if (existing) actualizados++; else creados++;
  }

  console.log(`✓ Importación de clientes completada. Creados: ${creados}, actualizados: ${actualizados}, total en CSV: ${data.length}.`);
  if (regimenesNoMapeados.size) {
    console.log('  Regímenes sin mapear (quedaron sin FK):', Array.from(regimenesNoMapeados).join(', '));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
