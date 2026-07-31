// prisma/vencimientos-generar.ts
// Genera los vencimientos del año de cada empresa cruzando su ConfiguracionTributaria
// con el calendario oficial (docs/data/calendario-*.csv) y el último dígito de su NIT.
// Nacionales: Retención, IVA, Consumo, Anticipo RST, Renta (PJ/GC/PN) y consolidadas RST.
// ICA municipal queda pendiente (requiere los calendarios por municipio).
//
// Idempotente: borra los vencimientos generados del año y los vuelve a crear.
// Ejecutar (después de import-vencimientos-config) con:
//   npx tsx prisma/vencimientos-generar.ts

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';
const ANIO = 2026;

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const objs = (file: string) => {
  const filas = parseCSV(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')).filter((r) => r.some((c) => c.trim() !== ''));
  const head = filas[0].map((h) => h.trim());
  return filas.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])) as Record<string, string>);
};

// Último dígito (antes del de verificación) y últimos dos dígitos.
function digitos(nit: string) {
  const base = (nit || '').split(/[-\s]/)[0].replace(/\D/g, '');
  return { uno: base.slice(-1), dos: base.slice(-2).padStart(2, '0') };
}
const par = (d: string) => (['1', '2'].includes(d) ? '1-2' : ['3', '4'].includes(d) ? '3-4' : ['5', '6'].includes(d) ? '5-6' : ['7', '8'].includes(d) ? '7-8' : '9-0');

type V = { obligacion: string; periodicidad: string | null; periodo: string | null; fecha: string };

async function main() {
  // ---- Calendario general (grilla por último dígito) ----
  const grid = new Map<string, { periodo: string; fecha: string }[]>();
  for (const r of objs('docs/data/calendario-tributario-2026.csv')) {
    const k = `${r.obligacion}|${r.periodicidad}|${r.ultimo_digito}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push({ periodo: r.periodo, fecha: r.fecha_vencimiento });
  }
  const G = (ob: string, per: string, dig: string) => grid.get(`${ob}|${per}|${dig}`) ?? [];

  // ---- Calendario Renta + consolidadas ----
  const renta = new Map<string, { subtipo: string; fecha: string }[]>(); // por (obligacion|rango)
  const pnPorFin = new Map<string, string>(); // últimos 2 dígitos -> fecha (Renta PN)
  for (const r of objs('docs/data/calendario-renta-consolidadas-2026.csv')) {
    const k = `${r.obligacion}|${r.digito_o_rango}`;
    (renta.get(k) ?? renta.set(k, []).get(k)!).push({ subtipo: r.subtipo, fecha: r.fecha_vencimiento });
    if (r.obligacion === 'Renta Persona Natural') {
      const m = r.digito_o_rango.match(/^(\d{2})-(\d{2})$/);
      if (m) { pnPorFin.set(m[1], r.fecha_vencimiento); pnPorFin.set(m[2], r.fecha_vencimiento); }
    }
  }
  const R = (ob: string, rango: string) => renta.get(`${ob}|${rango}`) ?? [];

  // ---- Empresas con configuración ----
  const empresas = await prisma.empresa.findMany({
    where: { organizacionId: ORG_ID, configuracionTributaria: { isNot: null } },
    select: { id: true, nombre: true, nit: true, configuracionTributaria: true },
  });

  let creados = 0;
  const sinNit: string[] = [];
  for (const e of empresas) {
    const cfg = e.configuracionTributaria!;
    if (!e.nit) { sinNit.push(e.nombre); continue; }
    const { uno, dos } = digitos(e.nit);
    const vs: V[] = [];
    const push = (ob: string, per: string | null, items: { periodo?: string; subtipo?: string; fecha: string }[]) =>
      items.forEach((it) => vs.push({ obligacion: ob, periodicidad: per, periodo: it.periodo ?? it.subtipo ?? null, fecha: it.fecha }));

    if (cfg.retencionFuente) push('Retención en la fuente', 'Mensual', G('Retención en la fuente', 'Mensual', uno));
    if (cfg.ivaPeriodicidad === 'bimestral') push('IVA', 'Bimestral', G('IVA', 'Bimestral', uno));
    else if (cfg.ivaPeriodicidad === 'cuatrimestral') push('IVA', 'Cuatrimestral', G('IVA', 'Cuatrimestral', uno));
    else if (cfg.ivaPeriodicidad === 'anual_rst') push('IVA consolidado RST', 'Anual', R('RST consolidado IVA', par(uno)));
    if (cfg.consumoPeriodicidad === 'bimestral') push('Impuesto al consumo', 'Bimestral', G('Impuesto al consumo', 'Bimestral', uno));
    if (cfg.anticipoRstPeriodicidad === 'bimestral') push('Anticipo RST', 'Bimestral', G('Anticipo Régimen Simple', 'Bimestral', uno));

    switch (cfg.rentaTipo) {
      case 'persona_juridica': push('Renta Persona Jurídica', 'Anual', R('Renta Persona Jurídica', uno)); break;
      case 'gran_contribuyente': push('Renta Grandes Contribuyentes', 'Anual', R('Renta Grandes Contribuyentes', uno)); break;
      case 'rst_consolidada': push('RST consolidada Renta', 'Anual', R('RST consolidada Renta', par(uno))); break;
      case 'persona_natural': {
        const f = pnPorFin.get(dos);
        if (f) vs.push({ obligacion: 'Renta Persona Natural', periodicidad: 'Anual', periodo: 'declaración y pago', fecha: f });
        break;
      }
    }

    if (vs.length) {
      await prisma.vencimientoEmpresa.createMany({
        data: vs.map((v) => ({ organizacionId: ORG_ID, empresaId: e.id, anio: ANIO, obligacion: v.obligacion, periodicidad: v.periodicidad, periodo: v.periodo, fechaVencimiento: new Date(v.fecha) })),
      });
      creados += vs.length;
    }
  }

  console.log(`✓ Vencimientos ${ANIO} generados: ${creados} (para ${empresas.length} empresas con configuración).`);
  console.log('  Nota: ICA municipal pendiente (requiere calendarios por municipio).');
  if (sinNit.length) console.log(`  ⚠ Sin NIT (omitidas): ${sinNit.length}`, sinNit.slice(0, 5));
}

async function reset() {
  const r = await prisma.vencimientoEmpresa.deleteMany({ where: { organizacionId: ORG_ID, anio: ANIO, generado: true } });
  if (r.count) console.log(`  (borrados ${r.count} vencimientos generados previos del ${ANIO})`);
}

reset()
  .then(main)
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
