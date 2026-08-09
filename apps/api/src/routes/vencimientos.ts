// apps/api/src/routes/vencimientos.ts
// Vencimientos tributarios generados por empresa (config × calendario × NIT).
// Lectura: cualquier usuario de la firma. Edición (estado, fecha, notas): solo
// Administrador / root por ahora (más adelante, permisos por rol).

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';
import { alcancePortal, empresasAsignadas } from '../auth/alcance-db.js';
import { esStaffAcotado } from '../auth/alcance.js';
import { vencimientosNacionales, vencimientosIca, OBLIGACIONES_NACIONALES, OBLIGACIONES_ICA, OBLIGACIONES_SIN_PAGO, ANIO_CALENDARIO, type ConfigNacional, type MunicipioIcaInput } from '../vencimientos/generador.js';
import { limitePago } from '../vencimientos/reglas-pago.js';
import { interesMora, sancionExtemporaneidad } from '../vencimientos/tasas-mora.js';
import { vinculoDeObligacion, VINCULOS_VENCIMIENTO } from '../vencimientos/vinculos.js';

// ¿La obligación causa sanción por extemporaneidad? Aplica a las NO presentadas
// y a las que quedaron INEFICACES (retención/autorretención/ReteICA que pasaron
// su límite de pago). No a las pagadas.
function sancionAplica(estado: string, consecuencia: string, fechaLimitePago: Date | null): boolean {
  if (estado === 'presentado_pagado') return false;
  if (estado === 'no_presentado') return true;
  return consecuencia === 'ineficaz' && fechaLimitePago != null && new Date() > fechaLimitePago;
}

// Parámetros de liquidación de la organización (tasa de mora, UVT, sanción). Si
// no hay fila, se devuelven null y los cálculos usan los valores por defecto.
async function cargarParamsLiq(orgId: string) {
  const p = await prisma.parametrosLiquidacion.findUnique({ where: { organizacionId: orgId } });
  return {
    tasaAnual: p ? Number(p.tasaMoraMensual) : null,
    uvt: p ? Number(p.valorUvt) : null,
    sancionMinUvt: p ? Number(p.sancionMinimaUvt) : null,
    pct: p ? Number(p.pctSancionExtemporaneidad) : null,
  };
}

// Suma de abonos (pagos parciales) por vencimiento, para calcular el saldo.
async function abonosPorVencimiento(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await prisma.abonoVencimiento.groupBy({ by: ['vencimientoId'], where: { vencimientoId: { in: ids } }, _sum: { monto: true } });
  return new Map(rows.map((r) => [r.vencimientoId, Number(r._sum.monto ?? 0)]));
}
// Sanción mínima (UVT) propia por municipio; solo los que la tienen definida.
async function minimosPorMunicipio(orgId: string): Promise<Map<string, number>> {
  const rows = await prisma.municipio.findMany({ where: { organizacionId: orgId, sancionMinimaUvt: { not: null } }, select: { id: true, sancionMinimaUvt: true } });
  return new Map(rows.map((m) => [m.id, Number(m.sancionMinimaUvt)]));
}

export const vencimientosRouter = Router();

const ESTADOS = ['pendiente', 'presentado_sin_pago', 'presentado_pagado', 'presentado_cero', 'no_presentado', 'no_obligado'];
// Estados que cuentan como "presentado" (cumplido) en los KPIs.
const PRESENTADOS = ['presentado_sin_pago', 'presentado_pagado', 'presentado_cero'];

// Usuario de la firma (no cliente externo).
function esUsuarioFirma(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || (u.roles.length > 0 && !u.empresaCliente && !u.grupoCliente));
}
// Puede editar vencimientos: por ahora, solo Administrador / root.
function puedeEditar(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || u.roles.includes('Administrador'));
}
// Organización de la sesión (ver auth/tenant.ts). Antes esto devolvía siempre
// la firma "cerpat", que era el bloqueo para atender a más de una.
async function orgActual(req: AuthedRequest) {
  return orgDeSesion(req);
}

// Normaliza texto (sin acentos/mayúsculas) para emparejar municipios/nombres.
const norm = (s: string) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
// Alias de municipios cuyo nombre/departamento en los Excel difiere del catálogo.
const ALIAS_MUNI: Record<string, { nombre: string; departamento: string }> = {
  'bogota|d.c.': { nombre: 'Bogotá, D.C.', departamento: 'Bogotá, D.C.' },
  'bogota|bogota': { nombre: 'Bogotá, D.C.', departamento: 'Bogotá, D.C.' },
  'cartagena|bolivar': { nombre: 'Cartagena De Indias', departamento: 'Bolívar' },
};

// GET /vencimientos?anio=&empresaId=&mes=&estado=
vencimientosRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgActual(req);
  if (!org) return res.json({ total: 0, vencimientos: [] });
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const empresaId = typeof req.query.empresaId === 'string' && req.query.empresaId ? req.query.empresaId : undefined;
  const estado = typeof req.query.estado === 'string' && ESTADOS.includes(req.query.estado) ? req.query.estado : undefined;
  const mes = Number(req.query.mes);
  // Alcance: un Asesor/Auxiliar solo ve los vencimientos de sus empresas asignadas.
  const idsAsignadas = esStaffAcotado(req.user) ? await empresasAsignadas(req.user!.sub, org.id) : null;

  const items = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio, ...(idsAsignadas ? { empresaId: { in: idsAsignadas } } : empresaId ? { empresaId } : {}), ...(estado ? { estado: estado as any } : {}) },
    orderBy: [{ fechaVencimiento: 'asc' }],
    select: {
      id: true, empresaId: true, obligacion: true, periodicidad: true, periodo: true,
      fechaVencimiento: true, estado: true, notas: true, soporteLink: true, valorPago: true, createdAt: true,
      empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } },
    },
  });
  const hoy = new Date();
  let list = items.map((v) => ({
    ...v, empresa: v.empresa?.nombre ?? null, municipio: v.municipio?.nombre ?? null,
    valorPago: v.valorPago != null ? Number(v.valorPago) : null,
    vencido: v.estado === 'pendiente' && v.fechaVencimiento < hoy,
  }));
  if (mes >= 1 && mes <= 12) list = list.filter((v) => v.fechaVencimiento.getMonth() + 1 === mes);
  res.json({ total: list.length, vencimientos: list });
});

