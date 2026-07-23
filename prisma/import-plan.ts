// prisma/import-plan.ts
// Importa el catálogo base del Plan de Trabajo (docs/data/plan-trabajo-actividades.csv)
// a la tabla ActividadPlan, bajo la organización demo (seed-org-cerpat), enlazando
// cada actividad a su Área. Idempotente: upsert por (organizacionId, codigo).
//
// Requiere el esquema aplicado y el seed corrido antes (organización + áreas).
// Ejecutar con:  npx tsx prisma/import-plan.ts

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';
const CSV_PATH = path.resolve(process.cwd(), 'docs/data/plan-trabajo-actividades.csv');

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

const nn = (s: string | undefined) => { const v = (s || '').trim(); return v.length ? v : null; };

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(raw);
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const data = rows.slice(1).filter((r) => (r[idx('codigo')] || '').trim());

  // Mapa de áreas (nombre -> id) de la organización.
  const areas = await prisma.area.findMany({ where: { organizacionId: ORG_ID } });
  const areaIdByName = new Map(areas.map((a) => [a.nombre, a.id]));

  let creadas = 0, actualizadas = 0;
  const areasFaltantes = new Set<string>();

  for (const [i, r] of data.entries()) {
    const codigo = (r[idx('codigo')] || '').trim();
    const areaNombre = (r[idx('area')] || '').trim();
    const areaId = areaNombre ? areaIdByName.get(areaNombre) ?? null : null;
    if (areaNombre && !areaId) areasFaltantes.add(areaNombre);

    const payload = {
      organizacionId: ORG_ID,
      areaId,
      grupo: nn(r[idx('grupo')]),
      nombre: (r[idx('actividad')] || '').trim(),
      descripcion: nn(r[idx('descripcion')]),
      documentoFormato: nn(r[idx('documento_formato')]),
      periodicidad: nn(r[idx('periodicidad_sugerida')]),
      esRegistroSoftware: (r[idx('es_registro_software')] || '').trim().toLowerCase() === 'sí'
        || (r[idx('es_registro_software')] || '').trim().toLowerCase() === 'si',
      orden: i + 1,
    };

    const existing = await prisma.actividadPlan.findUnique({
      where: { organizacionId_codigo: { organizacionId: ORG_ID, codigo } },
    });
    await prisma.actividadPlan.upsert({
      where: { organizacionId_codigo: { organizacionId: ORG_ID, codigo } },
      update: payload,
      create: { codigo, ...payload },
    });
    if (existing) actualizadas++; else creadas++;
  }

  console.log(`✓ Catálogo del plan importado. Creadas: ${creadas}, actualizadas: ${actualizadas}, total: ${data.length}.`);
  if (areasFaltantes.size) {
    console.log('  Áreas del CSV sin coincidencia (corre el seed primero):', Array.from(areasFaltantes).join(', '));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
