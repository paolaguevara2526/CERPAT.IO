// apps/api/src/routes/vencimientos.ts
// Vencimientos tributarios generados por empresa (config × calendario × NIT).
// Lectura: cualquier usuario de la firma. Edición (estado, fecha, notas): solo
// Administrador / root por ahora (más adelante, permisos por rol).

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { vencimientosNacionales, ANIO_CALENDARIO, type ConfigNacional } from '../vencimientos/generador.js';
import { limitePago } from '../vencimientos/reglas-pago.js';
import { interesMora, sancionExtemporaneidad } from '../vencimientos/tasas-mora.js';

// ¿La obligación causa sanción por extemporaneidad? Aplica a las NO presentadas
// y a las que quedaron INEFICACES (retención/autorretención/ReteICA que pasaron
// su límite de pago). No a las pagadas.
function sancionAplica(estado: string, consecuencia: string, fechaLimitePago: Date | null): boolean {
  if (estado === 'presentado_pagado') return false;
  if (estado === 'no_presentado') return true;
  return consecuencia === 'ineficaz' && fechaLimitePago != null && new Date() > fechaLimitePago;
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
async function orgCerpat() {
  return prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
}

// GET /vencimientos?anio=&empresaId=&mes=&estado=
vencimientosRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgCerpat();
  if (!org) return res.json({ total: 0, vencimientos: [] });
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const empresaId = typeof req.query.empresaId === 'string' && req.query.empresaId ? req.query.empresaId : undefined;
  const estado = typeof req.query.estado === 'string' && ESTADOS.includes(req.query.estado) ? req.query.estado : undefined;
  const mes = Number(req.query.mes);

  const items = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, anio, ...(empresaId ? { empresaId } : {}), ...(estado ? { estado: estado as any } : {}) },
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
  const org = await orgCerpat();
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
  const org = await orgCerpat();
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
  const org = await orgCerpat();
  if (!org) return res.json({ total: 0, vencimientos: [] });
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const items = await prisma.vencimientoEmpresa.findMany({
    // Solo los generados por el sistema: los pagos pendientes agregados a mano
    // (generado=false) viven en su propia sección para no duplicarse aquí.
    where: { organizacionId: org.id, anio, generado: true, estado: { in: ['presentado_sin_pago', 'presentado_pagado'] } },
    orderBy: [{ estado: 'asc' }, { fechaVencimiento: 'asc' }],
    select: {
      id: true, obligacion: true, periodo: true, fechaVencimiento: true, estado: true, valorPago: true,
      empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } },
    },
  });
  res.json({
    anio,
    total: items.length,
    vencimientos: items.map((v) => {
      const valor = v.valorPago != null ? Number(v.valorPago) : null;
      const lp = limitePago(v.fechaVencimiento, v.obligacion, valor);
      // Interés de mora a hoy, solo si está sin pagar.
      const im = v.estado === 'presentado_pagado' ? { dias: 0, interes: 0 } : interesMora(valor, v.fechaVencimiento);
      const san = sancionAplica(v.estado, lp.consecuencia, lp.fechaLimitePago)
        ? sancionExtemporaneidad(valor, v.fechaVencimiento, new Date(), v.fechaVencimiento.getFullYear())
        : { meses: 0, sancion: 0 };
      return {
        id: v.id, obligacion: v.obligacion, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento, estado: v.estado,
        valorPago: valor,
        fechaLimitePago: lp.fechaLimitePago, consecuencia: lp.consecuencia,
        diasMora: im.dias, interesMora: im.interes, sancion: san.sancion,
        empresa: v.empresa?.nombre ?? null, municipio: v.municipio?.nombre ?? null,
      };
    }),
  });
});

