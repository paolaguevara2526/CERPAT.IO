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

// Festivos de Colombia + n-ésimo día hábil (para FOPAT: 10º día hábil).
const pad2 = (n: number) => String(n).padStart(2, '0');
const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
function pascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(Date.UTC(y, Math.floor((h + l - 7 * mm + 114) / 31) - 1, ((h + l - 7 * mm + 114) % 31) + 1));
}
function proximoLunes(d: Date): Date {
  const r = new Date(d), dow = r.getUTCDay();
  r.setUTCDate(r.getUTCDate() + (dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow));
  return r;
}
function festivosColombia(y: number): Set<string> {
  const s = new Set<string>();
  const fijo = (mo: number, da: number) => s.add(`${y}-${pad2(mo)}-${pad2(da)}`);
  const emiliani = (mo: number, da: number) => s.add(isoUTC(proximoLunes(new Date(Date.UTC(y, mo - 1, da)))));
  fijo(1, 1); fijo(5, 1); fijo(7, 20); fijo(8, 7); fijo(12, 8); fijo(12, 25);
  emiliani(1, 6); emiliani(3, 19); emiliani(6, 29); emiliani(8, 15); emiliani(10, 12); emiliani(11, 1); emiliani(11, 11);
  const p = pascua(y);
  const rel = (off: number) => { const d = new Date(p); d.setUTCDate(d.getUTCDate() + off); return isoUTC(d); };
  s.add(rel(-3)); s.add(rel(-2)); s.add(rel(43)); s.add(rel(64)); s.add(rel(71));
  return s;
}
function nthDiaHabil(anio: number, mes1a12: number, n: number): string {
  const fest = festivosColombia(anio);
  const d = new Date(Date.UTC(anio, mes1a12 - 1, 1));
  let cuenta = 0;
  while (d.getUTCMonth() === mes1a12 - 1) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !fest.has(isoUTC(d))) { cuenta++; if (cuenta === n) return isoUTC(d); }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return isoUTC(new Date(Date.UTC(anio, mes1a12 - 1, 1)));
}

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
    // FOPAT (transporte): mensual, vence el 10º día hábil del mes siguiente.
    if (cfg.fopat) {
      for (let mth = 1; mth <= 12; mth++) {
        const dueAnio = mth === 12 ? ANIO + 1 : ANIO;
        const dueMes = mth === 12 ? 1 : mth + 1;
        vs.push({ obligacion: 'FOPAT', periodicidad: 'Mensual', periodo: `${ANIO}-${pad2(mth)}`, fecha: nthDiaHabil(dueAnio, dueMes, 10) });
      }
    }
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
  console.log('  Nota: el ICA municipal NO se genera aquí. Se genera por cliente con el botón');
  console.log('        "Regenerar vencimientos" (POST /vencimientos/regenerar/:empresaId), que');
  console.log('        cruza lo marcado por municipio con calendario-ica-municipal-2026.csv.');
  if (sinNit.length) console.log(`  ⚠ Sin NIT (omitidas): ${sinNit.length}`, sinNit.slice(0, 5));
}

// Solo resetea los vencimientos NACIONALES (municipioId=null). El ICA municipal
// (municipioId≠null) se gestiona por cliente desde la API y no se toca aquí,
// para no borrar lo generado con el botón "Regenerar vencimientos".
async function reset() {
  const r = await prisma.vencimientoEmpresa.deleteMany({ where: { organizacionId: ORG_ID, anio: ANIO, generado: true, municipioId: null } });
  if (r.count) console.log(`  (borrados ${r.count} vencimientos nacionales generados previos del ${ANIO})`);
}

reset()
  .then(main)
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