// GET /vencimientos/resumen?anio= — KPIs + por empresa + por mes.
vencimientosRouter.get('/resumen', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgActual(req);
  if (!org) return res.json({ kpis: null, porEmpresa: [], porMes: [] });
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const items = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio },
    select: { estado: true, fechaVencimiento: true, empresa: { select: { id: true, nombre: true } } },
  });
  const hoy = new Date();
  let total = 0, presentados = 0, pendientes = 0, vencidos = 0;
  const emp = new Map<string, { empresa: string; total: number; presentados: number; vencidos: number }>();
  const porMes = new Array(12).fill(0);
  for (const v of items) {
    // "No obligado" no es una obligación real: no cuenta en total ni en cumplimiento.
    if (v.estado === 'no_obligado') continue;
    total++;
    const pres = PRESENTADOS.includes(v.estado);
    const venc = v.estado === 'pendiente' && v.fechaVencimiento < hoy;
    if (pres) presentados++; else if (venc) vencidos++; else pendientes++;
    const k = v.empresa.id;
    const a = emp.get(k) ?? { empresa: v.empresa.nombre, total: 0, presentados: 0, vencidos: 0 };
    a.total++; if (pres) a.presentados++; if (venc) a.vencidos++; emp.set(k, a);
    porMes[v.fechaVencimiento.getMonth()]++;
  }
  res.json({
    anio, kpis: { total, presentados, pendientes, vencidos },
    porEmpresa: Array.from(emp.values()).sort((x, y) => y.vencidos - x.vencidos || y.total - x.total),
    porMes,
  });
});

// GET /vencimientos/empresas?anio= — empresas con vencimientos (para el filtro).
vencimientosRouter.get('/empresas', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgActual(req);
  if (!org) return res.json({ empresas: [] });
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const rows = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio }, distinct: ['empresaId'],
    select: { empresa: { select: { id: true, nombre: true } } },
  });
  res.json({ empresas: rows.map((r) => r.empresa).sort((a, b) => a.nombre.localeCompare(b.nombre)) });
});

// GET /vencimientos/pagos?anio= — vencimientos en el ciclo de pago (presentado
// sin pago / presentado y pagado), con su valor. Alimenta la vista de Pagos.
vencimientosRouter.get('/pagos', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgActual(req);
  if (!org) return res.json({ total: 0, vencimientos: [] });
  const pl = await cargarParamsLiq(org.id);
  const anio = Number(req.query.anio) || new Date().getFullYear();
  // Alcance: un Asesor solo ve los pagos de sus empresas asignadas.
  const idsAsignadas = esStaffAcotado(req.user) ? await empresasAsignadas(req.user!.sub, org.id) : null;
  const items = await prisma.vencimientoEmpresa.findMany({
    // Solo los generados por el sistema: los pagos pendientes agregados a mano
    // (generado=false) viven en su propia sección para no duplicarse aquí. Las
    // obligaciones de solo presentación (nómina electrónica, PILA) no entran.
    where: { organizacionId: org.id, anio, generado: true, estado: { in: ['presentado_sin_pago', 'presentado_pagado'] }, obligacion: { notIn: [...OBLIGACIONES_SIN_PAGO] }, ...(idsAsignadas ? { empresaId: { in: idsAsignadas } } : {}) },
    orderBy: [{ estado: 'asc' }, { fechaVencimiento: 'asc' }],
    select: {
      id: true, obligacion: true, periodo: true, fechaVencimiento: true, estado: true, valorPago: true,
      municipioId: true, empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } },
    },
  });
  const [abonoMap, muniMin] = await Promise.all([abonosPorVencimiento(items.map((v) => v.id)), minimosPorMunicipio(org.id)]);
  res.json({
    anio,
    total: items.length,
    vencimientos: items.map((v) => {
      const valor = v.valorPago != null ? Number(v.valorPago) : null;
      const abonado = abonoMap.get(v.id) ?? 0;
      const saldo = valor != null ? Math.max(0, valor - abonado) : null;
      const sancMin = v.municipioId && muniMin.get(v.municipioId) != null ? muniMin.get(v.municipioId)! : pl.sancionMinUvt;
      const lp = limitePago(v.fechaVencimiento, v.obligacion, valor, pl.uvt);
      // Interés de mora a hoy sobre el SALDO (valor − abonos); 0 si ya está pagado.
      const im = v.estado === 'presentado_pagado' ? { dias: 0, interes: 0 } : interesMora(saldo, v.fechaVencimiento, new Date(), pl.tasaAnual);
      const san = sancionAplica(v.estado, lp.consecuencia, lp.fechaLimitePago)
        ? sancionExtemporaneidad(valor, v.fechaVencimiento, new Date(), { uvt: pl.uvt, sancionMinUvt: sancMin, pct: pl.pct, anioUvt: v.fechaVencimiento.getFullYear() })
        : { meses: 0, sancion: 0 };
      return {
        id: v.id, obligacion: v.obligacion, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento, estado: v.estado,
        valorPago: valor, abonado, saldo,
        fechaLimitePago: lp.fechaLimitePago, consecuencia: lp.consecuencia,
        diasMora: im.dias, interesMora: im.interes, sancion: san.sancion,
        empresa: v.empresa?.nombre ?? null, municipio: v.municipio?.nombre ?? null,
      };
    }),
  });
});

