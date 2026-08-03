// apps/api/src/vencimientos/generador.ts
// Generador de vencimientos NACIONALES de una empresa: cruza su
// ConfiguracionTributaria con el calendario oficial 2026 (embebido en
// calendario-2026.json) y el último dígito de su NIT.
//
// Nacionales: Retención, IVA, Consumo, Anticipo RST, Renta (PJ/GC/PN) y
// consolidadas RST. El ICA municipal NO se genera aquí.
//
// ⚠ Estas reglas replican prisma/vencimientos-generar.ts (el sembrador masivo
// que lee los CSV). Si cambia el mapeo config→calendario, actualiza ambos.

import { CALENDARIO_2026 as calendario } from './calendario-2026.js';

export const ANIO_CALENDARIO = calendario.anio;

// Config tributaria relevante para el cálculo (campos de ConfiguracionTributaria).
export type ConfigNacional = {
  ivaPeriodicidad: string | null;
  retencionFuente: boolean;
  fopat: boolean;
  consumoPeriodicidad: string | null;
  rentaTipo: string | null;
  anticipoRstPeriodicidad: string | null;
};

export type VencimientoNacional = {
  obligacion: string;
  periodicidad: string | null;
  periodo: string | null;
  fechaVencimiento: Date;
};

// ---- Grillas del calendario (se construyen una vez al importar) ----
const grid = new Map<string, { periodo: string; fecha: string }[]>();
for (const r of calendario.tributario) {
  const k = `${r.obligacion}|${r.periodicidad}|${r.ultimo_digito}`;
  (grid.get(k) ?? grid.set(k, []).get(k)!).push({ periodo: r.periodo, fecha: r.fecha_vencimiento });
}
const G = (ob: string, per: string, dig: string) => grid.get(`${ob}|${per}|${dig}`) ?? [];

const renta = new Map<string, { subtipo: string; fecha: string }[]>(); // (obligacion|rango)
const pnPorFin = new Map<string, string>(); // últimos 2 dígitos -> fecha (Renta PN)
for (const r of calendario.renta) {
  const k = `${r.obligacion}|${r.digito_o_rango}`;
  (renta.get(k) ?? renta.set(k, []).get(k)!).push({ subtipo: r.subtipo, fecha: r.fecha_vencimiento });
  if (r.obligacion === 'Renta Persona Natural') {
    const m = r.digito_o_rango.match(/^(\d{2})-(\d{2})$/);
    if (m) { pnPorFin.set(m[1], r.fecha_vencimiento); pnPorFin.set(m[2], r.fecha_vencimiento); }
  }
}
const R = (ob: string, rango: string) => renta.get(`${ob}|${rango}`) ?? [];

// Último dígito (antes del de verificación) y últimos dos dígitos del NIT.
function digitos(nit: string) {
  const base = (nit || '').split(/[-\s]/)[0].replace(/\D/g, '');
  return { uno: base.slice(-1), dos: base.slice(-2).padStart(2, '0') };
}
const par = (d: string) => (['1', '2'].includes(d) ? '1-2' : ['3', '4'].includes(d) ? '3-4' : ['5', '6'].includes(d) ? '5-6' : ['7', '8'].includes(d) ? '7-8' : '9-0');

// ---- Festivos de Colombia y n-ésimo día hábil (para FOPAT: 10º día hábil) ----
const pad2 = (n: number) => String(n).padStart(2, '0');
const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
function pascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mes - 1, dia));
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
// n-ésimo día hábil del mes (salta sábados, domingos y festivos de Colombia).
function nthDiaHabil(anio: number, mes1a12: number, n: number): Date {
  const fest = festivosColombia(anio);
  const d = new Date(Date.UTC(anio, mes1a12 - 1, 1));
  let cuenta = 0;
  while (d.getUTCMonth() === mes1a12 - 1) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !fest.has(isoUTC(d))) {
      cuenta++;
      if (cuenta === n) return new Date(d);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return new Date(Date.UTC(anio, mes1a12 - 1, 1)); // fallback (no debería ocurrir)
}

// Calcula los vencimientos nacionales que le corresponden a la empresa según su
// config y NIT. Función pura: no toca la base de datos.
export function vencimientosNacionales(cfg: ConfigNacional, nit: string): VencimientoNacional[] {
  const { uno, dos } = digitos(nit);
  const vs: VencimientoNacional[] = [];
  const push = (ob: string, per: string | null, items: { periodo?: string; subtipo?: string; fecha: string }[]) =>
    items.forEach((it) => vs.push({ obligacion: ob, periodicidad: per, periodo: it.periodo ?? it.subtipo ?? null, fechaVencimiento: new Date(it.fecha) }));

  if (cfg.retencionFuente) push('Retención en la fuente', 'Mensual', G('Retención en la fuente', 'Mensual', uno));
  // FOPAT (transporte): retención mensual. Vence el 10º día hábil del mes
  // siguiente al período (igual para todos, sin depender del NIT).
  if (cfg.fopat) {
    for (let m = 1; m <= 12; m++) {
      const dueAnio = m === 12 ? ANIO_CALENDARIO + 1 : ANIO_CALENDARIO;
      const dueMes = m === 12 ? 1 : m + 1;
      vs.push({ obligacion: 'FOPAT', periodicidad: 'Mensual', periodo: `${ANIO_CALENDARIO}-${pad2(m)}`, fechaVencimiento: nthDiaHabil(dueAnio, dueMes, 10) });
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
      if (f) vs.push({ obligacion: 'Renta Persona Natural', periodicidad: 'Anual', periodo: 'declaración y pago', fechaVencimiento: new Date(f) });
      break;
    }
  }
  return vs;
}
