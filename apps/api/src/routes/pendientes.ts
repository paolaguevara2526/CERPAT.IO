// apps/api/src/routes/pendientes.ts
// Pendientes del día a día: lo que sale por fuera del plan de trabajo.
//
// El cliente que pide un certificado, la corrección que hay que hacer, la
// llamada al banco. Hasta ahora vivía en cuadernos y en WhatsApp.
//
// Cuatro reglas que se ven en el código:
//
//  1. NO toca el plan ni el calendario. Este router no lee ni escribe `tarea`
//     ni `vencimientoEmpresa` en ninguna parte, y nada de aquí entra en el
//     porcentaje de cumplimiento. Es una agenda, no una obligación del plan.
//  2. La EMPRESA es opcional pero es el dato que importa: con ella se puede
//     responder después "¿cuánto trabajo fuera del plan nos genera cada
//     cliente?". Vacía solo para los pendientes internos de la firma.
//  3. Asignar a OTRA persona es de coordinación. Cualquiera puede anotarse un
//     pendiente propio; poner trabajo en la agenda ajena, no.
//  4. Cada quien ve lo suyo (lo que le asignaron o lo que creó); la
//     coordinación ve todo. Cerrar deja registrado quién y cuándo.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';
import { diaCalendario, hoyEnColombia } from '../plan/dia-calendario.js';

export const pendientesRouter = Router();

const ESTADOS = ['pendiente', 'hecho'];

async function orgActual(req: AuthedRequest) {
  return orgDeSesion(req);
}
// Usuario de la firma (no cliente externo del portal).
function esUsuarioFirma(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || (u.roles.length > 0 && !u.empresaCliente && !u.grupoCliente));
}
function esCoordinacion(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)));
}

const SELECT = {
  id: true, titulo: true, detalle: true, fecha: true, estado: true,
  hechoEn: true, createdAt: true,
  empresa: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  hechoPor: { select: { id: true, nombre: true } },
} as const;

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Lo que el usuario puede VER: lo suyo (asignado o creado). Coordinación, todo. */
function alcanceDe(u: AuthedRequest['user']) {
  if (esCoordinacion(u)) return {};
  return { OR: [{ responsableId: u!.sub }, { creadoPorId: u!.sub }] };
}