// GET /vencimientos/portal-pagos?anio= — PAGOS del cliente (solo lectura, aislado
// por NIT/grupo). Junta las obligaciones en ciclo de pago (generadas) y los pagos
// pendientes agregados a mano, con valor, límite, mora y sanción a hoy.
vencimientosRouter.get('/portal-pagos', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgActual(req);
  const anio = Number(req.query.anio) || new Date().getFullYear();
  if (!org) return res.json({ anio, vencimientos: [], pendientes: [] });
  const alcance = await alcancePortal(req.user, org.id);
  if (alcance === null) return res.status(403).json({ error: 'Sin acceso a pagos.' });
  const scope = alcance === 'todas' ? {} : { empresaId: { in: alcance } };
  const pl = await cargarParamsLiq(org.id);

  const [ciclo, manual] = await Promise.all([
    prisma.vencimientoEmpresa.findMany({
      where: { organizacionId: org.id, anio, generado: true, estado: { in: ['presentado_sin_pago', 'presentado_pagado'] }, obligacion: { notIn: [...OBLIGACIONES_SIN_PAGO] }, ...scope },
      orderBy: [{ estado: 'asc' }, { fechaVencimiento: 'asc' }],
      select: { id: true, obligacion: true, periodo: true, fechaVencimiento: true, estado: true, valorPago: true, municipioId: true, empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } } },
    }),
    prisma.vencimientoEmpresa.findMany({
      where: { organizacionId: org.id, generado: false, ...scope },
      orderBy: [{ estado: 'asc' }, { anio: 'desc' }, { fechaVencimiento: 'asc' }],
      select: { id: true, obligacion: true, anio: true, periodo: true, fechaVencimiento: true, estado: true, valorPago: true, notas: true, municipioId: true, empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } } },
    }),
  ]);

  const [abonoMap, muniMin] = await Promise.all([abonosPorVencimiento([...ciclo, ...manual].map((v) => v.id)), minimosPorMunicipio(org.id)]);
  const calcular = (v: any, anioUvt: number) => {
    const valor = v.valorPago != null ? Number(v.valorPago) : null;
    const abonado = abonoMap.get(v.id) ?? 0;
    const saldo = valor != null ? Math.max(0, valor - abonado) : null;
    const sancMin = v.municipioId && muniMin.get(v.municipioId) != null ? muniMin.get(v.municipioId) : pl.sancionMinUvt;
    const lp = limitePago(v.fechaVencimiento, v.obligacion, valor, pl.uvt);
    const im = v.estado === 'presentado_pagado' ? { dias: 0, interes: 0 } : interesMora(saldo, v.fechaVencimiento, new Date(), pl.tasaAnual);
    const san = sancionAplica(v.estado, lp.consecuencia, lp.fechaLimitePago)
      ? sancionExtemporaneidad(valor, v.fechaVencimiento, new Date(), { uvt: pl.uvt, sancionMinUvt: sancMin, pct: pl.pct, anioUvt })
      : { meses: 0, sancion: 0 };
    return { valor, abonado, saldo, lp, im, san };
  };

  res.json({
    anio,
    vencimientos: ciclo.map((v) => {
      const { valor, abonado, saldo, lp, im, san } = calcular(v, v.fechaVencimiento.getFullYear());
      return { id: v.id, obligacion: v.obligacion, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento, estado: v.estado, valorPago: valor, abonado, saldo, fechaLimitePago: lp.fechaLimitePago, consecuencia: lp.consecuencia, diasMora: im.dias, interesMora: im.interes, sancion: san.sancion, empresa: v.empresa?.nombre ?? null, municipio: v.municipio?.nombre ?? null };
    }),
    pendientes: manual.map((v) => {
      const { valor, abonado, saldo, lp, im, san } = calcular(v, v.anio);
      return { id: v.id, obligacion: v.obligacion, anio: v.anio, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento, estado: v.estado, notas: v.notas, valorPago: valor, abonado, saldo, fechaLimitePago: lp.fechaLimitePago, consecuencia: lp.consecuencia, diasMora: im.dias, interesMora: im.interes, sancion: san.sancion, empresa: v.empresa?.nombre ?? null, municipio: v.municipio?.nombre ?? null };
    }),
  });
});

// GET /vencimientos/portal?anio=&mes= — vencimientos del cliente para el
// Calendario (solo lectura, aislado por NIT/grupo). Si viene mes, filtra ese mes.
vencimientosRouter.get('/portal', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgActual(req);
  if (!org) return res.json({ vencimientos: [] });
  const alcance = await alcancePortal(req.user, org.id);
  if (alcance === null) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const scope = alcance === 'todas' ? {} : { empresaId: { in: alcance } };
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const mes = Number(req.query.mes);
  const where: any = { organizacionId: org.id, anio, generado: true, ...scope };
  if (Number.isFinite(mes) && mes >= 1 && mes <= 12) {
    where.fechaVencimiento = { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) };
  }
  const items = await prisma.vencimientoEmpresa.findMany({
    where, orderBy: { fechaVencimiento: 'asc' },
    select: { id: true, obligacion: true, periodo: true, fechaVencimiento: true, estado: true, empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } } },
  });
  const hoy = new Date();
  res.json({
    vencimientos: items.map((v) => ({
      id: v.id, obligacion: v.obligacion, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento, estado: v.estado,
      empresa: v.empresa?.nombre ?? null, municipio: v.municipio?.nombre ?? null,
      vencido: !PRESENTADOS.includes(v.estado) && v.estado !== 'no_obligado' && v.fechaVencimiento < hoy,
    })),
  });
});

// GET /vencimientos/pendientes — pagos pendientes agregados a mano
// (generado=false), de cualquier año. Sirve para registrar deudas de años
// anteriores o impuestos que no se cargaron al sistema. Alimenta la sección
// "Pagos pendientes" en la vista de Pagos.
vencimientosRouter.get('/pendientes', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgActual(req);
  if (!org) return res.json({ total: 0, pendientes: [] });
  const pl = await cargarParamsLiq(org.id);
  const idsAsignadas = esStaffAcotado(req.user) ? await empresasAsignadas(req.user!.sub, org.id) : null;
  const items = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, generado: false, ...(idsAsignadas ? { empresaId: { in: idsAsignadas } } : {}) },
    orderBy: [{ estado: 'asc' }, { anio: 'desc' }, { fechaVencimiento: 'asc' }],
    select: {
      id: true, obligacion: true, anio: true, periodo: true, fechaVencimiento: true, estado: true,
      valorPago: true, notas: true, municipioId: true,
      empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } },
    },
  });
  const [abonoMap, muniMin] = await Promise.all([abonosPorVencimiento(items.map((v) => v.id)), minimosPorMunicipio(org.id)]);
  res.json({
    total: items.length,
    pendientes: items.map((v) => {
      const valor = v.valorPago != null ? Number(v.valorPago) : null;
      const abonado = abonoMap.get(v.id) ?? 0;
      const saldo = valor != null ? Math.max(0, valor - abonado) : null;
      const sancMin = v.municipioId && muniMin.get(v.municipioId) != null ? muniMin.get(v.municipioId)! : pl.sancionMinUvt;
      const lp = limitePago(v.fechaVencimiento, v.obligacion, valor, pl.uvt);
      const im = v.estado === 'presentado_pagado' ? { dias: 0, interes: 0 } : interesMora(saldo, v.fechaVencimiento, new Date(), pl.tasaAnual);
      const san = sancionAplica(v.estado, lp.consecuencia, lp.fechaLimitePago)
        ? sancionExtemporaneidad(valor, v.fechaVencimiento, new Date(), { uvt: pl.uvt, sancionMinUvt: sancMin, pct: pl.pct, anioUvt: v.anio })
        : { meses: 0, sancion: 0 };
      return {
        id: v.id, obligacion: v.obligacion, anio: v.anio, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento,
        estado: v.estado, notas: v.notas, valorPago: valor, abonado, saldo,
        fechaLimitePago: lp.fechaLimitePago, consecuencia: lp.consecuencia,
        diasMora: im.dias, interesMora: im.interes, sancion: san.sancion,
        empresa: v.empresa?.nombre ?? null, municipio: v.municipio?.nombre ?? null,
      };
    }),
  });
});