// GET /vencimientos/pendientes — pagos pendientes agregados a mano
// (generado=false), de cualquier año. Sirve para registrar deudas de años
// anteriores o impuestos que no se cargaron al sistema. Alimenta la sección
// "Pagos pendientes" en la vista de Pagos.
vencimientosRouter.get('/pendientes', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a vencimientos.' });
  const org = await orgCerpat();
  if (!org) return res.json({ total: 0, pendientes: [] });
  const items = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, generado: false },
    orderBy: [{ estado: 'asc' }, { anio: 'desc' }, { fechaVencimiento: 'asc' }],
    select: {
      id: true, obligacion: true, anio: true, periodo: true, fechaVencimiento: true, estado: true,
      valorPago: true, notas: true,
      empresa: { select: { nombre: true } }, municipio: { select: { nombre: true } },
    },
  });
  res.json({
    total: items.length,
    pendientes: items.map((v) => {
      const valor = v.valorPago != null ? Number(v.valorPago) : null;
      const lp = limitePago(v.fechaVencimiento, v.obligacion, valor);
      const im = v.estado === 'presentado_pagado' ? { dias: 0, interes: 0 } : interesMora(valor, v.fechaVencimiento);
      const san = sancionAplica(v.estado, lp.consecuencia, lp.fechaLimitePago)
        ? sancionExtemporaneidad(valor, v.fechaVencimiento, new Date(), v.anio)
        : { meses: 0, sancion: 0 };
      return {
        id: v.id, obligacion: v.obligacion, anio: v.anio, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento,
        estado: v.estado, notas: v.notas, valorPago: valor,
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
  const org = await orgCerpat();
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

// POST /vencimientos/regenerar/:empresaId — regenera los vencimientos
// NACIONALES del cliente según su configuración tributaria actual, cruzándola
// con el calendario 2026 y su NIT. Preserva los pagos: no borra los
// vencimientos que ya tienen valor, estado (distinto de pendiente), notas o
// soporte, aunque la nueva config ya no los contemple. Nunca toca el ICA
// municipal (municipioId≠null) ni las entradas manuales (generado=false).
// Solo Administrador / root.
vencimientosRouter.post('/regenerar/:empresaId', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede regenerar vencimientos.' });
  const org = await orgCerpat();
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });

  const empresa = await prisma.empresa.findFirst({
    where: { id: req.params.empresaId, organizacionId: org.id },
    select: { id: true, nombre: true, nit: true, configuracionTributaria: true },
  });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });
  if (!empresa.nit) return res.status(422).json({ error: 'El cliente no tiene NIT; no se pueden calcular las fechas de vencimiento.' });
  const cfg = empresa.configuracionTributaria;
  if (!cfg) return res.status(422).json({ error: 'El cliente no tiene configuración tributaria. Configúrala antes de regenerar.' });

  const anio = ANIO_CALENDARIO;
  const objetivo = vencimientosNacionales(cfg as ConfigNacional, empresa.nit);

  // Existentes: solo nacionales generados (sin ICA municipal, sin manuales).
  const existentes = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, empresaId: empresa.id, anio, generado: true, municipioId: null },
  });

  const key = (o: string, per: string | null, p: string | null) => `${o}|${per ?? ''}|${p ?? ''}`;
  const existByKey = new Map(existentes.map((e) => [key(e.obligacion, e.periodicidad, e.periodo), e]));
  const objetivoKeys = new Set(objetivo.map((v) => key(v.obligacion, v.periodicidad, v.periodo)));
  const tienePago = (e: (typeof existentes)[number]) =>
    e.estado !== 'pendiente' || e.valorPago != null || !!e.notas?.trim() || !!e.soporteLink?.trim();

  let creados = 0, actualizados = 0, sinCambios = 0, eliminados = 0, conservadosConPago = 0;

  await prisma.$transaction(async (tx) => {
    // Alta/actualización de cada obligación objetivo.
    for (const v of objetivo) {
      const ex = existByKey.get(key(v.obligacion, v.periodicidad, v.periodo));
      if (!ex) {
        await tx.vencimientoEmpresa.create({
          data: {
            organizacionId: org.id, empresaId: empresa.id, anio, obligacion: v.obligacion,
            periodicidad: v.periodicidad, periodo: v.periodo, fechaVencimiento: v.fechaVencimiento, generado: true,
          },
        });
        creados++;
      } else if (ex.fechaVencimiento.getTime() !== v.fechaVencimiento.getTime()) {
        // Misma obligación/periodo pero la fecha cambió: se actualiza sin tocar el pago.
        await tx.vencimientoEmpresa.update({ where: { id: ex.id }, data: { fechaVencimiento: v.fechaVencimiento } });
        actualizados++;
      } else {
        sinCambios++;
      }
    }
    // Sobrantes: obligaciones que la config nueva ya no contempla.
    for (const e of existentes) {
      if (objetivoKeys.has(key(e.obligacion, e.periodicidad, e.periodo))) continue;
      if (tienePago(e)) { conservadosConPago++; continue; } // preservar el trabajo/pago
      await tx.vencimientoEmpresa.delete({ where: { id: e.id } });
      eliminados++;
    }
  });

  res.json({ ok: true, empresa: empresa.nombre, anio, resumen: { creados, actualizados, sinCambios, eliminados, conservadosConPago } });
});

// DELETE /vencimientos/:id — elimina un pago pendiente agregado a mano
// (Administrador / root). Solo entradas manuales (generado=false); los
// vencimientos del generador no se borran desde aquí.
vencimientosRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede eliminar pagos pendientes.' });
  const org = await orgCerpat();
  const r = await prisma.vencimientoEmpresa.deleteMany({ where: { id: req.params.id, organizacionId: org?.id, generado: false } });
  if (r.count === 0) return res.status(404).json({ error: 'Pago pendiente no encontrado (o no es una entrada manual).' });
  res.json({ ok: true });
});

// PATCH /vencimientos/:id — estado / fecha / notas (Administrador / root).
vencimientosRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditar(req.user)) return res.status(403).json({ error: 'Solo el Administrador puede editar vencimientos.' });
  const org = await orgCerpat();
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