// GET /pendientes/form-datos — clientes y personas para el formulario.
//
// Va ANTES de cualquier '/:id' a propósito: Express resuelve en orden de
// declaración y '/:id' se tragaría "form-datos" (ver orden-rutas.test.ts).
pendientesRouter.get('/form-datos', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a pendientes.' });
  const org = await orgActual(req);
  if (!org) return res.json({ empresas: [], personas: [], puedeAsignar: false });

  const [empresas, personas] = await Promise.all([
    prisma.empresa.findMany({ where: { organizacionId: org.id }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    // Solo personal de la firma: un cliente externo no recibe pendientes.
    prisma.usuario.findMany({
      where: { organizacionId: org.id, activo: true, empresaClienteId: null, grupoClienteId: null },
      orderBy: { nombre: 'asc' }, select: { id: true, nombre: true },
    }),
  ]);
  res.json({ empresas, personas, puedeAsignar: esCoordinacion(req.user) });
});

// GET /pendientes/de-empresa/:empresaId — a quién se le puede asignar en esa
// empresa: sus asesores por área, para no tener que adivinar de una lista de
// veinte personas cuál atiende a ese cliente.
pendientesRouter.get('/de-empresa/:empresaId', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a pendientes.' });
  const org = await orgActual(req);
  if (!org) return res.json({ asesores: [] });
  const asigs = await prisma.asignacionClienteArea.findMany({
    where: { organizacionId: org.id, empresaId: req.params.empresaId, asesorId: { not: null } },
    select: { area: { select: { nombre: true } }, asesor: { select: { id: true, nombre: true } } },
  });
  // Una persona puede atender varias áreas del mismo cliente: se muestra una
  // sola vez, con sus áreas juntas.
  const porPersona = new Map<string, { id: string; nombre: string; areas: string[] }>();
  for (const a of asigs) {
    if (!a.asesor) continue;
    const p = porPersona.get(a.asesor.id) ?? { id: a.asesor.id, nombre: a.asesor.nombre, areas: [] };
    if (a.area?.nombre) p.areas.push(a.area.nombre);
    porPersona.set(a.asesor.id, p);
  }
  res.json({ asesores: [...porPersona.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')) });
});

// GET /pendientes/mios — la agenda de quien pregunta: lo abierto de hoy, lo
// atrasado y lo que viene. Es lo que alimenta el panel de Mi Día.
pendientesRouter.get('/mios', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a pendientes.' });
  const org = await orgActual(req);
  if (!org) return res.json({ hoy: null, total: 0, atrasados: 0, pendientes: [] });
  const u = req.user!;

  const filas = await prisma.pendiente.findMany({
    // Lo propio, aunque sea coordinación: este panel es "mi agenda", no el
    // consolidado de la firma (ese es GET /pendientes).
    where: { organizacionId: org.id, estado: 'pendiente', OR: [{ responsableId: u.sub }, { creadoPorId: u.sub }] },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    select: SELECT,
    take: 300,
  });

  const hoy = hoyEnColombia();
  const conDia = filas.map((p) => {
    const dia = p.fecha.toISOString().slice(0, 10);
    return { ...p, dia, atrasado: dia < hoy, esHoy: dia === hoy };
  });
  res.json({
    hoy,
    total: conDia.length,
    atrasados: conDia.filter((p) => p.atrasado).length,
    deHoy: conDia.filter((p) => p.esHoy).length,
    pendientes: conDia,
  });
});

// GET /pendientes — consolidado. Coordinación ve todo; el resto, lo suyo.
// Filtros: ?empresaId= &responsableId= &estado= &desde= &hasta=
pendientesRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a pendientes.' });
  const org = await orgActual(req);
  if (!org) return res.json({ total: 0, pendientes: [], porEmpresa: [] });

  const { empresaId, responsableId, estado, desde, hasta } = req.query as Record<string, string | undefined>;
  const rango: Record<string, Date> = {};
  const d = diaCalendarioOpcional(desde); if (d) rango.gte = d;
  const h = diaCalendarioOpcional(hasta); if (h) rango.lte = h;

  const where: any = {
    organizacionId: org.id,
    ...alcanceDe(req.user),
    ...(empresaId ? { empresaId } : {}),
    ...(responsableId ? { responsableId } : {}),
    ...(estado && ESTADOS.includes(estado) ? { estado } : {}),
    ...(Object.keys(rango).length ? { fecha: rango } : {}),
  };

  const filas = await prisma.pendiente.findMany({
    where, orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], select: SELECT, take: 1000,
  });

  // "¿Cuánto trabajo fuera del plan nos genera cada cliente?" — la pregunta que
  // hoy nadie puede responder, y la razón por la que se guarda la empresa.
  const mapa = new Map<string, { empresa: string; total: number; abiertos: number }>();
  for (const p of filas) {
    const k = p.empresa?.id ?? '—';
    const e = mapa.get(k) ?? { empresa: p.empresa?.nombre ?? 'Sin cliente (interno)', total: 0, abiertos: 0 };
    e.total++; if (p.estado === 'pendiente') e.abiertos++;
    mapa.set(k, e);
  }
  const porEmpresa = [...mapa.values()].sort((a, b) => b.total - a.total);

  res.json({ total: filas.length, pendientes: filas, porEmpresa });
});

function diaCalendarioOpcional(v: unknown): Date | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? diaCalendario(v) : null;
}