// POST /vencimientos — registra un pago pendiente a mano (Administrador / root).
// Para deudas de años anteriores o impuestos que no se cargaron. Se marca
// generado=false para distinguirlo de los vencimientos del generador.
vencimientosRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede agregar pagos pendientes.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const b = req.body ?? {};

  const empresaId = typeof b.empresaId === 'string' ? b.empresaId.trim() : '';
  if (!empresaId) return res.status(422).json({ error: 'Selecciona un cliente.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, organizacionId: org.id }, select: { id: true } });
  if (!empresa) return res.status(422).json({ error: 'Cliente no válido.' });

  const obligacion = typeof b.obligacion === 'string' ? b.obligacion.trim() : '';
  if (!obligacion) return res.status(422).json({ error: 'Indica la obligación (p. ej. IVA, Renta, ICA).' });

  const anio = Number(b.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return res.status(422).json({ error: 'Año inválido.' });

  const fecha = new Date(b.fechaVencimiento);
  if (isNaN(fecha.getTime())) return res.status(422).json({ error: 'Fecha de vencimiento inválida.' });

  const estado = typeof b.estado === 'string' && ESTADOS.includes(b.estado) ? b.estado : 'pendiente';

  let valorPago: number | null = null;
  if (b.valorPago != null && b.valorPago !== '') {
    const n = Number(b.valorPago);
    if (!isFinite(n) || n < 0) return res.status(422).json({ error: 'El valor a pagar debe ser un número ≥ 0.' });
    valorPago = n;
  }
  const periodo = typeof b.periodo === 'string' && b.periodo.trim() ? b.periodo.trim() : null;
  const notas = typeof b.notas === 'string' && b.notas.trim() ? b.notas.trim() : null;

  // Municipio opcional (para ICA / ReteICA). Debe pertenecer a la organización.
  let municipioId: string | null = null;
  if (typeof b.municipioId === 'string' && b.municipioId.trim()) {
    const mun = await prisma.municipio.findFirst({ where: { id: b.municipioId.trim(), organizacionId: org.id }, select: { id: true } });
    if (!mun) return res.status(422).json({ error: 'Municipio no válido.' });
    municipioId = mun.id;
  }

  const creado = await prisma.vencimientoEmpresa.create({
    data: {
      organizacionId: org.id, empresaId, anio, obligacion, periodo, municipioId,
      fechaVencimiento: fecha, estado: estado as any, valorPago, notas, generado: false,
    },
    select: { id: true },
  });
  res.status(201).json({ ok: true, id: creado.id });
});

// POST /vencimientos/importar — carga masiva de vencimientos desde un Excel/CSV
// (parseado en el navegador y enviado como filas JSON). Cada fila crea un
// VencimientoEmpresa "a mano" (generado=false). Empareja cliente por NIT (o
// nombre) y municipio por nombre+departamento. Es idempotente (no duplica: misma
// empresa · municipio · fecha · obligación · año). Con dryRun (por defecto) solo
// previsualiza el plan; sin dryRun escribe. Solo Administrador / root.
vencimientosRouter.post('/importar', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede importar vencimientos.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const b = req.body ?? {};

  const obligacion = typeof b.obligacion === 'string' ? b.obligacion.trim() : '';
  if (!obligacion) return res.status(422).json({ error: 'Indica la obligación (p. ej. "Exógena municipal (medios magnéticos)").' });
  const anio = Number(b.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return res.status(422).json({ error: 'Año inválido.' });
  const periodicidad = typeof b.periodicidad === 'string' && b.periodicidad.trim() ? b.periodicidad.trim() : null;
  const dryRun = b.dryRun !== false; // por defecto previsualiza (no escribe)
  const filas = Array.isArray(b.filas) ? b.filas : [];
  if (!filas.length) return res.status(422).json({ error: 'El archivo no tiene filas para importar.' });
  if (filas.length > 2000) return res.status(422).json({ error: 'Demasiadas filas (máx. 2000 por carga).' });

  // Índices de empresas (por NIT en dígitos, y por nombre) y municipios.
  const soloDig = (s: unknown) => String(s ?? '').replace(/\D/g, '');
  const empresas = await prisma.empresa.findMany({ where: { organizacionId: org.id }, select: { id: true, nombre: true, nit: true } });
  const empPorNit = new Map<string, { id: string; nombre: string }>();
  for (const e of empresas) { const d = soloDig(e.nit); if (d) empPorNit.set(d, e); }
  const empPorNombre = new Map(empresas.map((e) => [norm(e.nombre), e]));

  const munis = await prisma.municipio.findMany({ where: { organizacionId: org.id }, select: { id: true, nombre: true, departamento: true } });
  const mByND = new Map(munis.map((m) => [`${norm(m.nombre)}|${norm(m.departamento)}`, m]));
  const mByN = new Map<string, typeof munis>();
  for (const m of munis) { const k = norm(m.nombre); (mByN.get(k) ?? mByN.set(k, []).get(k)!).push(m); }
  const resolverMuni = (mu: string, dep: string): { muni: (typeof munis)[number] | null; ok: boolean } => {
    if (!mu.trim()) return { muni: null, ok: true }; // sin municipio (obligación no municipal)
    const t = ALIAS_MUNI[`${norm(mu)}|${norm(dep)}`] ?? { nombre: mu, departamento: dep };
    const ex = mByND.get(`${norm(t.nombre)}|${norm(t.departamento)}`);
    if (ex) return { muni: ex, ok: true };
    const c = mByN.get(norm(t.nombre)) ?? [];
    return c.length === 1 ? { muni: c[0], ok: true } : { muni: null, ok: false };
  };

  const fechaSolo = (v: unknown): Date | null => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  };

  // Dedup contra lo ya cargado de esa obligación/año.
  const existentes = await prisma.vencimientoEmpresa.findMany({ where: { organizacionId: org.id, anio, obligacion }, select: { empresaId: true, municipioId: true, fechaVencimiento: true } });
  const clave = (empId: string, muniId: string | null, fISO: string) => `${empId}|${muniId ?? ''}|${fISO}`;
  const yaHay = new Set(existentes.map((v) => clave(v.empresaId, v.municipioId, v.fechaVencimiento.toISOString().slice(0, 10))));

  const datos: any[] = [];
  const preview: string[] = [];
  const problemas: string[] = [];
  let duplicados = 0;

  filas.forEach((f: any, i: number) => {
    const linea = i + 1;
    const nitDig = soloDig(f?.nit);
    const empresa = nitDig ? empPorNit.get(nitDig) : (f?.empresa ? empPorNombre.get(norm(String(f.empresa))) : undefined);
    if (!empresa) { problemas.push(`Fila ${linea}: cliente no encontrado (${f?.nit || f?.empresa || 'sin dato'}).`); return; }
    const { muni, ok } = resolverMuni(f?.municipio ? String(f.municipio) : '', f?.departamento ? String(f.departamento) : '');
    if (!ok) { problemas.push(`Fila ${linea}: municipio no encontrado (${f?.municipio} / ${f?.departamento}).`); return; }
    const fecha = fechaSolo(String(f?.fecha ?? ''));
    if (!fecha) { problemas.push(`Fila ${linea}: fecha inválida (${f?.fecha ?? 'vacía'}); usa AAAA-MM-DD.`); return; }
    const fISO = fecha.toISOString().slice(0, 10);
    const k = clave(empresa.id, muni ? muni.id : null, fISO);
    if (yaHay.has(k)) { duplicados++; return; }
    yaHay.add(k);
    let valorPago: number | null = null;
    if (f?.valor != null && f.valor !== '') { const n = Number(f.valor); if (isFinite(n) && n >= 0) valorPago = n; }
    const periodo = typeof f?.periodo === 'string' && f.periodo.trim() ? f.periodo.trim() : null;
    datos.push({ organizacionId: org.id, empresaId: empresa.id, anio, obligacion, periodicidad, periodo, municipioId: muni ? muni.id : null, fechaVencimiento: fecha, valorPago, generado: false });
    if (preview.length < 60) preview.push(`${empresa.nombre}${muni ? ` · ${muni.nombre}` : ''} · ${fISO}`);
  });

  if (dryRun) {
    return res.json({ dryRun: true, totalFilas: filas.length, crear: datos.length, duplicados, problemas, preview });
  }
  if (datos.length) await prisma.vencimientoEmpresa.createMany({ data: datos });
  return res.json({ dryRun: false, creados: datos.length, duplicados, problemas });
});

