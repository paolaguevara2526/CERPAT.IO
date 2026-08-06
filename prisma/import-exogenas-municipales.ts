// prisma/import-exogenas-municipales.ts
// Carga los vencimientos de EXÓGENA MUNICIPAL (información en medios magnéticos)
// por cliente y municipio, desde docs/data/exogenas-municipales-2026.csv.
//
// Cada fila crea un VencimientoEmpresa "agregado a mano" (generado=false) con:
//   obligacion = "Exógena municipal (medios magnéticos)"
//   municipioId = municipio de la fila · fechaVencimiento = fecha de la fila
// Así aparece en Vencimientos y en el Calendario (fuente municipal, con su fecha).
//
// Empareja el cliente por NIT (id determinístico cli-nit-<NIT>) y el municipio por
// nombre + departamento contra el catálogo (cat_municipios). Es IDEMPOTENTE: no
// duplica (misma empresa · misma obligación · mismo municipio · mismo año).
//
// Por seguridad corre en SECO por defecto (solo muestra el plan). Para escribir
// de verdad en la base:
//   npx tsx prisma/import-exogenas-municipales.ts --apply

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';
const ANIO = 2026;
const OBLIGACION = 'Exógena municipal (medios magnéticos)';
const PERIODICIDAD = 'Anual';
const CSV_PATH = path.resolve(process.cwd(), 'docs/data/exogenas-municipales-2026.csv');
const APLICAR = process.argv.includes('--apply');

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

const norm = (s: string) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Alias de municipios cuyo nombre/departamento del Excel difiere del catálogo.
// Clave: `${normNombre}|${normDepto}` del Excel → nombre/depto del catálogo.
const ALIAS: Record<string, { nombre: string; departamento: string }> = {
  'bogota|d.c.': { nombre: 'Bogotá, D.C.', departamento: 'Bogotá, D.C.' },
  'cartagena|bolivar': { nombre: 'Cartagena De Indias', departamento: 'Bolívar' },
};

async function main() {
  const filas = parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).slice(1).filter((r) => (r[1] || '').trim() && (r[4] || '').trim());
  console.log(`Leídas ${filas.length} filas de ${path.relative(process.cwd(), CSV_PATH)}.`);

  // Empresas por NIT (id determinístico cli-nit-<NIT>).
  const nits = [...new Set(filas.map((r) => r[1].trim()))];
  const empresas = await prisma.empresa.findMany({ where: { organizacionId: ORG_ID, id: { in: nits.map((n) => `cli-nit-${n}`) } }, select: { id: true, nombre: true } });
  const empresaPorId = new Map(empresas.map((e) => [e.id, e]));

  // Municipios del catálogo → índices por (nombre|depto) y por nombre.
  const munis = await prisma.municipio.findMany({ where: { organizacionId: ORG_ID }, select: { id: true, nombre: true, departamento: true } });
  const porNombreDepto = new Map(munis.map((m) => [`${norm(m.nombre)}|${norm(m.departamento)}`, m]));
  const porNombre = new Map<string, typeof munis>();
  for (const m of munis) { const k = norm(m.nombre); (porNombre.get(k) ?? porNombre.set(k, []).get(k)!).push(m); }

  const resolverMunicipio = (municipio: string, departamento: string) => {
    const target = ALIAS[`${norm(municipio)}|${norm(departamento)}`] ?? { nombre: municipio, departamento };
    const exacto = porNombreDepto.get(`${norm(target.nombre)}|${norm(target.departamento)}`);
    if (exacto) return exacto;
    const soloNombre = porNombre.get(norm(target.nombre)) ?? [];
    return soloNombre.length === 1 ? soloNombre[0] : null;
  };

  // Vencimientos de exógena ya existentes (para no duplicar).
  const existentes = await prisma.vencimientoEmpresa.findMany({ where: { organizacionId: ORG_ID, anio: ANIO, obligacion: OBLIGACION }, select: { empresaId: true, municipioId: true } });
  const yaHay = new Set(existentes.map((v) => `${v.empresaId}|${v.municipioId}`));

  const aCrear: { organizacionId: string; empresaId: string; anio: number; obligacion: string; periodicidad: string; municipioId: string; fechaVencimiento: Date; generado: boolean }[] = [];
  const problemas: string[] = [];
  let duplicados = 0;

  for (const r of filas) {
    const nit = r[1].trim();
    const empresaId = `cli-nit-${nit}`;
    const empresa = empresaPorId.get(empresaId);
    const municipioTxt = r[4].trim();
    const departamentoTxt = r[5].trim();
    const fechaTxt = r[6].trim();
    if (!empresa) { problemas.push(`‼ Cliente no encontrado: NIT ${nit} (${r[2]})`); continue; }
    const muni = resolverMunicipio(municipioTxt, departamentoTxt);
    if (!muni) { problemas.push(`‼ Municipio no encontrado: ${municipioTxt} / ${departamentoTxt} (${empresa.nombre})`); continue; }
    const fecha = new Date(`${fechaTxt}T00:00:00.000Z`);
    if (isNaN(fecha.getTime())) { problemas.push(`‼ Fecha inválida: ${fechaTxt} (${empresa.nombre} · ${municipioTxt})`); continue; }
    if (yaHay.has(`${empresaId}|${muni.id}`)) { duplicados++; continue; }
    yaHay.add(`${empresaId}|${muni.id}`); // evita duplicar dentro del mismo CSV
    aCrear.push({ organizacionId: ORG_ID, empresaId, anio: ANIO, obligacion: OBLIGACION, periodicidad: PERIODICIDAD, municipioId: muni.id, fechaVencimiento: fecha, generado: false });
    console.log(`  + ${empresa.nombre}  ·  ${muni.nombre} (${muni.departamento})  ·  ${fechaTxt}`);
  }

  console.log(`\nResumen: ${aCrear.length} por crear · ${duplicados} ya existían · ${problemas.length} con problema.`);
  if (problemas.length) { console.log('\nProblemas (no se crean):'); problemas.forEach((p) => console.log('  ' + p)); }

  if (!APLICAR) {
    console.log('\n(SECO) No se escribió nada. Repite con  --apply  para crear los vencimientos.');
    return;
  }
  if (problemas.length) {
    console.log('\n⛔ Hay filas con problema; corrígelas antes de aplicar. No se escribió nada.');
    process.exit(1);
  }
  if (aCrear.length) await prisma.vencimientoEmpresa.createMany({ data: aCrear });
  console.log(`\n✓ Creados ${aCrear.length} vencimientos de exógena municipal ${ANIO}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