// POST /pendientes
pendientesRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a pendientes.' });
  const org = await orgActual(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = req.user!;

  const titulo = texto(req.body?.titulo);
  if (!titulo) return res.status(422).json({ error: 'Escribe qué hay que hacer.' });

  // Asignarle trabajo a otra persona es de coordinación. Cualquiera puede
  // anotarse un pendiente propio.
  const responsableId = texto(req.body?.responsableId);
  if (responsableId && responsableId !== u.sub && !esCoordinacion(u)) {
    return res.status(403).json({ error: 'Solo la coordinación puede asignarle un pendiente a otra persona.' });
  }
  if (responsableId) {
    const existe = await prisma.usuario.findFirst({
      where: { id: responsableId, organizacionId: org.id, activo: true, empresaClienteId: null, grupoClienteId: null },
      select: { id: true },
    });
    if (!existe) return res.status(422).json({ error: 'La persona indicada no está activa en la firma.' });
  }

  const empresaId = texto(req.body?.empresaId);
  if (empresaId) {
    const emp = await prisma.empresa.findFirst({ where: { id: empresaId, organizacionId: org.id }, select: { id: true } });
    if (!emp) return res.status(422).json({ error: 'Cliente no encontrado.' });
  }

  const p = await prisma.pendiente.create({
    data: {
      organizacionId: org.id, titulo, detalle: texto(req.body?.detalle),
      fecha: diaCalendario(req.body?.fecha), // hoy si no viene
      empresaId, responsableId, creadoPorId: u.sub,
    },
    select: SELECT,
  });
  res.status(201).json({ ok: true, pendiente: p });
});

// PATCH /pendientes/:id — editar o cerrar/reabrir.
pendientesRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a pendientes.' });
  const org = await orgActual(req);
  const actual = await prisma.pendiente.findFirst({
    where: { id: req.params.id, organizacionId: org?.id },
    select: { id: true, responsableId: true, creadoPorId: true, estado: true },
  });
  if (!actual) return res.status(404).json({ error: 'Pendiente no encontrado.' });

  const u = req.user!;
  const suyo = actual.responsableId === u.sub || actual.creadoPorId === u.sub;
  if (!esCoordinacion(u) && !suyo) return res.status(403).json({ error: 'Este pendiente no es tuyo.' });

  const data: Record<string, any> = {};
  if ('titulo' in (req.body ?? {})) {
    const t = texto(req.body.titulo);
    if (!t) return res.status(422).json({ error: 'El título no puede quedar vacío.' });
    data.titulo = t;
  }
  if ('detalle' in (req.body ?? {})) data.detalle = texto(req.body.detalle);
  if ('fecha' in (req.body ?? {})) data.fecha = diaCalendario(req.body.fecha);
  if ('empresaId' in (req.body ?? {})) data.empresaId = texto(req.body.empresaId);
  if ('responsableId' in (req.body ?? {})) {
    const r = texto(req.body.responsableId);
    if (r && r !== u.sub && !esCoordinacion(u)) {
      return res.status(403).json({ error: 'Solo la coordinación puede asignarle un pendiente a otra persona.' });
    }
    data.responsableId = r;
  }
  if ('estado' in (req.body ?? {})) {
    const e = String(req.body.estado);
    if (!ESTADOS.includes(e)) return res.status(422).json({ error: 'Estado inválido.' });
    data.estado = e;
    // Quién cerró y cuándo. Al reabrir se limpia: si quedara el sello viejo, el
    // día que se vuelva a cerrar diría una fecha que no fue.
    if (e === 'hecho' && actual.estado !== 'hecho') { data.hechoEn = new Date(); data.hechoPorId = u.sub; }
    if (e === 'pendiente') { data.hechoEn = null; data.hechoPorId = null; }
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });

  const p = await prisma.pendiente.update({ where: { id: actual.id }, data, select: SELECT });
  res.json({ ok: true, pendiente: p });
});

// DELETE /pendientes/:id — solo quien lo creó o la coordinación.
pendientesRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!esUsuarioFirma(req.user)) return res.status(403).json({ error: 'Sin acceso a pendientes.' });
  const org = await orgActual(req);
  const p = await prisma.pendiente.findFirst({
    where: { id: req.params.id, organizacionId: org?.id }, select: { id: true, creadoPorId: true },
  });
  if (!p) return res.status(404).json({ error: 'Pendiente no encontrado.' });
  const u = req.user!;
  if (!esCoordinacion(u) && p.creadoPorId !== u.sub) {
    return res.status(403).json({ error: 'Solo quien lo creó (o la coordinación) puede eliminarlo.' });
  }
  await prisma.pendiente.delete({ where: { id: p.id } });
  res.json({ ok: true });
});