// POST /vencimientos/regenerar/:empresaId — regenera los vencimientos
// NACIONALES e ICA municipal del cliente según su configuración tributaria
// actual, cruzándola con el calendario 2026 y su NIT. Preserva los pagos: no
// borra los vencimientos que ya tienen valor, estado (distinto de pendiente),
// notas o soporte, aunque la nueva config ya no los contemple. Nunca toca las
// entradas manuales (generado=false). Devuelve `sinCalendario` con las
// obligaciones de ICA marcadas que no tienen fechas en el calendario municipal.
// Solo Administrador / root.
vencimientosRouter.post('/regenerar/:empresaId', requireAuth, async (req: AuthedRequest, res) => {
  // Parte de "Config. tributaria": lo puede hacer Administrador o Coordinador (o root).
  const u = req.user;
  if (!(u && (u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)))))
    return res.status(403).json({ error: 'Solo Administrador o Coordinación puede regenerar vencimientos.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });

  const empresa = await prisma.empresa.findFirst({
    where: { id: req.params.empresaId, organizacionId: org.id },
    // El tipo de empresa define quién está obligado al RUB (ver aplicaRub).
    select: { id: true, nombre: true, nit: true, configuracionTributaria: true, tipo: { select: { nombre: true } } },
  });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  if (!empresa.nit) return res.status(422).json({ error: 'El cliente no tiene NIT; no se pueden calcular las fechas de vencimiento.' });
  const cfg = empresa.configuracionTributaria;
  if (!cfg) return res.status(422).json({ error: 'El cliente no tiene configuración tributaria. Configúrala antes de regenerar.' });

  const anio = ANIO_CALENDARIO;
  const objetivoNac = vencimientosNacionales(cfg as ConfigNacional, empresa.nit, empresa.tipo?.nombre ?? null);

  // ICA municipal: cruza lo marcado por municipio con el calendario municipal.
  const icaCfg = await prisma.empresaMunicipioIca.findMany({
    where: { empresaId: empresa.id },
    select: { municipioId: true, icaPeriodicidad: true, reteica: true, reteicaPeriodicidad: true, autoica: true, autoicaPeriodicidad: true, fechaInscripcion: true, municipio: { select: { nombre: true, departamento: true } } },
  });
  const icaInput: MunicipioIcaInput[] = icaCfg.map((m) => ({
    municipioId: m.municipioId, municipio: m.municipio?.nombre ?? null, departamento: m.municipio?.departamento ?? null,
    icaPeriodicidad: m.icaPeriodicidad, reteica: m.reteica, reteicaPeriodicidad: m.reteicaPeriodicidad,
    autoica: m.autoica, autoicaPeriodicidad: m.autoicaPeriodicidad, fechaInscripcion: m.fechaInscripcion,
  }));
  const { vencimientos: objetivoIca, sinCalendario } = vencimientosIca(icaInput, empresa.nit);

  // Existentes generados del año: nacionales (municipioId null) e ICA (≠null).
  // Nunca se tocan las entradas manuales (generado=false).
  const existentes = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, empresaId: empresa.id, anio, generado: true },
    include: { _count: { select: { subtareas: true } } },
  });
  const existNac = existentes.filter((e) => e.municipioId == null);
  const existIca = existentes.filter((e) => e.municipioId != null);

  const key = (o: string, per: string | null, p: string | null) => `${o}|${per ?? ''}|${p ?? ''}`;
  const keyIca = (o: string, per: string | null, p: string | null, mun: string | null) => `${key(o, per, p)}|${mun ?? ''}`;
  const existNacByKey = new Map(existNac.map((e) => [key(e.obligacion, e.periodicidad, e.periodo), e]));
  const existIcaByKey = new Map(existIca.map((e) => [keyIca(e.obligacion, e.periodicidad, e.periodo, e.municipioId), e]));
  const objetivoNacKeys = new Set(objetivoNac.map((v) => key(v.obligacion, v.periodicidad, v.periodo)));
  const objetivoIcaKeys = new Set(objetivoIca.map((v) => keyIca(v.obligacion, v.periodicidad, v.periodo, v.municipioId)));
  const tienePago = (e: (typeof existentes)[number]) =>
    e.estado !== 'pendiente' || e.valorPago != null || !!e.notas?.trim() || !!e.soporteLink?.trim();

  // Vínculos: al CREAR un vencimiento hereda el responsable (del área de la
  // actividad del plan vinculada) y copia su checklist (subtareas plantilla).
  // Los vencimientos ya EXISTENTES vinculados que aún no tengan checklist/
  // responsable también se rellenan (backfill), sin sobrescribir chulos ni un
  // responsable ya asignado.
  const actividadesVinc = await prisma.actividadPlan.findMany({
    where: { organizacionId: org.id, activo: true, obligacionVencimiento: { not: null } },
    select: { obligacionVencimiento: true, areaId: true, subtareas: { orderBy: { orden: 'asc' }, select: { texto: true, orden: true } } },
  });
  const vincPorKey = new Map(actividadesVinc.map((a) => [a.obligacionVencimiento!, { areaId: a.areaId, subtareas: a.subtareas }]));
  const asigAreas = await prisma.asignacionClienteArea.findMany({
    where: { empresaId: empresa.id }, select: { areaId: true, asesorId: true, auxiliarId: true },
  });
  const respPorArea = new Map(asigAreas.map((x) => [x.areaId, { asesorId: x.asesorId, auxiliarId: x.auxiliarId }]));
  // Extras de creación (responsable + checklist) según la obligación del vencimiento.
  const extrasCreacion = (obligacion: string) => {
    const key = vinculoDeObligacion(obligacion);
    const vinc = key ? vincPorKey.get(key) : undefined;
    const resp = vinc?.areaId ? respPorArea.get(vinc.areaId) : undefined;
    return {
      asesorId: resp?.asesorId ?? null,
      auxiliarId: resp?.auxiliarId ?? null,
      ...(vinc?.subtareas.length ? { subtareas: { create: vinc.subtareas.map((s) => ({ texto: s.texto, orden: s.orden })) } } : {}),
    };
  };
  // Relleno para un vencimiento EXISTENTE vinculado: responsable si está vacío y
  // checklist si aún no tiene ninguna subtarea. Devuelve null si no hay nada que
  // rellenar. No sobrescribe chulos ni un responsable ya asignado.
  const backfillData = (ex: (typeof existentes)[number]): Record<string, unknown> | null => {
    const k = vinculoDeObligacion(ex.obligacion);
    const vinc = k ? vincPorKey.get(k) : undefined;
    if (!vinc) return null;
    const resp = vinc.areaId ? respPorArea.get(vinc.areaId) : undefined;
    const data: Record<string, unknown> = {};
    if (ex.asesorId == null && resp?.asesorId) data.asesorId = resp.asesorId;
    if (ex.auxiliarId == null && resp?.auxiliarId) data.auxiliarId = resp.auxiliarId;
    if (ex._count.subtareas === 0 && vinc.subtareas.length)
      data.subtareas = { create: vinc.subtareas.map((s) => ({ texto: s.texto, orden: s.orden })) };
    return Object.keys(data).length ? data : null;
  };

  // Qué se daría de baja con la configuración actual. Se calcula ANTES de tocar
  // nada porque regenerar borra los vencimientos que la config ya no contempla:
  // así una casilla mal puesta se lleva por delante obligaciones reales sin que
  // nadie se entere. Con ?dryRun=1 se devuelve esto y no se modifica nada.
  const bajas = [
    ...existNac.filter((e) => OBLIGACIONES_NACIONALES.has(e.obligacion)
      && !objetivoNacKeys.has(key(e.obligacion, e.periodicidad, e.periodo)) && !tienePago(e)),
    ...existIca.filter((e) => OBLIGACIONES_ICA.has(e.obligacion)
      && !objetivoIcaKeys.has(keyIca(e.obligacion, e.periodicidad, e.periodo, e.municipioId)) && !tienePago(e)),
  ];
  const bajasPorObligacion = [...bajas.reduce((m, e) => m.set(e.obligacion, (m.get(e.obligacion) ?? 0) + 1), new Map<string, number>())]
    .map(([obligacion, n]) => ({ obligacion, n }))
    .sort((a, b) => b.n - a.n);

  if (req.query.dryRun === '1' || req.query.dryRun === 'true') {
    const altas = objetivoNac.filter((v) => !existNacByKey.has(key(v.obligacion, v.periodicidad, v.periodo))).length
      + objetivoIca.filter((v) => !existIcaByKey.has(keyIca(v.obligacion, v.periodicidad, v.periodo, v.municipioId))).length;
    return res.json({
      ok: true, dryRun: true, empresa: empresa.nombre, anio,
      resumen: { creados: altas, eliminados: bajas.length, conservadosConPago: 0 },
      seEliminaria: bajasPorObligacion, sinCalendario,
    });
  }

  let creados = 0, actualizados = 0, sinCambios = 0, eliminados = 0, conservadosConPago = 0, enriquecidos = 0;

  await prisma.$transaction(async (tx) => {
    // --- Nacionales ---
    for (const v of objetivoNac) {
      const ex = existNacByKey.get(key(v.obligacion, v.periodicidad, v.periodo));
      if (!ex) {
        await tx.vencimientoEmpresa.create({
          data: {
            organizacionId: org.id, empresaId: empresa.id, anio, obligacion: v.obligacion,
            periodicidad: v.periodicidad, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento, generado: true,
            ...extrasCreacion(v.obligacion),
          },
        });
        creados++;
      } else {
        const fechaCambia = ex.fechaVencimiento.getTime() !== v.fechaVencimiento.getTime();
        const bf = backfillData(ex);
        if (fechaCambia || bf) {
          await tx.vencimientoEmpresa.update({ where: { id: ex.id }, data: { ...(fechaCambia ? { fechaVencimiento: v.fechaVencimiento } : {}), ...(bf ?? {}) } });
          if (fechaCambia) actualizados++;
          if (bf) enriquecidos++;
        } else {
          sinCambios++;
        }
      }
    }
    for (const e of existNac) {
      if (!OBLIGACIONES_NACIONALES.has(e.obligacion)) continue; // no tocar obligaciones ajenas al generador
      if (objetivoNacKeys.has(key(e.obligacion, e.periodicidad, e.periodo))) continue;
      if (tienePago(e)) { conservadosConPago++; continue; } // preservar el trabajo/pago
      await tx.vencimientoEmpresa.delete({ where: { id: e.id } });
      eliminados++;
    }
    // --- ICA municipal (la clave incluye el municipio) ---
    for (const v of objetivoIca) {
      const ex = existIcaByKey.get(keyIca(v.obligacion, v.periodicidad, v.periodo, v.municipioId));
      if (!ex) {
        await tx.vencimientoEmpresa.create({
          data: {
            organizacionId: org.id, empresaId: empresa.id, anio, obligacion: v.obligacion,
            periodicidad: v.periodicidad, periodo: v.periodo, municipioId: v.municipioId, fechaVencimiento: v.fechaVencimiento, generado: true,
            ...extrasCreacion(v.obligacion),
          },
        });
        creados++;
      } else {
        const fechaCambia = ex.fechaVencimiento.getTime() !== v.fechaVencimiento.getTime();
        const bf = backfillData(ex);
        if (fechaCambia || bf) {
          await tx.vencimientoEmpresa.update({ where: { id: ex.id }, data: { ...(fechaCambia ? { fechaVencimiento: v.fechaVencimiento } : {}), ...(bf ?? {}) } });
          if (fechaCambia) actualizados++;
          if (bf) enriquecidos++;
        } else {
          sinCambios++;
        }
      }
    }
    for (const e of existIca) {
      if (!OBLIGACIONES_ICA.has(e.obligacion)) continue; // preservar exógena u otras cargadas a mano
      if (objetivoIcaKeys.has(keyIca(e.obligacion, e.periodicidad, e.periodo, e.municipioId))) continue;
      if (tienePago(e)) { conservadosConPago++; continue; } // preservar el trabajo/pago
      await tx.vencimientoEmpresa.delete({ where: { id: e.id } });
      eliminados++;
    }
  });

  res.json({
    ok: true, empresa: empresa.nombre, anio,
    resumen: { creados, actualizados, sinCambios, eliminados, conservadosConPago, enriquecidos },
    seEliminaria: bajasPorObligacion, // qué se dio de baja, por obligación
    sinCalendario,
  });
});

