// prisma/import-vencimientos-config.ts
// Carga la configuración tributaria por cliente (diligenciada por el equipo):
//   - prisma/data/config-vencimientos-empresas.csv  -> ConfiguracionTributaria
//     (crea la empresa si no existe, p. ej. las nuevas fuera de producción).
//   - prisma/data/config-vencimientos-ica.csv       -> EmpresaMunicipioIca
//     (empareja municipio por nombre + departamento; resuelve homónimos con la
//      inicial del departamento, p. ej. "Villanueva C" = Villanueva, Casanare).
// Idempotente: empareja empresas por NIT y hace upsert de la configuración.
//
// Ejecutar con:  npx tsx prisma/import-vencimientos-config.ts

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

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
function rowsToObjects(csv: string): Record<string, string>[] {
  const filas = parseCSV(csv).filter((r) => r.some((c) => c.trim() !== ''));
  const head = filas[0].map((h) => h.trim());
  return filas.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const norm = (s: string) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nn = (s: string) => { const v = (s || '').trim(); return v.length ? v : null; };

// Normalizadores de los valores del formulario a los códigos del esquema.
const IVA: Record<string, string | null> = { 'bimestral': 'bimestral', 'cuatrimestral': 'cuatrimestral', 'anual (rst)': 'anual_rst', 'no responsable': 'no_responsable' };
const CONSUMO: Record<string, string | null> = { 'bimestral': 'bimestral', 'anual (rst)': 'anual_rst', 'no': null };
const RENTA: Record<string, string | null> = { 'persona juridica': 'persona_juridica', 'persona natural': 'persona_natural', 'gran contribuyente': 'gran_contribuyente', 'rst (consolidada)': 'rst_consolidada', 'n/a': null };
const ANTICIPO: Record<string, string | null> = { 'bimestral': 'bimestral', 'no': null };
const ICA: Record<string, string | null> = { 'anual': 'anual', 'bimestral': 'bimestral', 'mensual': 'mensual' };
const REGIMEN_CAT: Record<string, string> = { 'ordinario': 'Régimen Ordinario', 'rst': 'Régimen Simple de Tributación (RST)', 'especial': 'Régimen Especial' };
const map = (m: Record<string, string | null>, v: string) => (norm(v) in m ? m[norm(v)] : null);
const si = (v: string) => norm(v) === 'si';

async function main() {
  // Catálogos de apoyo
  const regimenes = await prisma.regimenTributario.findMany({ where: { organizacionId: ORG_ID }, select: { id: true, nombre: true } });
  const regimenId = new Map(regimenes.map((r) => [r.nombre, r.id]));

  // Índice de empresas por NIT
  const empresas = await prisma.empresa.findMany({ where: { organizacionId: ORG_ID }, select: { id: true, nit: true } });
  const empByNit = new Map<string, string>();
  for (const e of empresas) if (e.nit) empByNit.set(e.nit.trim(), e.id);

  // Índice de municipios: por (nombre+depto) y por (base+depto) para homónimos
  const municipios = await prisma.municipio.findMany({ where: { organizacionId: ORG_ID }, select: { id: true, nombre: true, departamento: true } });
  const muniByFull = new Map<string, string>();
  const muniByBaseDepto = new Map<string, string>();
  for (const m of municipios) {
    muniByFull.set(`${norm(m.nombre)}|${norm(m.departamento)}`, m.id);
    muniByBaseDepto.set(`${norm(m.nombre)}|${norm(m.departamento)}`, m.id);
  }
  // Resuelve el municipio de una fila ICA: intenta nombre completo; si trae una
  // inicial de desambiguación al final ("Villanueva C"), la quita y usa el depto.
  const resolverMunicipio = (nombre: string, depto: string): string | null => {
    const d = norm(depto);
    const full = muniByFull.get(`${norm(nombre)}|${d}`);
    if (full) return full;
    const base = nombre.trim().replace(/\s+[A-Za-zÁÉÍÓÚÑ]{1,2}$/, ''); // quita sufijo tipo " C" / " VC"
    return muniByBaseDepto.get(`${norm(base)}|${d}`) ?? null;
  };

  // ---- Empresas + configuración nacional ----
  const emp = rowsToObjects(fs.readFileSync(path.resolve(process.cwd(), 'prisma/data/config-vencimientos-empresas.csv'), 'utf8'));
  let creadas = 0, configuradas = 0;
  const vistos = new Set<string>();
  for (const r of emp) {
    const nit = r['nit']?.trim();
    if (!nit || vistos.has(nit)) continue; // primera aparición gana (NIT duplicado)
    vistos.add(nit);
    let empresaId = empByNit.get(nit);
    if (!empresaId) {
      const nueva = await prisma.empresa.create({
        data: { organizacionId: ORG_ID, nombre: r['empresa']?.trim() || nit, nit, activo: true, regimenId: regimenId.get(REGIMEN_CAT[norm(r['regimen'])]) ?? null },
        select: { id: true },
      });
      empresaId = nueva.id; empByNit.set(nit, empresaId); creadas++;
    }
    const data = {
      ivaPeriodicidad: map(IVA, r['iva']),
      retencionFuente: si(r['retencion_fuente']),
      consumoPeriodicidad: map(CONSUMO, r['consumo']),
      rentaTipo: map(RENTA, r['renta']),
      anticipoRstPeriodicidad: map(ANTICIPO, r['anticipo_rst']),
    };
    await prisma.configuracionTributaria.upsert({
      where: { empresaId },
      create: { organizacionId: ORG_ID, empresaId, ...data },
      update: data,
    });
    configuradas++;
  }

  // ---- ICA por municipio ----
  const ica = rowsToObjects(fs.readFileSync(path.resolve(process.cwd(), 'prisma/data/config-vencimientos-ica.csv'), 'utf8'));
  let icaOk = 0; const sinEmpresa: string[] = []; const sinMunicipio: string[] = [];
  for (const r of ica) {
    const nit = r['nit']?.trim();
    const empresaId = nit ? empByNit.get(nit) : undefined;
    if (!empresaId) { sinEmpresa.push(`${nit} ${r['empresa']}`); continue; }
    const municipioId = resolverMunicipio(r['municipio'], r['departamento']);
    if (!municipioId) { sinMunicipio.push(`${r['municipio']} (${r['departamento']})`); continue; }
    const data = {
      icaPeriodicidad: map(ICA, r['periodicidad_ica']),
      reteica: si(r['reteica']), reteicaPeriodicidad: nn(r['periodicidad_reteica']),
      autoica: si(r['autoica']), autoicaPeriodicidad: nn(r['periodicidad_autoica']),
    };
    await prisma.empresaMunicipioIca.upsert({
      where: { empresaId_municipioId: { empresaId, municipioId } },
      create: { organizacionId: ORG_ID, empresaId, municipioId, ...data },
      update: data,
    });
    icaOk++;
  }

  console.log(`✓ Empresas: creadas ${creadas}, configuradas ${configuradas}.`);
  console.log(`✓ ICA: cargadas ${icaOk} de ${ica.length}.`);
  if (sinMunicipio.length) console.log(`  ⚠ Municipios no resueltos (${sinMunicipio.length}):`, [...new Set(sinMunicipio)].slice(0, 20));
  if (sinEmpresa.length) console.log(`  ⚠ Filas ICA sin empresa (${sinEmpresa.length}):`, [...new Set(sinEmpresa)].slice(0, 10));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