// ---------- Checklist de los vencimientos ----------
//
// El checklist de un vencimiento NO se escribe ahí: se hereda de la actividad
// del plan que quedó vinculada a esa obligación (Administración → Actividades),
// copiando sus subtareas plantilla. Por eso puede faltar por tres razones
// distintas, y sin verlas no se sabe cuál corregir:
//   1. ninguna actividad quedó vinculada a esa obligación;
//   2. la actividad existe y está vinculada, pero no tiene subtareas plantilla;
//   3. está todo bien, pero el vencimiento se creó ANTES de configurarlo.
// Solo el caso 3 se arregla desde el sistema; los otros dos son parametrización.

// GET /vencimientos/checklist/diagnostico?anio=YYYY
// Qué obligaciones tienen checklist configurado y cuántos vencimientos se
// quedaron sin él. No modifica nada.
vencimientosRouter.get('/checklist/diagnostico', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede ver el diagnóstico.' });
  const org = await orgActual(req);
  if (!org) return res.json({ anio: ANIO_CALENDARIO, filas: [] });
  const anio = Number(req.query.anio) || ANIO_CALENDARIO;

  const actividades = await prisma.actividadPlan.findMany({
    where: { organizacionId: org.id, activo: true, obligacionVencimiento: { not: null } },
    select: { nombre: true, obligacionVencimiento: true, areaId: true, _count: { select: { subtareas: true } } },
  });
  const porKey = new Map(actividades.map((a) => [a.obligacionVencimiento!, a]));

  const vencs = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio },
    select: { obligacion: true, _count: { select: { subtareas: true } } },
  });

  const filas = VINCULOS_VENCIMIENTO.map((v) => {
    const act = porKey.get(v.key);
    const propios = vencs.filter((x) => vinculoDeObligacion(x.obligacion) === v.key);
    const sinChecklist = propios.filter((x) => x._count.subtareas === 0).length;
    return {
      key: v.key,
      obligacion: v.label,
      actividad: act?.nombre ?? null,
      subtareasPlantilla: act?._count.subtareas ?? 0,
      vencimientos: propios.length,
      sinChecklist,
      // Qué hay que hacer, en el idioma del equipo.
      diagnostico: !act ? 'sin_actividad_vinculada'
        : (act._count.subtareas === 0 ? 'actividad_sin_checklist'
        : (sinChecklist > 0 ? 'pendiente_de_rellenar' : 'ok')),
    };
  });

  res.json({ anio, filas });
});

// POST /vencimientos/checklist/rellenar { anio?, dryRun? }
// Copia el checklist (y el responsable del área) a los vencimientos que ya
// existen y no lo tienen. SOLO AGREGA: no borra ni sobrescribe nada, a
// diferencia de "Regenerar vencimientos". Es la herramienta segura para
// aplicar una parametrización nueva sobre lo que ya está cargado.
vencimientosRouter.post('/checklist/rellenar', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede rellenar los checklist.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const anio = Number(req.body?.anio) || ANIO_CALENDARIO;
  const dryRun = req.body?.dryRun === true || req.body?.dryRun === 'true';

  const actividades = await prisma.actividadPlan.findMany({
    where: { organizacionId: org.id, activo: true, obligacionVencimiento: { not: null } },
    select: { obligacionVencimiento: true, areaId: true, subtareas: { orderBy: { orden: 'asc' }, select: { texto: true, orden: true } } },
  });
  const vincPorKey = new Map(actividades.map((a) => [a.obligacionVencimiento!, a]));

  const asigs = await prisma.asignacionClienteArea.findMany({
    where: { organizacionId: org.id }, select: { empresaId: true, areaId: true, asesorId: true, auxiliarId: true },
  });
  const respPorEmpresaArea = new Map(asigs.map((a) => [`${a.empresaId}|${a.areaId}`, a]));

  const vencs = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio },
    select: { id: true, empresaId: true, obligacion: true, asesorId: true, auxiliarId: true, _count: { select: { subtareas: true } } },
  });

  let conChecklist = 0, conResponsable = 0;
  const detalle = new Map<string, number>();

  for (const v of vencs) {
    const k = vinculoDeObligacion(v.obligacion);
    const vinc = k ? vincPorKey.get(k) : undefined;
    if (!vinc) continue;
    const resp = vinc.areaId ? respPorEmpresaArea.get(`${v.empresaId}|${vinc.areaId}`) : undefined;

    const data: Record<string, unknown> = {};
    if (v._count.subtareas === 0 && vinc.subtareas.length) {
      data.subtareas = { create: vinc.subtareas.map((s) => ({ texto: s.texto, orden: s.orden })) };
      conChecklist++;
      detalle.set(v.obligacion, (detalle.get(v.obligacion) ?? 0) + 1);
    }
    if (v.asesorId == null && resp?.asesorId) { data.asesorId = resp.asesorId; conResponsable++; }
    if (v.auxiliarId == null && resp?.auxiliarId) data.auxiliarId = resp.auxiliarId;

    if (Object.keys(data).length && !dryRun) {
      await prisma.vencimientoEmpresa.update({ where: { id: v.id }, data });
    }
  }

  res.json({
    ok: true, dryRun, anio,
    resumen: { revisados: vencs.length, conChecklist, conResponsable },
    porObligacion: [...detalle.entries()].map(([obligacion, n]) => ({ obligacion, n })).sort((a, b) => b.n - a.n),
  });
});

// DELETE /vencimientos/:id — elimina un vencimiento (Administrador / root).
// Sirve tanto para los pagos pendientes agregados a mano (generado=false) como
// para un vencimiento generado que no le aplica al cliente (p. ej. RUB en una
// persona natural). Es un borrado puntual; si luego se regenera con la config
// correcta, el generador ya no lo vuelve a crear.
vencimientosRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede eliminar vencimientos.' });
  const org = await orgActual(req);
  const r = await prisma.vencimientoEmpresa.deleteMany({ where: { id: req.params.id, organizacionId: org?.id } });
  if (r.count === 0) return res.status(404).json({ error: 'Vencimiento no encontrado.' });
  res.json({ ok: true });
});

// ---------- Abonos (pagos parciales) a una obligación ----------
// Saldo = valorPago − Σ abonos; el interés de mora corre sobre el saldo. Cada
// abono lleva fecha y una nota. Registrar/eliminar: solo Administrador / root.

// GET /vencimientos/:id/abonos — abonos de una obligación (usuarios de la firma).
vencimientosRouter.get('/:id/abonos', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a abonos.' });
  const org = await orgActual(req);
  const venc = await prisma.vencimientoEmpresa.findFirst({ where: { id: req.params.id, organizacionId: org?.id }, select: { id: true, valorPago: true } });
  if (!venc) return res.status(404).json({ error: 'Obligación no encontrada.' });
  const abonos = await prisma.abonoVencimiento.findMany({ where: { vencimientoId: venc.id }, orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }], select: { id: true, monto: true, fecha: true, notas: true } });
  const abonado = abonos.reduce((s, a) => s + Number(a.monto), 0);
  const valor = venc.valorPago != null ? Number(venc.valorPago) : null;
  res.json({ valorPago: valor, abonado, saldo: valor != null ? Math.max(0, valor - abonado) : null, abonos: abonos.map((a) => ({ id: a.id, monto: Number(a.monto), fecha: a.fecha, notas: a.notas })) });
});

// POST /vencimientos/:id/abonos { monto, fecha?, notas? } — registra un abono.
vencimientosRouter.post('/:id/abonos', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede registrar abonos.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const venc = await prisma.vencimientoEmpresa.findFirst({ where: { id: req.params.id, organizacionId: org.id }, select: { id: true, valorPago: true, estado: true } });
  if (!venc) return res.status(404).json({ error: 'Obligación no encontrada.' });
  const monto = Number(req.body?.monto);
  if (!isFinite(monto) || monto <= 0) return res.status(422).json({ error: 'El abono debe ser un número mayor que 0.' });
  const fecha = req.body?.fecha ? new Date(req.body.fecha) : new Date();
  if (isNaN(fecha.getTime())) return res.status(422).json({ error: 'Fecha de abono inválida.' });
  const notas = typeof req.body?.notas === 'string' && req.body.notas.trim() ? req.body.notas.trim() : null;

  await prisma.abonoVencimiento.create({ data: { organizacionId: org.id, vencimientoId: venc.id, monto, fecha, notas, registradoPorId: req.user?.sub ?? null } });

  // Si con este abono el saldo llega a 0, marca la obligación como pagada.
  const agg = await prisma.abonoVencimiento.aggregate({ where: { vencimientoId: venc.id }, _sum: { monto: true } });
  const abonado = Number(agg._sum.monto ?? 0);
  const valor = venc.valorPago != null ? Number(venc.valorPago) : null;
  let estado = venc.estado;
  if (valor != null && abonado >= valor && venc.estado !== 'presentado_pagado') {
    await prisma.vencimientoEmpresa.update({ where: { id: venc.id }, data: { estado: 'presentado_pagado' } });
    estado = 'presentado_pagado';
  }
  res.status(201).json({ ok: true, abonado, saldo: valor != null ? Math.max(0, valor - abonado) : null, estado });
});

// DELETE /vencimientos/abonos/:abonoId — elimina un abono (Administrador / root).
vencimientosRouter.delete('/abonos/:abonoId', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede eliminar abonos.' });
  const org = await orgActual(req);
  const abono = await prisma.abonoVencimiento.findFirst({ where: { id: req.params.abonoId, organizacionId: org?.id }, select: { id: true } });
  if (!abono) return res.status(404).json({ error: 'Abono no encontrado.' });
  await prisma.abonoVencimiento.delete({ where: { id: abono.id } });
  res.json({ ok: true });
});

// PATCH /vencimientos/:id — estado / fecha / notas (Administrador / root).
vencimientosRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede editar vencimientos.' });
  const org = await orgActual(req);
  const data: Record<string, any> = {};
  if (typeof req.body?.estado === 'string') {
    if (!ESTADOS.includes(req.body.estado)) return res.status(422).json({ error: 'Estado inválido.' });
    data.estado = req.body.estado;
  }
  if ('notas' in (req.body ?? {})) data.notas = typeof req.body.notas === 'string' && req.body.notas.trim() ? req.body.notas.trim() : null;
  if ('soporteLink' in (req.body ?? {})) data.soporteLink = typeof req.body.soporteLink === 'string' && req.body.soporteLink.trim() ? req.body.soporteLink.trim() : null;
  if ('valorPago' in (req.body ?? {})) {
    const v = req.body.valorPago;
    if (v === null || v === '') data.valorPago = null;
    else { const n = Number(v); if (!isFinite(n) || n < 0) return res.status(422).json({ error: 'El valor a pagar debe ser un número ≥ 0.' }); data.valorPago = n; }
  }
  if ('fechaVencimiento' in (req.body ?? {})) {
    const d = new Date(req.body.fechaVencimiento);
    if (isNaN(d.getTime())) return res.status(422).json({ error: 'Fecha inválida.' });
    data.fechaVencimiento = d;
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.vencimientoEmpresa.updateMany({ where: { id: req.params.id, organizacionId: org?.id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Vencimiento no encontrado.' });
  res.json({ ok: true });
});

// GET /vencimientos/:id/detalle — vencimiento con su checklist y responsable
// (para el modal del calendario). Lectura para cualquier usuario de la firma.
vencimientosRouter.get('/:id/detalle', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const v = await prisma.vencimientoEmpresa.findFirst({
    where: { id: req.params.id, organizacionId: org.id },
    select: {
      id: true, obligacion: true, periodicidad: true, periodo: true, fechaVencimiento: true,
      estado: true, valorPago: true, notas: true, soporteLink: true,
      empresa: { select: { nombre: true } },
      asesor: { select: { nombre: true } },
      auxiliar: { select: { nombre: true } },
      subtareas: { orderBy: { orden: 'asc' }, select: { id: true, texto: true, estado: true, orden: true } },
    },
  });
  if (!v) return res.status(404).json({ error: 'Vencimiento no encontrado.' });
  res.json({ vencimiento: v });
});

// PATCH /vencimientos/subtareas/:id — marca/desmarca una subtarea del checklist
// (el "chulo"). Puede el Administrador/Coordinador/root o el asesor/auxiliar del
// propio vencimiento.
const ESTADOS_SUBTAREA_VENC = ['pendiente', 'realizada', 'no_aplica', 'no_realizada'];
vencimientosRouter.patch('/subtareas/:id', requireAuth, async (req: AuthedRequest, res) => {
  const estado = req.body?.estado;
  if (typeof estado !== 'string' || !ESTADOS_SUBTAREA_VENC.includes(estado)) return res.status(422).json({ error: 'Estado de subtarea inválido.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const sub = await prisma.subtareaVencimiento.findFirst({
    where: { id: req.params.id, vencimiento: { organizacionId: org.id } },
    select: { id: true, vencimiento: { select: { asesorId: true, auxiliarId: true } } },
  });
  if (!sub) return res.status(404).json({ error: 'Subtarea no encontrada.' });
  const u = req.user!;
  const puede = u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r))
    || sub.vencimiento.asesorId === u.sub || sub.vencimiento.auxiliarId === u.sub;
  if (!puede) return res.status(403).json({ error: 'No puedes marcar esta subtarea (no eres su responsable).' });
  await prisma.subtareaVencimiento.update({ where: { id: sub.id }, data: { estado: estado as any } });
  res.json({ ok: true });
});
