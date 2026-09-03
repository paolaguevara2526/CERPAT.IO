// apps/api/src/routes/plan.ts
//
// Panel de Coordinación: indicadores de cumplimiento del Plan de Trabajo,
// agregados desde las tareas del plan (Tarea con actividadPlanId) y los
// vencimientos vinculados a una actividad (declaraciones controladas en
// Vencimientos), de un período. Ambas fuentes cuentan igual (ejecutado/vencido).
//
// TODO (auth/tenant): resolver la organización desde la sesión y restringir a rol
// Coordinador. Mientras no hay auth, resuelve la organización demo (slug "cerpat").
// Los ejes asesor/auxiliar quedarán poblados cuando existan usuarios y asignaciones.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';
import { alcancePortal } from '../auth/alcance-db.js';
import { esStaffAcotado } from '../auth/alcance.js';
import { limitePago } from '../vencimientos/reglas-pago.js';
import { vinculoDeObligacion } from '../vencimientos/vinculos.js';
import { diaCalendario } from '../plan/dia-calendario.js';
import { EJECUTADA, cuenta } from '../plan/medicion.js';
import { estaVencido, hoyEnColombia } from '../plan/dia-calendario.js';
import { puedeAuditar } from '../plan/auditoria.js';
import { decidirAutoEntrega, auxiliarPuedeLiberarArea } from '../plan/auto-entrega.js';

export const planRouter = Router();

// La regla de qué cuenta y qué no vive en plan/medicion.ts, con sus pruebas:
// "no aplica" sale de la medición entera (ni numerador ni denominador), y esa
// es la diferencia con "no realizado", que sí cuenta en contra.
// Un vencimiento cuenta como "ejecutado" cuando ya se presentó (con o sin pago).
const EJECUTADA_VENC = ['presentado_sin_pago', 'presentado_pagado', 'presentado_cero'];

// GET /plan/tareas — lista de tareas reales del plan (autenticado).
// Filtros: ?periodo=YYYY-MM &estado= &area= &q= (empresa/actividad) &mias=1
//   &prioridad= &asesorId= &auxiliarId= &estadoPago= &venceDesde=YYYY-MM-DD &venceHasta=
planRouter.get('/tareas', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodo: null, total: 0, tareas: [] });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const estado = typeof req.query.estado === 'string' && ESTADOS_VALIDOS.includes(req.query.estado) ? req.query.estado : undefined;
  const area = typeof req.query.area === 'string' && req.query.area ? req.query.area : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const mias = req.query.mias === '1' || req.query.mias === 'true';
  // Mi Día: además de "mías", filtra por lo que EJECUTA el usuario según el tipo
  // de actividad (la captura la hace el auxiliar; el resto, el asesor).
  const miDia = req.query.miDia === '1' || req.query.miDia === 'true';
  const prioridad = typeof req.query.prioridad === 'string' && ['alta', 'media', 'baja'].includes(req.query.prioridad) ? req.query.prioridad : undefined;
  // Fase de la cadena del cierre: captura · procesamiento · revisión. Sin este
  // filtro, "las capturas de agosto" no se podía pedir — había que reconocerlas
  // una por una por el nombre de la actividad.
  const fase = typeof req.query.fase === 'string' && FASES_PLAN.includes(req.query.fase) ? req.query.fase : undefined;
  // Cliente exacto, por id. La búsqueda por texto (`q`) no sirve para enlazar
  // desde otra pantalla: un nombre con comas o tildes no empareja de vuelta.
  const empresaId = typeof req.query.empresaId === 'string' && req.query.empresaId ? req.query.empresaId : undefined;
  const asesorId = typeof req.query.asesorId === 'string' && req.query.asesorId ? req.query.asesorId : undefined;
  const auxiliarId = typeof req.query.auxiliarId === 'string' && req.query.auxiliarId ? req.query.auxiliarId : undefined;
  const estadoPago = typeof req.query.estadoPago === 'string' && ESTADOS_PAGO.includes(req.query.estadoPago) ? req.query.estadoPago : undefined;
  const fecha = (v: unknown) => (typeof v === 'string' && v ? (isNaN(new Date(v).getTime()) ? undefined : new Date(v)) : undefined);
  const venceDesde = fecha(req.query.venceDesde);
  const venceHasta = fecha(req.query.venceHasta);
  const uid = req.user!.sub;

  // Paginación: ?page=1 &pageSize=50 (máx 200). Sin ?page se devuelve hasta 500
  // (compatibilidad con Tablero/Calendario/Mi Día, que agrupan el período completo).
  const pageRaw = parseInt(String(req.query.page ?? ''), 10);
  const paginado = Number.isFinite(pageRaw) && pageRaw >= 1;
  const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? ''), 10) || 50, 1), 200);
  const page = paginado ? pageRaw : 1;

  const where: any = {
    organizacionId: org.id,
    actividadPlanId: { not: null },
    periodo,
    ...(estado ? { estado: estado as any } : {}),
    ...(area ? { area: { nombre: area } } : {}),
    ...(prioridad ? { prioridad: prioridad as any } : {}),
    ...(empresaId ? { empresaId } : {}),
    ...(fase ? { actividadPlan: { fase } } : {}),
    ...(asesorId ? { asesorId } : {}),
    ...(auxiliarId ? { auxiliarId } : {}),
    ...(estadoPago ? { estadoPago: estadoPago as any } : {}),
    ...(venceDesde || venceHasta ? { fechaVencimiento: { ...(venceDesde ? { gte: venceDesde } : {}), ...(venceHasta ? { lte: venceHasta } : {}) } } : {}),
    ...(mias ? { OR: [{ asesorId: uid }, { auxiliarId: uid }] } : {}),
    ...(q ? { OR: [{ empresa: { nombre: { contains: q, mode: 'insensitive' } } }, { titulo: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  // Alcance: un Asesor/Auxiliar solo ve SUS tareas (donde es asesor o auxiliar).
  // Se combina con AND para no pisar otros OR (búsqueda/estado). Roles elevados ven todo.
  // Alcance de un Asesor/Auxiliar. No basta con "donde figura": las tareas
  // heredan asesor Y auxiliar de la asignación por cliente×área, así que un
  // auxiliar figura también en el procesamiento de sus clientes — trabajo que
  // no ejecuta. Le llenaba la Lista de tareas ajenas, la mayoría bloqueadas.
  //
  // El asesor TAMPOCO captura. Antes esta lista le mostraba la captura de sus
  // auxiliares mezclada con su propio trabajo, como si fuera suya. La captura
  // que ejecuta otra persona sale de aquí: para mirar cómo va está Mi Día, que
  // la muestra aparte y en solo lectura.
  //
  // Se conserva cuando NO hay auxiliar: ahí la captura sí la ejecuta él.
  if (esStaffAcotado(req.user)) {
    where.AND = [...(where.AND ?? []), {
      OR: [
        {
          asesorId: uid,
          OR: [
            { auxiliarId: null }, // sin auxiliar, la captura es suya
            { actividadPlan: { fase: { not: 'captura' } } },
            { actividadPlan: { fase: null } }, // sin clasificar: no se esconde
          ],
        },
        { auxiliarId: uid, actividadPlan: { fase: 'captura' } },
        // Sin asesor asignado no hay a quién más mostrárselo: se queda con él.
        { auxiliarId: uid, asesorId: null },
      ],
    }];
  }
  // Mi Día = solo lo que le toca EJECUTAR al usuario, por tipo de actividad:
  //  - captura → la ejecuta el auxiliar (o el asesor si no hay auxiliar);
  //  - procesamiento / revisión / sin fase → las ejecuta el asesor.
  // Así el asesor ve en Mi Día sus actividades (no la captura de sus auxiliares),
  // mientras que en la Lista siguen apareciendo ambas (sus tareas + las del área).
  if (miDia) {
    where.AND = [...(where.AND ?? []), {
      OR: [
        { asesorId: uid, NOT: { actividadPlan: { fase: 'captura' } } },
        { auxiliarId: uid, actividadPlan: { fase: 'captura' } },
        { asesorId: uid, auxiliarId: null, actividadPlan: { fase: 'captura' } },
      ],
    }];
  }

  const [total, tareas] = await Promise.all([
    prisma.tarea.count({ where }),
    prisma.tarea.findMany({
      where,
      select: {
        id: true, titulo: true, estado: true, prioridad: true, auditoria: true,
        fechaInicio: true, fechaVencimiento: true, periodo: true, empresaId: true, areaId: true,
        empresa: { select: { nombre: true } },
        area: { select: { nombre: true } },
        asesor: { select: { nombre: true } },
        auxiliar: { select: { nombre: true } },
        actividadPlan: { select: { fase: true } },
      },
      orderBy: [{ fechaVencimiento: 'asc' }, { titulo: 'asc' }],
      skip: paginado ? (page - 1) * pageSize : 0,
      take: paginado ? pageSize : 500,
    }),
  ]);

  // Bloqueo del flujo: una tarea de PROCESAMIENTO está bloqueada hasta que el
  // insumo del cliente se haya entregado (entrega general o de su área) en el período.
  const entregas = await prisma.entregaInsumo.findMany({ where: { organizacionId: org.id, periodo }, select: { empresaId: true, areaId: true } });
  const entSet = new Set(entregas.map((e) => `${e.empresaId}|${e.areaId ?? 'gen'}`));
  const bloqueada = (t: (typeof tareas)[number]) =>
    t.actividadPlan?.fase === 'procesamiento'
    && !entSet.has(`${t.empresaId}|gen`)
    && !(t.areaId ? entSet.has(`${t.empresaId}|${t.areaId}`) : false);

  res.json({
    periodo,
    total,
    page: paginado ? page : 1,
    pageSize: paginado ? pageSize : tareas.length,
    totalPaginas: paginado ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    tareas: tareas.map((t) => ({
      id: t.id, titulo: t.titulo, estado: t.estado, prioridad: t.prioridad, auditoria: t.auditoria,
      fechaVencimiento: t.fechaVencimiento, periodo: t.periodo,
      empresa: t.empresa?.nombre ?? null, area: t.area?.nombre ?? null,
      asesor: t.asesor?.nombre ?? null, auxiliar: t.auxiliar?.nombre ?? null,
      fase: t.actividadPlan?.fase ?? null, bloqueada: bloqueada(t),
    })),
  });
});

const ESTADOS_VALIDOS = ['por_iniciar', 'en_curso', 'en_revision', 'terminado', 'auditado', 'no_realizado', 'no_aplica'];
// Las fases de la cadena del cierre (ActividadPlan.fase).
const FASES_PLAN = ['captura', 'procesamiento', 'revision'];
// Terminar exige el checklist resuelto. "No aplica" NO: el checklist es de un
// trabajo que este mes no existió — exigirlo obligaría a marcar como hechos
// puntos que nadie hizo, que es justo lo que se quiere evitar.
const REQUIEREN_SUBTAREAS = ['terminado', 'auditado'];

// Auto-entrega (F1 — flujo del cierre): se libera POR ÁREA, para que cada asesor
// reciba solo lo suyo. La captura de Informes no espera a Nómina; Impuestos y
// Tesorería (sin captura propia) se auto-liberan cuando ya no queda captura
// pendiente en el cliente, o el auxiliar las suelta a mano. Reabrir una captura
// revierte solo el 'auto' de ESA área — nunca una entrega 'manual'/'auxiliar'
// ni el insumo de otra área. Ver docs/metodologia-operacion.md §F1 y
// plan/auto-entrega.ts. Best-effort: no bloquea el cambio de estado.
async function evaluarAutoEntrega(orgId: string, empresaId: string, periodo: string, tareaId: string, usuarioId: string | null): Promise<void> {
  const capturas = await prisma.tarea.findMany({
    where: { organizacionId: orgId, empresaId, periodo, actividadPlan: { fase: 'captura' } },
    select: { estado: true, areaId: true },
  });
  if (capturas.length === 0) return; // sin captura interna: no hay nada que auto-entregar

  const objetivo = await areasObjetivoCliente(orgId, empresaId, periodo);
  const { crear, revertir } = decidirAutoEntrega({ capturas, areasObjetivo: objetivo });

  // Política por área: descarta una entrega GENERAL automática antigua si quedó de una
  // versión anterior (nunca toca una general 'manual' de coordinación).
  await prisma.entregaInsumo.deleteMany({ where: { organizacionId: orgId, empresaId, periodo, areaId: null, origen: 'auto' } });

  if (revertir.length > 0) {
    const r = await prisma.entregaInsumo.deleteMany({
      where: { organizacionId: orgId, empresaId, periodo, origen: 'auto', areaId: { in: revertir } },
    });
    if (r.count > 0) await prisma.eventoTarea.create({ data: { organizacionId: orgId, tareaId, tipo: 'entrega', estadoAnterior: 'entregado', estadoNuevo: 'revertido', usuarioId } });
  }

  let creadas = 0;
  for (const areaId of crear) {
    const existe = await prisma.entregaInsumo.findFirst({ where: { organizacionId: orgId, empresaId, periodo, areaId } });
    if (!existe) {
      // El día de liberación se guarda como día del calendario COLOMBIANO: con
      // now() a secas, una captura terminada a las 8 p. m. quedaba registrada al
      // día siguiente, porque en UTC ya lo es.
      await prisma.entregaInsumo.create({ data: { organizacionId: orgId, empresaId, periodo, areaId, origen: 'auto', entregadoPorId: usuarioId, entregadoEn: diaCalendario(hoyEnColombia()) } });
      creadas++;
    }
  }
  if (creadas > 0) await prisma.eventoTarea.create({ data: { organizacionId: orgId, tareaId, tipo: 'entrega', estadoAnterior: null, estadoNuevo: 'entregado', usuarioId } });
}

// Áreas del cliente que reciben insumo de la firma este período: procesamiento
// del plan y/o vencimientos (declaraciones), excepto las de "insumo del cliente".
async function areasObjetivoCliente(orgId: string, empresaId: string, periodo: string): Promise<string[]> {
  const asigs = await prisma.asignacionClienteArea.findMany({
    where: { organizacionId: orgId, empresaId, insumoCliente: true },
    select: { areaId: true },
  });
  const insumoClienteAreas = new Set(asigs.map((a) => a.areaId));

  const areasProc = await prisma.tarea.findMany({
    where: { organizacionId: orgId, empresaId, periodo, actividadPlan: { fase: 'procesamiento' }, areaId: { not: null } },
    select: { areaId: true }, distinct: ['areaId'],
  });

  const [anioP, mesP] = periodo.split('-').map(Number);
  const desdeV = new Date(Date.UTC(anioP, mesP - 1, 1));
  const hastaV = new Date(Date.UTC(anioP, mesP, 1));
  const [actsVinc, vencs] = await Promise.all([
    prisma.actividadPlan.findMany({ where: { organizacionId: orgId, obligacionVencimiento: { not: null }, areaId: { not: null } }, select: { obligacionVencimiento: true, areaId: true } }),
    prisma.vencimientoEmpresa.findMany({ where: { organizacionId: orgId, empresaId, fechaVencimiento: { gte: desdeV, lt: hastaV } }, select: { obligacion: true } }),
  ]);
  const areaPorKey = new Map(actsVinc.map((a) => [a.obligacionVencimiento as string, a.areaId as string]));
  const areasVenc = new Set<string>();
  for (const v of vencs) {
    const key = vinculoDeObligacion(v.obligacion);
    const areaId = key ? areaPorKey.get(key) : undefined;
    if (areaId) areasVenc.add(areaId);
  }

  return Array.from(new Set([
    ...areasProc.map((t) => t.areaId as string),
    ...areasVenc,
  ])).filter((id) => !insumoClienteAreas.has(id));
}

// PATCH /plan/tareas/:id/estado  { estado }  — cambia el estado con reglas de negocio.
planRouter.patch('/tareas/:id/estado', requireAuth, async (req: AuthedRequest, res) => {
  const estado = String(req.body?.estado ?? '');
  if (!ESTADOS_VALIDOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });

  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({
    where: { id: req.params.id, organizacionId: org?.id },
    include: { subtareas: true, actividadPlan: { select: { fase: true } } },
  });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });

  // Permiso: root, Administrador/Coordinador, o el asesor/auxiliar de la tarea.
  const u = req.user!;
  const puede = u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)) || tarea.asesorId === u.sub || tarea.auxiliarId === u.sub;
  if (!puede) return res.status(403).json({ error: 'No puedes cambiar esta tarea (no eres su asesor/auxiliar ni tienes rol de coordinación).' });

  // Regla: no editar una tarea ya aprobada en auditoría sin desbloquear primero.
  if (tarea.auditoria === 'aprobada') return res.status(403).json({ error: 'La tarea está bloqueada (aprobada en Auditoría). Debe desbloquearse primero.' });

  // Regla: no marcar Terminado/Auditado con subtareas pendientes.
  if (REQUIEREN_SUBTAREAS.includes(estado) && tarea.subtareas.some((s) => s.estado === 'pendiente')) {
    return res.status(422).json({ error: `No se puede marcar "${estado}" con subtareas sin resolver.` });
  }

  const actualizada = await prisma.tarea.update({ where: { id: tarea.id }, data: { estado: estado as any } });
  // Bitácora: registra el cambio de estado (quién y cuándo) para medir tiempos.
  await prisma.eventoTarea.create({
    data: { organizacionId: tarea.organizacionId, tareaId: tarea.id, tipo: 'estado', estadoAnterior: tarea.estado, estadoNuevo: estado, usuarioId: u.sub },
  });

  // Auto-entrega: si la tarea es de captura, reevalúa si el insumo del cliente ya
  // quedó listo (o dejó de estarlo). Best-effort: no interrumpe el cambio de estado.
  if (tarea.actividadPlan?.fase === 'captura' && tarea.periodo) {
    try {
      await evaluarAutoEntrega(tarea.organizacionId, tarea.empresaId, tarea.periodo, tarea.id, u.sub);
    } catch (e) {
      console.error('[auto-entrega] falló al reevaluar', { tareaId: tarea.id, error: e instanceof Error ? e.message : e });
    }
  }

  res.json({ ok: true, id: actualizada.id, estado: actualizada.estado });
});

// GET /plan/auditoria — cola de tareas enviadas a auditoría (estado en_revision,
// sin aprobar aún) del período. Autenticado.
// GET /plan/periodos — los meses que tienen plan generado, del más reciente al
// más antiguo.
//
// Es lo que le permite al navegador de mes ofrecer solo meses con contenido. Sin
// esto, devolverse de septiembre a agosto puede caer en una pantalla vacía que
// no distingue "este mes no se generó" de "el planeador está fallando" — y la
// segunda lectura es la que hace que se deje de confiar en la herramienta.
planRouter.get('/periodos', requireAuth, async (req, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodos: [] });
  const filas = await prisma.tarea.groupBy({
    by: ['periodo'],
    where: { organizacionId: org.id, actividadPlanId: { not: null }, periodo: { not: null } },
    _count: { _all: true },
  });
  const periodos = filas
    .filter((f) => f.periodo)
    .map((f) => ({ periodo: f.periodo as string, tareas: f._count._all }))
    .sort((a, b) => b.periodo.localeCompare(a.periodo));
  res.json({ periodos });
});

planRouter.get('/auditoria', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodo: null, total: 0, tareas: [] });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const tareas = await prisma.tarea.findMany({
    where: {
      organizacionId: org.id,
      actividadPlanId: { not: null },
      periodo,
      estado: 'en_revision',
      auditoria: { not: 'aprobada' },
    },
    select: {
      id: true, titulo: true, estado: true, auditoria: true, requiereRevisionTecnica: true,
      observaciones: true, fechaVencimiento: true, periodo: true,
      empresa: { select: { nombre: true } },
      area: { select: { nombre: true } },
      asesor: { select: { id: true, nombre: true } },
      auxiliar: { select: { id: true, nombre: true } },
    },
    orderBy: [{ fechaVencimiento: 'asc' }, { titulo: 'asc' }],
    take: 500,
  });

  res.json({
    periodo,
    total: tareas.length,
    tareas: tareas.map((t) => ({
      id: t.id, titulo: t.titulo, estado: t.estado, auditoria: t.auditoria,
      requiereRevisionTecnica: t.requiereRevisionTecnica, observaciones: t.observaciones,
      fechaVencimiento: t.fechaVencimiento, periodo: t.periodo,
      empresa: t.empresa?.nombre ?? null, area: t.area?.nombre ?? null,
      asesor: t.asesor?.nombre ?? null, auxiliar: t.auxiliar?.nombre ?? null,
    })),
  });
});

// PATCH /plan/tareas/:id/auditoria  { accion: 'aprobar' | 'devolver', observaciones? }
// Aprobar: estado -> auditado, auditoria -> aprobada (bloquea). Devolver: estado ->
// en_curso, auditoria -> rechazada, guarda observaciones. Solo coordinación o el asesor.
planRouter.patch('/tareas/:id/auditoria', requireAuth, async (req: AuthedRequest, res) => {
  const accion = String(req.body?.accion ?? '');
  if (accion !== 'aprobar' && accion !== 'devolver') return res.status(400).json({ error: 'Acción inválida.' });

  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });

  // Quién audita: ver plan/auditoria.ts, con sus pruebas. Incluye el rol
  // Auditor, que estaba faltando: veía la cola y el botón le devolvía un 403.
  const u = req.user!;
  if (!puedeAuditar(u, tarea)) {
    return res.status(403).json({ error: 'Solo coordinación, auditoría o el asesor del área puede auditar esta tarea.' });
  }

  if (tarea.auditoria === 'aprobada') return res.status(409).json({ error: 'La tarea ya fue aprobada en auditoría.' });

  if (accion === 'aprobar') {
    const actualizada = await prisma.tarea.update({
      where: { id: tarea.id },
      data: { estado: 'auditado', auditoria: 'aprobada' },
    });
    return res.json({ ok: true, id: actualizada.id, estado: actualizada.estado, auditoria: actualizada.auditoria });
  }

  // devolver
  const observaciones = String(req.body?.observaciones ?? '').trim();
  if (!observaciones) return res.status(422).json({ error: 'Indica las observaciones para devolver la tarea.' });
  const actualizada = await prisma.tarea.update({
    where: { id: tarea.id },
    data: { estado: 'en_curso', auditoria: 'rechazada', observaciones },
  });
  res.json({ ok: true, id: actualizada.id, estado: actualizada.estado, auditoria: actualizada.auditoria });
});

const ESTADOS_PAGO = ['pendiente', 'presentado_sin_pago', 'presentado_pagado', 'no_presentado'];

// GET /plan/pagos — obligaciones con pago (tareas generaPago) del período. Autenticado.
planRouter.get('/pagos', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodo: null, total: 0, tareas: [] });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const estadoPago = typeof req.query.estadoPago === 'string' ? req.query.estadoPago : undefined;
  // Tablero de control: además del mes elegido, arrastra las obligaciones de
  // meses anteriores (mismo año) que siguen sin pagar y ya vencieron.
  const incluirAtrasadas = req.query.incluirAtrasadas === '1' || req.query.incluirAtrasadas === 'true';
  const filtroEstado = estadoPago && ESTADOS_PAGO.includes(estadoPago) ? { estadoPago: estadoPago as any } : {};
  const anioSel = periodo.slice(0, 4);

  const tareas = await prisma.tarea.findMany({
    where: {
      organizacionId: org.id,
      actividadPlanId: { not: null },
      generaPago: true,
      ...filtroEstado,
      ...(incluirAtrasadas
        ? {
            OR: [
              { periodo },
              // atrasadas: meses anteriores del año, sin pagar y ya vencidas
              { periodo: { gte: `${anioSel}-01`, lt: periodo }, estadoPago: { not: 'presentado_pagado' as any }, fechaVencimiento: { lt: now } },
            ],
          }
        : { periodo }),
    },
    select: {
      id: true, titulo: true, estado: true, valorPago: true, estadoPago: true,
      fechaVencimiento: true, periodo: true,
      empresa: { select: { nombre: true } },
      tipoObligacion: { select: { nombre: true } },
      area: { select: { nombre: true } },
      asesor: { select: { nombre: true } },
      auxiliar: { select: { nombre: true } },
    },
    orderBy: [{ fechaVencimiento: 'asc' }, { titulo: 'asc' }],
    take: 800,
  });

  res.json({
    periodo,
    total: tareas.length,
    tareas: tareas.map((t) => {
      // Las tareas del plan no llevan tipoObligacion; el nombre de la
      // obligación vive en el título de la actividad. Usa ese como respaldo
      // para que la regla de "límite de pago" (ineficacia / RST) sí aplique.
      const lp = limitePago(t.fechaVencimiento, t.tipoObligacion?.nombre ?? t.titulo, t.valorPago != null ? Number(t.valorPago) : null);
      return {
        id: t.id, titulo: t.titulo, estado: t.estado,
        valorPago: t.valorPago != null ? Number(t.valorPago) : null, estadoPago: t.estadoPago,
        fechaVencimiento: t.fechaVencimiento, periodo: t.periodo,
        fechaLimitePago: lp.fechaLimitePago, consecuencia: lp.consecuencia,
        empresa: t.empresa?.nombre ?? null, obligacion: t.tipoObligacion?.nombre ?? null,
        area: t.area?.nombre ?? null, asesor: t.asesor?.nombre ?? null, auxiliar: t.auxiliar?.nombre ?? null,
      };
    }),
  });
});

// PATCH /plan/tareas/:id/pago  { valorPago?, estadoPago? } — el ejecutor digita el
// valor y el estado del pago. Permiso: coordinación o asesor/auxiliar de la tarea.
planRouter.patch('/tareas/:id/pago', requireAuth, async (req: AuthedRequest, res) => {
  const tieneValor = req.body?.valorPago !== undefined && req.body?.valorPago !== null && req.body?.valorPago !== '';
  const tieneEstado = typeof req.body?.estadoPago === 'string';
  if (!tieneValor && !tieneEstado) return res.status(400).json({ error: 'No hay cambios que guardar.' });

  let valor: number | undefined;
  if (tieneValor) {
    valor = Number(req.body.valorPago);
    if (!Number.isFinite(valor) || valor < 0) return res.status(422).json({ error: 'El valor del pago no es válido.' });
  }
  if (tieneEstado && !ESTADOS_PAGO.includes(req.body.estadoPago)) return res.status(400).json({ error: 'Estado de pago inválido.' });

  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });

  const u = req.user!;
  const puede = u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)) || tarea.asesorId === u.sub || tarea.auxiliarId === u.sub;
  if (!puede) return res.status(403).json({ error: 'No puedes registrar el pago de esta tarea.' });

  const actualizada = await prisma.tarea.update({
    where: { id: tarea.id },
    data: {
      ...(tieneValor ? { valorPago: valor } : {}),
      ...(tieneEstado ? { estadoPago: req.body.estadoPago as any } : {}),
    },
    select: { id: true, valorPago: true, estadoPago: true },
  });
  res.json({ ok: true, id: actualizada.id, valorPago: actualizada.valorPago != null ? Number(actualizada.valorPago) : null, estadoPago: actualizada.estadoPago });
});

// GET /plan/asignaciones — tablero de asignaciones (asesor/auxiliar por cliente y
// área). Coordinación/Administrador/root ve todo; un Asesor/Auxiliar ve solo las
// empresas donde figura. Base del "tablero por área" y de "qué empresas tengo".
planRouter.get('/asignaciones', requireAuth, async (req: AuthedRequest, res) => {
  const u = req.user;
  const esFirma = !!u && (u.esRoot || (u.roles.length > 0 && !u.empresaCliente && !u.grupoCliente));
  if (!esFirma) return res.status(403).json({ error: 'Sin acceso a asignaciones.' });
  const org = await orgDeSesion(req);
  if (!org) return res.json({ esCoordinacion: false, yoId: u!.sub, areas: [], personas: [] });

  const acotado = esStaffAcotado(u);
  const uid = u!.sub;
  const asigs = await prisma.asignacionClienteArea.findMany({
    // Solo clientes ACTIVOS: al inactivar una empresa su asignación queda en la
    // base (para no perder el historial), pero el tablero es de operación —
    // mostrar ahí un cliente que ya no se atiende infla la carga de cada persona
    // y confunde a quien lo lee.
    where: {
      organizacionId: org.id,
      empresa: { activo: true },
      ...(acotado ? { OR: [{ asesorId: uid }, { auxiliarId: uid }] } : {}),
    },
    select: {
      empresaId: true,
      empresa: { select: { nombre: true } },
      area: { select: { id: true, nombre: true, orden: true } },
      asesor: { select: { id: true, nombre: true } },
      auxiliar: { select: { id: true, nombre: true } },
    },
  });

  // Filas planas (un cliente × área con su asesor y auxiliar). El cliente hace el
  // pivoteo (por persona / área / cliente), los filtros y las métricas en vivo.
  const filas = asigs
    .map((a) => ({
      empresaId: a.empresaId, empresa: a.empresa?.nombre ?? '—',
      areaId: a.area?.id ?? null, area: a.area?.nombre ?? '(sin área)', areaOrden: a.area?.orden ?? 999,
      asesorId: a.asesor?.id ?? null, asesor: a.asesor?.nombre ?? null,
      auxiliarId: a.auxiliar?.id ?? null, auxiliar: a.auxiliar?.nombre ?? null,
    }))
    .sort((x, y) => x.areaOrden - y.areaOrden || x.area.localeCompare(y.area, 'es') || x.empresa.localeCompare(y.empresa, 'es'));

  res.json({ esCoordinacion: puedeGestionar(u!), yoId: uid, filas });
});

// ---------- Crear / editar / eliminar tareas (Coordinador/Administrador/root) ----------

const PRIORIDADES = ['alta', 'media', 'baja'];
const ESTADOS_SUBTAREA = ['pendiente', 'realizada', 'no_aplica', 'no_realizada'];

function puedeGestionar(u: { esRoot: boolean; roles: string[] }): boolean {
  return u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r));
}

// Datos comunes para el formulario de tarea (selects): clientes, áreas, personas.
planRouter.get('/form-datos', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ empresas: [], areas: [], usuarios: [] });
  const [empresas, areas, usuarios] = await Promise.all([
    prisma.empresa.findMany({ where: { organizacionId: org.id, activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.area.findMany({ where: { organizacionId: org.id }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], select: { id: true, nombre: true } }),
    prisma.usuario.findMany({ where: { organizacionId: org.id, activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ]);
  res.json({ empresas, areas, usuarios });
});

function datosTarea(body: any): { data: Record<string, any>; error?: string } {
  const data: Record<string, any> = {};
  if (typeof body?.titulo === 'string' && body.titulo.trim()) data.titulo = body.titulo.trim();
  if ('empresaId' in (body ?? {}) && body.empresaId) data.empresaId = body.empresaId;
  if ('areaId' in (body ?? {})) data.areaId = body.areaId || null;
  if ('asesorId' in (body ?? {})) data.asesorId = body.asesorId || null;
  if ('auxiliarId' in (body ?? {})) data.auxiliarId = body.auxiliarId || null;
  if (typeof body?.prioridad === 'string') {
    if (!PRIORIDADES.includes(body.prioridad)) return { data, error: 'Prioridad inválida.' };
    data.prioridad = body.prioridad;
  }
  if ('periodo' in (body ?? {})) data.periodo = body.periodo && /^\d{4}-\d{2}$/.test(body.periodo) ? body.periodo : (body.periodo ? undefined : null);
  if (data.periodo === undefined && 'periodo' in (body ?? {})) return { data, error: 'El período debe ser YYYY-MM.' };
  if ('observaciones' in (body ?? {})) data.observaciones = typeof body.observaciones === 'string' && body.observaciones.trim() ? body.observaciones.trim() : null;
  if ('soporteLink' in (body ?? {})) data.soporteLink = typeof body.soporteLink === 'string' && body.soporteLink.trim() ? body.soporteLink.trim() : null;
  if ('requiereSoporte' in (body ?? {})) data.requiereSoporte = !!body.requiereSoporte;
  if ('generaPago' in (body ?? {})) data.generaPago = !!body.generaPago;
  if ('requiereRevisionTecnica' in (body ?? {})) data.requiereRevisionTecnica = !!body.requiereRevisionTecnica;
  for (const f of ['fechaInicio', 'fechaVencimiento'] as const) {
    if (f in (body ?? {})) {
      const d = body[f] ? new Date(body[f]) : null;
      if (!d || isNaN(d.getTime())) return { data, error: `Fecha (${f}) inválida.` };
      data[f] = d;
    }
  }
  return { data };
}

// Una tarea con sus ids (para el formulario de edición).
planRouter.get('/tareas/:id/detalle', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const t = await prisma.tarea.findFirst({
    where: { id: req.params.id, organizacionId: org?.id },
    select: {
      id: true, titulo: true, empresaId: true, areaId: true, asesorId: true, auxiliarId: true,
      prioridad: true, estado: true, periodo: true, observaciones: true, generaPago: true,
      requiereRevisionTecnica: true, auditoria: true, fechaInicio: true, fechaVencimiento: true,
      comprobanteDesde: true, comprobanteHasta: true, cantidadRegistros: true,
      createdAt: true, soporteLink: true, requiereSoporte: true, estadoPago: true, valorPago: true,
      empresa: { select: { nombre: true } },
      area: { select: { nombre: true } },
      creadoPor: { select: { nombre: true } },
      asesor: { select: { nombre: true } },
      auxiliar: { select: { nombre: true } },
      asignados: { select: { usuario: { select: { nombre: true } } } },
      etiquetas: { select: { etiqueta: { select: { nombre: true } } } },
      actividadPlan: { select: { esRegistroSoftware: true, esCapturaDocumentos: true } },
    },
  });
  if (!t) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const { actividadPlan, empresa, area, creadoPor, asesor, auxiliar, asignados, etiquetas, valorPago, ...rest } = t;
  res.json({
    tarea: {
      ...rest,
      esRegistroSoftware: actividadPlan?.esRegistroSoftware ?? false,
      esCapturaDocumentos: actividadPlan?.esCapturaDocumentos ?? false,
      // Nombres (para la vista de detalle; los *Id de arriba siguen para el formulario de edición).
      empresa: empresa?.nombre ?? null,
      area: area?.nombre ?? null,
      creadoPor: creadoPor?.nombre ?? null,
      asesor: asesor?.nombre ?? null,
      auxiliar: auxiliar?.nombre ?? null,
      asignados: asignados.map((a) => a.usuario?.nombre).filter(Boolean),
      etiquetas: etiquetas.map((e) => e.etiqueta?.nombre).filter(Boolean),
      valorPago: valorPago != null ? Number(valorPago) : null,
    },
  });
});

// ---------- Captura de documentos: lotes (F1.2b) ----------
// El auxiliar registra, por tipo de documento, el rango de consecutivos y la
// cantidad, con su fecha. Trabajo diario dentro de la tarea "Captura de documentos".

const loteSelect = { id: true, tipoDocumento: true, prefijo: true, desde: true, hasta: true, cantidad: true, fecha: true } as const;

// GET /plan/tareas/:id/lotes
planRouter.get('/tareas/:id/lotes', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id }, select: { id: true } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const lotes = await prisma.loteCaptura.findMany({ where: { tareaId: tarea.id }, orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], select: loteSelect });
  res.json({ lotes });
});

// POST /plan/tareas/:id/lotes  { tipoDocumento, desde?, hasta?, cantidad?, fecha? }
planRouter.post('/tareas/:id/lotes', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id }, select: { id: true, organizacionId: true, asesorId: true, auxiliarId: true } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const u = req.user!;
  if (!(puedeGestionar(u) || tarea.asesorId === u.sub || tarea.auxiliarId === u.sub))
    return res.status(403).json({ error: 'No puedes registrar la captura de esta tarea (no eres su asesor/auxiliar ni tienes rol de coordinación).' });

  const tipoDocumento = String(req.body?.tipoDocumento ?? '').trim();
  if (!tipoDocumento) return res.status(422).json({ error: 'Indica el tipo de documento.' });
  const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const n = Number(req.body?.cantidad);
  const cantidad = req.body?.cantidad !== '' && req.body?.cantidad != null && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
  const fecha = diaCalendario(req.body?.fecha);
  const lote = await prisma.loteCaptura.create({
    data: { organizacionId: tarea.organizacionId, tareaId: tarea.id, tipoDocumento, prefijo: txt(req.body?.prefijo), desde: txt(req.body?.desde), hasta: txt(req.body?.hasta), cantidad, fecha },
    select: loteSelect,
  });
  res.json({ ok: true, lote });
});

// PATCH /plan/lotes/:id — corregir un lote ya registrado.
//
// Quien captura se equivoca en un consecutivo o en la fecha y hasta ahora no
// tenía cómo arreglarlo: solo existía borrar, y borrar no lo podía hacer él.
// Tenía que pedírselo a coordinación por cada dígito mal escrito.
//
// El permiso es el mismo con el que se registra: quien puede crear el lote
// puede corregirlo. No se permite cambiar de tarea — para eso se borra y se
// vuelve a registrar donde corresponde.
planRouter.patch('/lotes/:id', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const lote = await prisma.loteCaptura.findFirst({
    where: { id: req.params.id, organizacionId: org?.id },
    select: { id: true, tarea: { select: { asesorId: true, auxiliarId: true, auditoria: true } } },
  });
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado.' });
  const u = req.user!;
  if (!(puedeGestionar(u) || lote.tarea.asesorId === u.sub || lote.tarea.auxiliarId === u.sub))
    return res.status(403).json({ error: 'No puedes editar este lote (no eres su asesor/auxiliar ni tienes rol de coordinación).' });
  // Misma regla que el resto de la tarea: lo aprobado en auditoría no se toca
  // sin desbloquear. Si no, se podría cambiar la captura por debajo de un
  // cierre ya aprobado.
  if (lote.tarea.auditoria === 'aprobada') return res.status(403).json({ error: 'La tarea está bloqueada (aprobada en Auditoría). Debe desbloquearse primero.' });

  const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const data: Record<string, any> = {};
  if ('tipoDocumento' in (req.body ?? {})) {
    const t = String(req.body.tipoDocumento ?? '').trim();
    if (!t) return res.status(422).json({ error: 'Indica el tipo de documento.' });
    data.tipoDocumento = t;
  }
  for (const c of ['prefijo', 'desde', 'hasta'] as const) if (c in (req.body ?? {})) data[c] = txt(req.body[c]);
  if ('cantidad' in (req.body ?? {})) {
    const v = req.body.cantidad;
    if (v === null || v === '') data.cantidad = null;
    else { const n = Number(v); if (!Number.isFinite(n) || n < 0) return res.status(422).json({ error: 'La cantidad debe ser un número ≥ 0.' }); data.cantidad = Math.trunc(n); }
  }
  if ('fecha' in (req.body ?? {})) data.fecha = diaCalendario(req.body.fecha);
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });

  const actualizado = await prisma.loteCaptura.update({ where: { id: lote.id }, data, select: loteSelect });
  res.json({ ok: true, lote: actualizado });
});

// DELETE /plan/lotes/:id
planRouter.delete('/lotes/:id', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const lote = await prisma.loteCaptura.findFirst({ where: { id: req.params.id, organizacionId: org?.id }, select: { id: true, tarea: { select: { asesorId: true, auxiliarId: true } } } });
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado.' });
  const u = req.user!;
  if (!(puedeGestionar(u) || lote.tarea.asesorId === u.sub || lote.tarea.auxiliarId === u.sub))
    return res.status(403).json({ error: 'No puedes eliminar este lote.' });
  await prisma.loteCaptura.delete({ where: { id: lote.id } });
  res.json({ ok: true });
});

// GET /plan/mi-dia/captura — resumen de las tareas "Captura de documentos" del
// usuario (todas sus empresas del período), con el conteo de lotes registrados y
// los de hoy, para capturar sin ir cliente por cliente. F1.3 — "Mi día del auxiliar".
planRouter.get('/mi-dia/captura', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodo: null, hoy: null, total: 0, capturadosHoy: 0, tareas: [] });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const u = req.user!;
  const uid = u.sub;

  // Coordinación/root ve todas las capturas del período; el ejecutor, las suyas.
  const gestiona = puedeGestionar(u);
  const scope = gestiona ? {} : { OR: [{ asesorId: uid }, { auxiliarId: uid }] };

  const tareas = await prisma.tarea.findMany({
    where: {
      organizacionId: org.id, periodo, actividadPlanId: { not: null },
      actividadPlan: { esCapturaDocumentos: true },
      ...scope,
    },
    select: {
      id: true, estado: true, asesorId: true, auxiliarId: true,
      empresa: { select: { nombre: true } },
      area: { select: { nombre: true } },
      auxiliar: { select: { nombre: true } },
    },
    orderBy: [{ empresa: { nombre: 'asc' } }],
    take: 500,
  });

  // Quién CAPTURA y quién solo MIRA. La captura la ejecuta el auxiliar; el asesor
  // solo cuando el cliente no tiene auxiliar asignado. Antes esta bandeja no
  // distinguía, y al asesor le salían once clientes con botón de "Registrar lote"
  // — trabajo que no hace y que, si lo hiciera, taparía que su auxiliar no lo hizo.
  // Sigue viendo los de sus auxiliares, pero en solo lectura: necesita saber cómo
  // va la captura porque de ella depende que se le libere el insumo.
  const rolDe = (t: { asesorId: string | null; auxiliarId: string | null }): 'ejecuta' | 'observa' => {
    if (gestiona) return 'ejecuta';
    if (t.auxiliarId === uid) return 'ejecuta';
    if (t.asesorId === uid && t.auxiliarId === null) return 'ejecuta';
    return 'observa';
  };

  const ids = tareas.map((t) => t.id);
  // Límites del día (UTC) para contar los lotes capturados hoy.
  const hoyIni = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const hoyFin = new Date(hoyIni.getTime() + 24 * 3600 * 1000);
  const [agg, aggHoy] = ids.length
    ? await Promise.all([
        prisma.loteCaptura.groupBy({ by: ['tareaId'], where: { tareaId: { in: ids } }, _count: { _all: true }, _max: { fecha: true } }),
        prisma.loteCaptura.groupBy({ by: ['tareaId'], where: { tareaId: { in: ids }, fecha: { gte: hoyIni, lt: hoyFin } }, _count: { _all: true } }),
      ])
    : [[] as any[], [] as any[]];
  const totMap = new Map(agg.map((a) => [a.tareaId, { n: a._count._all, ult: a._max.fecha as Date | null }]));
  const hoyMap = new Map(aggHoy.map((a) => [a.tareaId, a._count._all]));

  let capturadosHoy = 0;
  const filas = tareas.map((t) => {
    const tot = totMap.get(t.id);
    const lh = hoyMap.get(t.id) ?? 0;
    const rol = rolDe(t);
    if (lh > 0 && rol === 'ejecuta') capturadosHoy++;
    return {
      id: t.id, estado: t.estado, rol,
      empresa: t.empresa?.nombre ?? '—', area: t.area?.nombre ?? null,
      auxiliar: t.auxiliar?.nombre ?? null,
      totalLotes: tot?.n ?? 0, lotesHoy: lh, ultimaFecha: tot?.ult ?? null,
    };
  });

  res.json({
    periodo,
    hoy: hoyIni.toISOString().slice(0, 10),
    // `total` es lo que le toca capturar a esta persona; lo de sus auxiliares va
    // aparte para que el contador de su bandeja no cuente trabajo ajeno.
    total: filas.filter((f) => f.rol === 'ejecuta').length,
    totalObservadas: filas.filter((f) => f.rol === 'observa').length,
    capturadosHoy,
    tareas: filas,
  });
});

// ---------- Recepción del insumo del cliente ----------
//
// En las áreas marcadas "insumo del cliente" no hay auxiliar que capture ni que
// libere: el insumo lo manda el cliente. Por eso quedan fuera de la liberación
// automática — y hasta ahora eso significaba que NADA las destrababa nunca.
//
// Lo marca quien recibe: el asesor o el auxiliar del área (y coordinación).
// Restringirlo solo al asesor haría que el trabajo se acumule esperando a que él
// entre a marcar algo que su auxiliar ya tiene en las manos.

const PERIODO_RE = /^\d{4}-\d{2}$/;
const periodoDeHoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// GET /plan/insumo-cliente?periodo=YYYY-MM
// Las áreas de insumo del cliente del usuario, marcadas y sin marcar.
planRouter.get('/insumo-cliente', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodo: null, esCoordinacion: false, total: 0, pendientes: 0, filas: [] });
  const periodo = typeof req.query.periodo === 'string' && PERIODO_RE.test(req.query.periodo) ? req.query.periodo : periodoDeHoy();
  const u = req.user!;
  const uid = u.sub;
  // Coordinación ve todo: de ahí sale la lista de clientes que no han entregado.
  // Se devuelve cuál de los dos alcances se aplicó, porque la pantalla tiene que
  // decir por qué lista lo que lista: con el mismo texto para los dos, quien
  // tiene rol de coordinación lee "son tus clientes" sobre la lista completa de
  // la firma y sale a buscar un error de asignación que no existe.
  const esCoordinacion = puedeGestionar(u);
  const scope = esCoordinacion ? {} : { OR: [{ asesorId: uid }, { auxiliarId: uid }] };

  const asigs = await prisma.asignacionClienteArea.findMany({
    where: { organizacionId: org.id, insumoCliente: true, empresa: { activo: true }, ...scope },
    select: {
      empresaId: true, areaId: true,
      empresa: { select: { nombre: true } }, area: { select: { nombre: true } },
      asesor: { select: { nombre: true } }, auxiliar: { select: { nombre: true } },
    },
  });
  if (asigs.length === 0) return res.json({ periodo, esCoordinacion, total: 0, pendientes: 0, filas: [] });

  const entregas = await prisma.entregaInsumo.findMany({
    where: { organizacionId: org.id, periodo, empresaId: { in: [...new Set(asigs.map((a) => a.empresaId))] } },
    select: { empresaId: true, areaId: true, entregadoEn: true, entregadoPor: { select: { nombre: true } } },
  });
  const entMap = new Map(entregas.filter((e) => e.areaId).map((e) => [`${e.empresaId}|${e.areaId}`, e]));

  // Días esperando: se cuentan desde que empezó el período, que es cuando el
  // cliente ya debería estar mandando.
  const [anio, mes] = periodo.split('-').map(Number);
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const hoy = new Date();
  const diasDesdeInicio = Math.max(0, Math.floor((hoy.getTime() - inicio.getTime()) / 86400000));

  const filas = asigs.map((a) => {
    const e = entMap.get(`${a.empresaId}|${a.areaId}`);
    return {
      empresaId: a.empresaId, areaId: a.areaId,
      empresa: a.empresa?.nombre ?? '—', area: a.area?.nombre ?? '—',
      asesor: a.asesor?.nombre ?? null, auxiliar: a.auxiliar?.nombre ?? null,
      recibido: !!e,
      fechaEntrega: e?.entregadoEn ?? null,
      marcadoPor: e?.entregadoPor?.nombre ?? null,
      diasEsperando: e ? 0 : diasDesdeInicio,
    };
  }).sort((x, y) => (x.recibido === y.recibido ? x.empresa.localeCompare(y.empresa, 'es') : x.recibido ? 1 : -1));

  res.json({ periodo, esCoordinacion, total: filas.length, pendientes: filas.filter((f) => !f.recibido).length, filas });
});

// POST /plan/insumo-cliente { empresaId, areaId, periodo, fecha }
// Marca que el cliente ya entregó. `fecha` es la de ENTREGA, no la de hoy.
planRouter.post('/insumo-cliente', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { empresaId, areaId } = req.body ?? {};
  if (typeof empresaId !== 'string' || typeof areaId !== 'string') return res.status(422).json({ error: 'Faltan el cliente y el área.' });
  const periodo = typeof req.body?.periodo === 'string' && PERIODO_RE.test(req.body.periodo) ? req.body.periodo : periodoDeHoy();

  const asig = await prisma.asignacionClienteArea.findFirst({
    where: { organizacionId: org.id, empresaId, areaId },
    select: { asesorId: true, auxiliarId: true, insumoCliente: true },
  });
  if (!asig) return res.status(404).json({ error: 'Ese cliente no tiene asignada esa área.' });
  if (!asig.insumoCliente) return res.status(422).json({ error: 'Esa área no está marcada como "insumo del cliente".' });
  const u = req.user!;
  if (!puedeGestionar(u) && asig.asesorId !== u.sub && asig.auxiliarId !== u.sub) {
    return res.status(403).json({ error: 'Esa área de ese cliente no está a tu cargo.' });
  }

  // La fecha la digita quien recibe, y es lo que después se le atribuye al
  // cliente como demora. Se valida que no sea futura: nadie recibió mañana.
  // Día del calendario, no instante: es la fecha en que LLEGÓ el insumo y es la
  // que se le atribuye al cliente como demora. Con hora, se corría un día al
  // mostrarla (marcadoEn queda aparte como sello de auditoría).
  const fecha = diaCalendario(req.body?.fecha);
  const finDeHoy = new Date(); finDeHoy.setHours(23, 59, 59, 999);
  if (fecha > finDeHoy) return res.status(422).json({ error: 'La fecha de entrega no puede ser futura.' });

  await prisma.$transaction([
    prisma.entregaInsumo.upsert({
      where: { empresaId_periodo_areaId: { empresaId, periodo, areaId } },
      create: { organizacionId: org.id, empresaId, periodo, areaId, origen: 'cliente', entregadoPorId: u.sub, entregadoEn: fecha },
      update: { origen: 'cliente', entregadoPorId: u.sub, entregadoEn: fecha, marcadoEn: new Date() },
    }),
    prisma.eventoInsumo.create({
      data: { organizacionId: org.id, empresaId, areaId, periodo, tipo: 'marca', fecha, usuarioId: u.sub },
    }),
  ]);
  res.json({ ok: true, periodo, fechaEntrega: fecha });
});

// DELETE /plan/insumo-cliente?empresaId=&areaId=&periodo= — deshace la marca.
// Alguien va a marcar el cliente equivocado; queda el rastro de ambas cosas.
planRouter.delete('/insumo-cliente', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresaId = String(req.query.empresaId ?? '');
  const areaId = String(req.query.areaId ?? '');
  if (!empresaId || !areaId) return res.status(422).json({ error: 'Faltan el cliente y el área.' });
  const periodo = typeof req.query.periodo === 'string' && PERIODO_RE.test(req.query.periodo) ? req.query.periodo : periodoDeHoy();

  const asig = await prisma.asignacionClienteArea.findFirst({
    where: { organizacionId: org.id, empresaId, areaId },
    select: { asesorId: true, auxiliarId: true },
  });
  if (!asig) return res.status(404).json({ error: 'Ese cliente no tiene asignada esa área.' });
  const u = req.user!;
  if (!puedeGestionar(u) && asig.asesorId !== u.sub && asig.auxiliarId !== u.sub) {
    return res.status(403).json({ error: 'Esa área de ese cliente no está a tu cargo.' });
  }

  // Solo se deshace la marca de recepción del cliente: una entrega creada por la
  // liberación del auxiliar no se toca desde aquí.
  const r = await prisma.entregaInsumo.deleteMany({ where: { organizacionId: org.id, empresaId, areaId, periodo, origen: 'cliente' } });
  if (r.count === 0) return res.status(404).json({ error: 'No hay una marca de recepción que deshacer.' });
  await prisma.eventoInsumo.create({ data: { organizacionId: org.id, empresaId, areaId, periodo, tipo: 'desmarca', usuarioId: u.sub } });
  res.json({ ok: true });
});

// ---------- Liberar insumo por área (auxiliar → cada asesor) ----------
//
// La Lista del auxiliar solo muestra captura de Informes/Nómina. Impuestos y
// Tesorería no tienen esa fase, así que no había nada que "terminar" para
// soltarle el insumo a esos asesores. Esta bandeja lista las áreas de los
// clientes donde el usuario es auxiliar, con el asesor de cada una, y deja
// liberar (o deshacer) sin esperar a que el resto de la captura esté lista.

async function auxiliarDeCliente(orgId: string, empresaId: string, uid: string): Promise<boolean> {
  const n = await prisma.asignacionClienteArea.count({
    where: { organizacionId: orgId, empresaId, auxiliarId: uid },
  });
  return n > 0;
}

// GET /plan/liberar-insumo?periodo=YYYY-MM
planRouter.get('/liberar-insumo', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodo: null, total: 0, pendientes: 0, filas: [] });
  const periodo = typeof req.query.periodo === 'string' && PERIODO_RE.test(req.query.periodo) ? req.query.periodo : periodoDeHoy();
  const uid = req.user!.sub;

  const misAsigs = await prisma.asignacionClienteArea.findMany({
    where: { organizacionId: org.id, empresa: { activo: true }, auxiliarId: uid },
    select: { empresaId: true },
  });
  const empresaIds = [...new Set(misAsigs.map((a) => a.empresaId))];
  if (empresaIds.length === 0) return res.json({ periodo, total: 0, pendientes: 0, filas: [] });

  const [asigs, capturas, entregas] = await Promise.all([
    prisma.asignacionClienteArea.findMany({
      where: { organizacionId: org.id, empresaId: { in: empresaIds }, insumoCliente: false },
      select: {
        empresaId: true, areaId: true,
        empresa: { select: { nombre: true } },
        area: { select: { nombre: true, orden: true } },
        asesor: { select: { nombre: true } },
      },
    }),
    prisma.tarea.findMany({
      where: { organizacionId: org.id, empresaId: { in: empresaIds }, periodo, actividadPlan: { fase: 'captura' } },
      select: { empresaId: true, areaId: true, estado: true },
    }),
    prisma.entregaInsumo.findMany({
      where: { organizacionId: org.id, periodo, empresaId: { in: empresaIds } },
      select: { empresaId: true, areaId: true, origen: true, entregadoEn: true, entregadoPor: { select: { nombre: true } } },
    }),
  ]);

  const capsPor = new Map<string, { estado: string }[]>();
  for (const c of capturas) {
    const k = `${c.empresaId}|${c.areaId ?? ''}`;
    const arr = capsPor.get(k) ?? [];
    arr.push({ estado: c.estado });
    capsPor.set(k, arr);
  }
  const entArea = new Map(entregas.filter((e) => e.areaId).map((e) => [`${e.empresaId}|${e.areaId}`, e]));
  const entGen = new Map(entregas.filter((e) => !e.areaId).map((e) => [e.empresaId, e]));

  const filas = asigs.map((a) => {
    const caps = capsPor.get(`${a.empresaId}|${a.areaId}`) ?? [];
    const puede = auxiliarPuedeLiberarArea(caps);
    const e = entArea.get(`${a.empresaId}|${a.areaId}`) ?? entGen.get(a.empresaId);
    const liberado = !!e;
    return {
      empresaId: a.empresaId,
      areaId: a.areaId,
      empresa: a.empresa?.nombre ?? '—',
      area: a.area?.nombre ?? '—',
      areaOrden: a.area?.orden ?? 99,
      asesor: a.asesor?.nombre ?? null,
      liberado,
      origen: e?.origen ?? null,
      fechaEntrega: e?.entregadoEn ?? null,
      marcadoPor: e?.entregadoPor?.nombre ?? null,
      capturaPendiente: !puede.ok,
      puedeLiberar: !liberado && puede.ok,
      motivoBloqueo: liberado ? null : (puede.motivo ?? null),
    };
  }).sort((x, y) => {
    if (x.liberado !== y.liberado) return x.liberado ? 1 : -1;
    const emp = x.empresa.localeCompare(y.empresa, 'es');
    if (emp !== 0) return emp;
    return x.areaOrden - y.areaOrden || x.area.localeCompare(y.area, 'es');
  });

  res.json({
    periodo,
    total: filas.length,
    pendientes: filas.filter((f) => !f.liberado).length,
    filas: filas.map(({ areaOrden: _o, ...f }) => f),
  });
});

// POST /plan/liberar-insumo { empresaId, areaId, periodo }
planRouter.post('/liberar-insumo', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { empresaId, areaId } = req.body ?? {};
  if (typeof empresaId !== 'string' || typeof areaId !== 'string') return res.status(422).json({ error: 'Faltan el cliente y el área.' });
  const periodo = typeof req.body?.periodo === 'string' && PERIODO_RE.test(req.body.periodo) ? req.body.periodo : periodoDeHoy();
  const u = req.user!;

  const asig = await prisma.asignacionClienteArea.findFirst({
    where: { organizacionId: org.id, empresaId, areaId },
    select: { insumoCliente: true },
  });
  if (!asig) return res.status(404).json({ error: 'Ese cliente no tiene asignada esa área.' });
  if (asig.insumoCliente) return res.status(422).json({ error: 'Esa área espera el insumo del cliente: márcalo en “Esperando al cliente”.' });
  if (!puedeGestionar(u) && !(await auxiliarDeCliente(org.id, empresaId, u.sub))) {
    return res.status(403).json({ error: 'Solo el auxiliar de este cliente puede liberarle el insumo a sus asesores.' });
  }

  const capturas = await prisma.tarea.findMany({
    where: { organizacionId: org.id, empresaId, areaId, periodo, actividadPlan: { fase: 'captura' } },
    select: { estado: true },
  });
  const puede = auxiliarPuedeLiberarArea(capturas);
  if (!puede.ok) return res.status(422).json({ error: puede.motivo });

  const existe = await prisma.entregaInsumo.findFirst({ where: { organizacionId: org.id, empresaId, periodo, areaId } });
  if (!existe) {
    const gen = await prisma.entregaInsumo.findFirst({ where: { organizacionId: org.id, empresaId, periodo, areaId: null } });
    if (!gen) {
      await prisma.entregaInsumo.create({
        data: {
          organizacionId: org.id, empresaId, periodo, areaId,
          origen: 'auxiliar', entregadoPorId: u.sub, entregadoEn: diaCalendario(hoyEnColombia()),
        },
      });
    }
  }
  res.json({ ok: true, periodo });
});

// DELETE /plan/liberar-insumo?empresaId=&areaId=&periodo= — deshace lo que el auxiliar soltó.
planRouter.delete('/liberar-insumo', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresaId = String(req.query.empresaId ?? '');
  const areaId = String(req.query.areaId ?? '');
  if (!empresaId || !areaId) return res.status(422).json({ error: 'Faltan el cliente y el área.' });
  const periodo = typeof req.query.periodo === 'string' && PERIODO_RE.test(req.query.periodo) ? req.query.periodo : periodoDeHoy();
  const u = req.user!;

  const asig = await prisma.asignacionClienteArea.findFirst({
    where: { organizacionId: org.id, empresaId, areaId },
    select: { id: true },
  });
  if (!asig) return res.status(404).json({ error: 'Ese cliente no tiene asignada esa área.' });
  if (!puedeGestionar(u) && !(await auxiliarDeCliente(org.id, empresaId, u.sub))) {
    return res.status(403).json({ error: 'Esa área de ese cliente no está a tu cargo.' });
  }

  // No se toca una entrega 'manual' de coordinación ni la recepción del cliente.
  const r = await prisma.entregaInsumo.deleteMany({
    where: { organizacionId: org.id, empresaId, areaId, periodo, origen: { in: ['auxiliar', 'auto'] } },
  });
  if (r.count === 0) return res.status(404).json({ error: 'No hay una liberación del auxiliar que deshacer.' });
  res.json({ ok: true });
});

// GET /plan/mi-dia/procesar — bandeja "listo para procesar" del asesor: sus tareas
// de PROCESAMIENTO cuyo insumo YA fue entregado (auto o manual) y siguen pendientes.
// Es la contraparte del auxiliar: en cuanto la captura se libera, el asesor ve aquí
// qué clientes puede arrancar. F1 — vistas por rol.
planRouter.get('/mi-dia/procesar', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodo: null, total: 0, tareas: [] });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const u = req.user!;
  const uid = u.sub;
  // Esta bandeja es del ASESOR: el procesamiento lo ejecuta él, igual que en la
  // regla de Mi Día. Antes el alcance incluía `auxiliarId`, y como las tareas
  // heredan asesor Y auxiliar de la asignación por cliente×área, al auxiliar le
  // salían todas las tareas de procesamiento de sus clientes — trabajo que no es
  // suyo — justo debajo de su captura del día.
  const scope = puedeGestionar(u) ? {} : { asesorId: uid };

  const tareas = await prisma.tarea.findMany({
    where: {
      organizacionId: org.id, periodo, actividadPlanId: { not: null },
      actividadPlan: { fase: 'procesamiento' },
      estado: { in: ['por_iniciar', 'en_curso'] }, // pendiente de trabajar
      ...scope,
    },
    select: {
      id: true, titulo: true, estado: true, fechaVencimiento: true, empresaId: true, areaId: true,
      empresa: { select: { nombre: true } },
      area: { select: { nombre: true } },
    },
    orderBy: [{ fechaVencimiento: 'asc' }, { titulo: 'asc' }],
    take: 500,
  });

  // Insumo entregado (general o del área) del período → habilita el procesamiento.
  const entregas = await prisma.entregaInsumo.findMany({ where: { organizacionId: org.id, periodo }, select: { empresaId: true, areaId: true, entregadoEn: true } });
  const entMap = new Map<string, Date>();
  for (const e of entregas) entMap.set(`${e.empresaId}|${e.areaId ?? 'gen'}`, e.entregadoEn);

  const filas = tareas.flatMap((t) => {
    const gen = entMap.get(`${t.empresaId}|gen`);
    const area = t.areaId ? entMap.get(`${t.empresaId}|${t.areaId}`) : undefined;
    const fechas = [gen, area].filter(Boolean) as Date[];
    if (fechas.length === 0) return []; // aún bloqueada: el insumo no está listo
    const listoDesde = new Date(Math.min(...fechas.map((d) => d.getTime())));
    return [{
      id: t.id, titulo: t.titulo, estado: t.estado,
      empresa: t.empresa?.nombre ?? '—', area: t.area?.nombre ?? null,
      fechaVencimiento: t.fechaVencimiento, listoDesde,
    }];
  });

  res.json({ periodo, total: filas.length, tareas: filas });
});

// PATCH /tareas/:id/registro — captura del "registro en software" (comprobantes)
// por el ejecutor (asesor/auxiliar) o coordinación. cantidadRegistros la calcula
// el frontend desde el rango, pero es editable, así que aquí solo se valida.
planRouter.patch('/tareas/:id/registro', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({
    where: { id: req.params.id, organizacionId: org?.id },
    select: { id: true, asesorId: true, auxiliarId: true, auditoria: true },
  });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const u = req.user!;
  const puede = puedeGestionar(u) || tarea.asesorId === u.sub || tarea.auxiliarId === u.sub;
  if (!puede) return res.status(403).json({ error: 'No puedes registrar en esta tarea (no eres su asesor/auxiliar ni tienes rol de coordinación).' });
  if (tarea.auditoria === 'aprobada') return res.status(403).json({ error: 'La tarea está bloqueada (aprobada en Auditoría). Debe desbloquearse primero.' });

  const data: Record<string, any> = {};
  for (const f of ['comprobanteDesde', 'comprobanteHasta'] as const) {
    if (f in (req.body ?? {})) data[f] = typeof req.body[f] === 'string' && req.body[f].trim() ? req.body[f].trim() : null;
  }
  if ('cantidadRegistros' in (req.body ?? {})) {
    const v = req.body.cantidadRegistros;
    if (v === null || v === '') data.cantidadRegistros = null;
    else { const n = Number(v); if (!Number.isInteger(n) || n < 0) return res.status(422).json({ error: 'La cantidad de registros debe ser un entero ≥ 0.' }); data.cantidadRegistros = n; }
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  await prisma.tarea.update({ where: { id: tarea.id }, data });
  res.json({ ok: true });
});

// Guardar el link de soporte documental. Permiso: coordinación o el asesor/auxiliar
// de la tarea (para que el ejecutor pegue dónde va quedando el trabajo).
planRouter.patch('/tareas/:id/soporte', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({
    where: { id: req.params.id, organizacionId: org?.id },
    select: { id: true, asesorId: true, auxiliarId: true, auditoria: true },
  });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const u = req.user!;
  const puede = puedeGestionar(u) || tarea.asesorId === u.sub || tarea.auxiliarId === u.sub;
  if (!puede) return res.status(403).json({ error: 'No puedes editar el soporte de esta tarea (no eres su asesor/auxiliar ni tienes rol de coordinación).' });
  if (tarea.auditoria === 'aprobada') return res.status(403).json({ error: 'La tarea está bloqueada (aprobada en Auditoría). Debe desbloquearse primero.' });
  const link = typeof req.body?.soporteLink === 'string' && req.body.soporteLink.trim() ? req.body.soporteLink.trim() : null;
  await prisma.tarea.update({ where: { id: tarea.id }, data: { soporteLink: link } });
  res.json({ ok: true, soporteLink: link });
});

// POST /plan/tareas — crear una tarea a mano.
//
// OJO antes de volver a poner un botón que llame aquí: una tarea creada así
// queda SIN actividad del plan (`actividadPlanId` en null), y todas las listas
// —Lista, Tablero, Mi Día, Calendario— filtran por tareas del plan. O sea que se
// guarda y no aparece en ninguna parte. Por eso se retiró "＋ Nueva tarea" de la
// Lista en agosto de 2026.
//
// El endpoint se conserva para no romper nada y porque las filas ya creadas hay
// que poder rescatarlas, pero el camino correcto para una tarea suelta del día a
// día es /pendientes, que sí tiene dónde verse y se mide por cliente.
planRouter.post('/tareas', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeGestionar(req.user!)) return res.status(403).json({ error: 'Solo coordinación puede crear tareas.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const { data, error } = datosTarea(req.body);
  if (error) return res.status(422).json({ error });
  if (!data.titulo || !data.empresaId) return res.status(422).json({ error: 'Título y cliente son obligatorios.' });
  if (!data.fechaVencimiento) return res.status(422).json({ error: 'La fecha de vencimiento es obligatoria.' });
  if (!data.fechaInicio) data.fechaInicio = data.fechaVencimiento;

  const subtareas: string[] = Array.isArray(req.body?.subtareas)
    ? req.body.subtareas.map((s: any) => String(s ?? '').trim()).filter(Boolean) : [];

  const tarea = await prisma.tarea.create({
    data: {
      organizacionId: org.id, creadoPorId: req.user!.sub, ...data,
      ...(subtareas.length ? { subtareas: { create: subtareas.map((texto, i) => ({ texto, orden: i })) } } : {}),
    } as any,
    select: { id: true },
  });
  res.status(201).json({ ok: true, id: tarea.id });
});

planRouter.patch('/tareas/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeGestionar(req.user!)) return res.status(403).json({ error: 'Solo coordinación puede editar tareas.' });
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  if (tarea.auditoria === 'aprobada') return res.status(403).json({ error: 'La tarea está bloqueada (aprobada en Auditoría). Debe desbloquearse primero.' });
  const { data, error } = datosTarea(req.body);
  if (error) return res.status(422).json({ error });
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  await prisma.tarea.update({ where: { id: tarea.id }, data });
  res.json({ ok: true });
});

planRouter.delete('/tareas/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeGestionar(req.user!)) return res.status(403).json({ error: 'Solo coordinación puede eliminar tareas.' });
  const org = await orgDeSesion(req);
  const r = await prisma.tarea.deleteMany({ where: { id: req.params.id, organizacionId: org?.id } });
  if (r.count === 0) return res.status(404).json({ error: 'Tarea no encontrada.' });
  res.json({ ok: true });
});

// Subtareas de una tarea
planRouter.get('/tareas/:id/subtareas', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id }, select: { id: true } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const subtareas = await prisma.subtarea.findMany({ where: { tareaId: tarea.id }, orderBy: { orden: 'asc' }, select: { id: true, texto: true, estado: true, orden: true } });
  res.json({ subtareas });
});

planRouter.post('/tareas/:id/subtareas', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeGestionar(req.user!)) return res.status(403).json({ error: 'Solo coordinación puede agregar subtareas.' });
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id }, select: { id: true } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const texto = String(req.body?.texto ?? '').trim();
  if (!texto) return res.status(422).json({ error: 'El texto de la subtarea es obligatorio.' });
  const n = await prisma.subtarea.count({ where: { tareaId: tarea.id } });
  const s = await prisma.subtarea.create({ data: { tareaId: tarea.id, texto, orden: n }, select: { id: true, texto: true, estado: true, orden: true } });
  res.status(201).json({ ok: true, subtarea: s });
});

// El ejecutor o coordinación puede cambiar el estado de una subtarea.
planRouter.patch('/tareas/:id/subtareas/:subId', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id }, select: { id: true, asesorId: true, auxiliarId: true } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const u = req.user!;
  const puede = puedeGestionar(u) || tarea.asesorId === u.sub || tarea.auxiliarId === u.sub;
  if (!puede) return res.status(403).json({ error: 'No puedes editar las subtareas de esta tarea.' });
  const data: Record<string, any> = {};
  if (typeof req.body?.texto === 'string' && req.body.texto.trim()) data.texto = req.body.texto.trim();
  if (typeof req.body?.estado === 'string') {
    if (!ESTADOS_SUBTAREA.includes(req.body.estado)) return res.status(400).json({ error: 'Estado de subtarea inválido.' });
    data.estado = req.body.estado;
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  const r = await prisma.subtarea.updateMany({ where: { id: req.params.subId, tareaId: tarea.id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Subtarea no encontrada.' });
  res.json({ ok: true });
});

planRouter.delete('/tareas/:id/subtareas/:subId', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeGestionar(req.user!)) return res.status(403).json({ error: 'Solo coordinación puede eliminar subtareas.' });
  const org = await orgDeSesion(req);
  const tarea = await prisma.tarea.findFirst({ where: { id: req.params.id, organizacionId: org?.id }, select: { id: true } });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const r = await prisma.subtarea.deleteMany({ where: { id: req.params.subId, tareaId: tarea.id } });
  if (r.count === 0) return res.status(404).json({ error: 'Subtarea no encontrada.' });
  res.json({ ok: true });
});

// GET /plan/flujo?periodo=YYYY-MM — tablero de flujo del cierre (F2). Por cliente,
// en qué etapa de la cadena va (Captura → Entrega → Procesamiento → Revisión),
// cuál es su etapa actual (dónde está el foco/cuello), su avance y si está en riesgo.
// Es la vista del coordinador/gerente sobre la misma columna que auxiliar y asesor.
planRouter.get('/flujo', requireAuth, async (req, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ periodo: null, resumen: null, clientes: [] });

  const now = new Date();
  const periodo = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [tareas, entregas, asignaciones] = await Promise.all([
    prisma.tarea.findMany({
      where: { organizacionId: org.id, periodo, actividadPlanId: { not: null } },
      select: {
        estado: true, fechaVencimiento: true,
        empresa: { select: { id: true, nombre: true } },
        actividadPlan: { select: { fase: true } },
      },
    }),
    prisma.entregaInsumo.findMany({ where: { organizacionId: org.id, periodo }, select: { empresaId: true, origen: true, entregadoEn: true } }),
    // QUIÉN responde por cada cliente. El tablero mostraba clientes y etapas, y
    // nunca una persona: con 67 filas iguales, la pregunta que sigue a "65
    // detenidos en captura" es "¿de quién son?", y no estaba en pantalla. La
    // firma se coordina con personas, no con filas.
    prisma.asignacionClienteArea.findMany({
      where: { organizacionId: org.id, OR: [{ asesorId: { not: null } }, { auxiliarId: { not: null } }] },
      select: {
        empresaId: true,
        area: { select: { nombre: true } },
        asesor: { select: { id: true, nombre: true } },
        auxiliar: { select: { id: true, nombre: true } },
      },
    }),
  ]);
  const entregadoSet = new Set(entregas.map((e) => e.empresaId));

  // Asesores y auxiliares por cliente, sin repetir. El auxiliar va aparte porque
  // es quien EJECUTA la captura, que es justo donde se atasca el cierre: decir
  // solo el asesor mandaría a preguntarle a quien no lo está haciendo.
  type Persona = { id: string; nombre: string };
  const unicos = (xs: Persona[]) => Array.from(new Map(xs.map((x) => [x.id, x])).values());
  const asesoresPorEmpresa = new Map<string, Persona[]>();
  const auxiliaresPorEmpresa = new Map<string, Persona[]>();
  for (const a of asignaciones) {
    if (a.asesor) asesoresPorEmpresa.set(a.empresaId, [...(asesoresPorEmpresa.get(a.empresaId) ?? []), a.asesor]);
    if (a.auxiliar) auxiliaresPorEmpresa.set(a.empresaId, [...(auxiliaresPorEmpresa.get(a.empresaId) ?? []), a.auxiliar]);
  }

  // CÓMO se entregó, no solo que se entregó. "Entregado" a secas hace ver que la
  // cadena avanzó sola cuando muchas veces lo que hubo fue un "Liberar período"
  // en bloque para destrabar a los asesores — con la captura sin terminar. Son
  // dos situaciones distintas y se estaban leyendo igual.
  const origenPorEmpresa = new Map<string, { origen: string; fecha: Date | null }>();
  for (const e of entregas) {
    const prev = origenPorEmpresa.get(e.empresaId);
    // Manual manda sobre lo demás: es la que hay que ver, porque es la que no se
    // ganó terminando la captura.
    const origen = !prev ? e.origen : prev.origen === e.origen ? e.origen : (prev.origen === 'manual' || e.origen === 'manual') ? 'manual' : 'mixto';
    const fecha = !prev?.fecha || (e.entregadoEn && e.entregadoEn < prev.fecha) ? e.entregadoEn : prev.fecha;
    origenPorEmpresa.set(e.empresaId, { origen, fecha });
  }

  type Fase = { total: number; hechas: number; curso: number };
  type Cli = { empresaId: string; empresa: string; cap: Fase; proc: Fase; rev: Fase; total: number; hechas: number; vencidas: number };
  const nuevaFase = (): Fase => ({ total: 0, hechas: 0, curso: 0 });
  const map = new Map<string, Cli>();

  for (const t of tareas) {
    const c = map.get(t.empresa.id) ?? { empresaId: t.empresa.id, empresa: t.empresa.nombre, cap: nuevaFase(), proc: nuevaFase(), rev: nuevaFase(), total: 0, hechas: 0, vencidas: 0 };
    const ejec = EJECUTADA.includes(t.estado);
    const curso = t.estado === 'en_curso' || t.estado === 'en_revision';
    const venc = !ejec && estaVencido(t.fechaVencimiento);
    c.total++; if (ejec) c.hechas++; if (venc) c.vencidas++;
    const f = t.actividadPlan?.fase;
    const b = f === 'captura' ? c.cap : f === 'procesamiento' ? c.proc : f === 'revision' ? c.rev : null;
    if (b) { b.total++; if (ejec) b.hechas++; if (curso) b.curso++; }
    map.set(t.empresa.id, c);
  }

  const estadoEtapa = (f: Fase): 'na' | 'listo' | 'en_curso' | 'pendiente' => {
    if (f.total === 0) return 'na';
    if (f.hechas >= f.total) return 'listo';
    if (f.hechas > 0 || f.curso > 0) return 'en_curso';
    return 'pendiente';
  };
  const pct = (e: number, t: number) => (t ? Math.round((e / t) * 100) : 0);

  const ETAPAS = ['captura', 'entrega', 'procesamiento', 'revision', 'cierre'] as const;
  const porEtapa: Record<string, number> = { captura: 0, entrega: 0, procesamiento: 0, revision: 0, cierre: 0 };
  let enRiesgoTotal = 0;

  const clientes = Array.from(map.values()).map((c) => {
    const estCap = estadoEtapa(c.cap);
    const estProc = estadoEtapa(c.proc);
    const estRev = estadoEtapa(c.rev);
    const entregado = entregadoSet.has(c.empresaId);
    const estEntrega = c.proc.total > 0 ? (entregado ? 'entregado' : 'pendiente') : 'na';

    let etapaActual: string;
    if (estCap === 'pendiente' || estCap === 'en_curso') etapaActual = 'captura';
    else if (estEntrega === 'pendiente') etapaActual = 'entrega';
    else if (estProc === 'pendiente' || estProc === 'en_curso') etapaActual = 'procesamiento';
    else if (estRev === 'pendiente' || estRev === 'en_curso') etapaActual = 'revision';
    else etapaActual = 'cierre';
    porEtapa[etapaActual]++;

    const enRiesgo = c.vencidas > 0;
    if (enRiesgo) enRiesgoTotal++;

    return {
      empresaId: c.empresaId, empresa: c.empresa,
      etapas: {
        captura: { estado: estCap, total: c.cap.total, hechas: c.cap.hechas },
        entrega: {
          estado: estEntrega,
          origen: origenPorEmpresa.get(c.empresaId)?.origen ?? null,
          fecha: origenPorEmpresa.get(c.empresaId)?.fecha?.toISOString() ?? null,
        },
        procesamiento: { estado: estProc, total: c.proc.total, hechas: c.proc.hechas },
        revision: { estado: estRev, total: c.rev.total, hechas: c.rev.hechas },
      },
      etapaActual, avance: pct(c.hechas, c.total),
      enRiesgo, vencidas: c.vencidas,
      asesores: unicos(asesoresPorEmpresa.get(c.empresaId) ?? []),
      auxiliares: unicos(auxiliaresPorEmpresa.get(c.empresaId) ?? []),
    };
  });

  // Cuello: la etapa (sin contar "cierre") donde hay más clientes detenidos hoy.
  let cuello: string | null = null;
  let maxEtapa = 0;
  for (const e of ETAPAS) {
    if (e === 'cierre') continue;
    if (porEtapa[e] > maxEtapa) { maxEtapa = porEtapa[e]; cuello = e; }
  }

  // Orden: en riesgo primero, luego los menos avanzados (necesitan atención).
  clientes.sort((a, b) => Number(b.enRiesgo) - Number(a.enRiesgo) || a.avance - b.avance || a.empresa.localeCompare(b.empresa));

  res.json({
    periodo,
    resumen: { clientes: clientes.length, porEtapa, cuello, enRiesgo: enRiesgoTotal, cerrados: porEtapa.cierre },
    clientes,
  });
});

const TAREA_LABEL: Record<string, string> = {
  por_iniciar: 'Por iniciar', en_curso: 'En curso', en_revision: 'En revisión',
  terminado: 'Terminado', auditado: 'Auditado', no_realizado: 'No realizado', no_aplica: 'No aplica',
};

// GET /plan/portal?anio= — Plan de Trabajo del cliente (solo lectura, aislado por
// NIT/grupo): matriz de cumplimiento (áreas × 12 meses) + listado de actividades.
planRouter.get('/portal', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  const anio = Number(req.query.anio) || new Date().getFullYear();
  if (!org) return res.json({ anio, kpis: null, matriz: [], actividades: [] });
  const alcance = await alcancePortal(req.user, org.id);
  if (alcance === null) return res.status(403).json({ error: 'Sin acceso al plan de trabajo.' });
  const scope = alcance === 'todas' ? {} : { empresaId: { in: alcance } };

  const tareas = await prisma.tarea.findMany({
    where: { organizacionId: org.id, actividadPlanId: { not: null }, periodo: { startsWith: `${anio}-` }, ...scope },
    orderBy: [{ periodo: 'asc' }, { fechaVencimiento: 'asc' }],
    select: { titulo: true, estado: true, fechaVencimiento: true, periodo: true, area: { select: { nombre: true } } },
  });

  const hoy = new Date();
  const areas = new Map<string, { total: number; ejec: number }[]>();
  let total = 0, ejecutadas = 0;
  for (const t of tareas) {
    const mes = Number((t.periodo ?? '').slice(5, 7));
    if (!(mes >= 1 && mes <= 12)) continue;
    // Lo que no aplica no baja el porcentaje que ve el cliente en su portal.
    if (!cuenta(t.estado)) continue;
    const esEjec = EJECUTADA.includes(t.estado);
    total++; if (esEjec) ejecutadas++;
    const an = t.area?.nombre ?? 'Sin área';
    if (!areas.has(an)) areas.set(an, Array.from({ length: 12 }, () => ({ total: 0, ejec: 0 })));
    const cell = areas.get(an)![mes - 1]; cell.total++; if (esEjec) cell.ejec++;
  }
  const matriz = [...areas.entries()]
    .map(([area, meses]) => ({ area, meses: meses.map((c) => (c.total ? Math.round((c.ejec / c.total) * 100) : null)), total: meses.reduce((a, c) => a + c.total, 0) }))
    .sort((a, b) => a.area.localeCompare(b.area, 'es'));

  const actividades = tareas.map((t) => {
    const esEjec = EJECUTADA.includes(t.estado);
    // Lo que no aplica nunca se muestra vencido: no había nada que entregar.
    const vencido = cuenta(t.estado) && !esEjec && estaVencido(t.fechaVencimiento);
    return { titulo: t.titulo, area: t.area?.nombre ?? null, periodo: t.periodo, fechaVencimiento: t.fechaVencimiento, estado: t.estado, estadoLabel: TAREA_LABEL[t.estado] ?? t.estado, vencido };
  });

  res.json({ anio, kpis: { total, ejecutadas, cumplimiento: total ? Math.round((ejecutadas / total) * 100) : 0 }, matriz, actividades });
});

planRouter.get('/cumplimiento', requireAuth, async (req, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.json({ organizacion: null, periodo: null, kpis: null, porArea: [], porCliente: [] });

  const now = new Date();
  const periodoParam = typeof req.query.periodo === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodo)
    ? req.query.periodo
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const tareas = await prisma.tarea.findMany({
    where: { organizacionId: org.id, periodo: periodoParam, actividadPlanId: { not: null } },
    select: {
      estado: true, auditoria: true, fechaVencimiento: true,
      area: { select: { nombre: true } },
      empresa: { select: { id: true, nombre: true } },
      asesor: { select: { id: true, nombre: true } },
      auxiliar: { select: { id: true, nombre: true } },
    },
  });

  const hoy = new Date();
  let total = 0, ejecutadas = 0, vencidas = 0, porAuditar = 0;
  const areaMap = new Map<string, { total: number; ejecutadas: number }>();
  const cliMap = new Map<string, { empresa: string; total: number; ejecutadas: number; vencidas: number }>();
  type Persona = { nombre: string; total: number; ejecutadas: number; vencidas: number };
  const asesorMap = new Map<string, Persona>();
  const auxiliarMap = new Map<string, Persona>();

  const acumPersona = (map: Map<string, Persona>, id: string, nombre: string, esEjec: boolean, esVenc: boolean) => {
    const p = map.get(id) ?? { nombre, total: 0, ejecutadas: 0, vencidas: 0 };
    p.total++; if (esEjec) p.ejecutadas++; if (esVenc) p.vencidas++; map.set(id, p);
  };

  for (const t of tareas) {
    if (!cuenta(t.estado)) continue; // no entra ni al numerador ni al denominador
    const esEjec = EJECUTADA.includes(t.estado);
    const esVenc = !esEjec && estaVencido(t.fechaVencimiento);
    total++;
    if (esEjec) ejecutadas++;
    if (esVenc) vencidas++;
    if (t.estado === 'terminado' && t.auditoria !== 'aprobada') porAuditar++;

    const areaNombre = t.area?.nombre ?? 'Sin área';
    const a = areaMap.get(areaNombre) ?? { total: 0, ejecutadas: 0 };
    a.total++; if (esEjec) a.ejecutadas++; areaMap.set(areaNombre, a);

    const c = cliMap.get(t.empresa.id) ?? { empresa: t.empresa.nombre, total: 0, ejecutadas: 0, vencidas: 0 };
    c.total++; if (esEjec) c.ejecutadas++; if (esVenc) c.vencidas++; cliMap.set(t.empresa.id, c);

    if (t.asesor) acumPersona(asesorMap, t.asesor.id, t.asesor.nombre, esEjec, esVenc);
    if (t.auxiliar) acumPersona(auxiliarMap, t.auxiliar.id, t.auxiliar.nombre, esEjec, esVenc);
  }

  // --- Vencimientos del período (declaraciones controladas en Vencimientos) ---
  // Las declaraciones vinculadas (ActividadPlan.obligacionVencimiento) cuentan en
  // el avance como las tareas: se atribuyen al área de su actividad y al
  // responsable del vencimiento; "presentado" = ejecutado. Así el área (p. ej.
  // Impuestos) refleja su avance real aunque la declaración no sea tarea del plan.
  const [anioP, mesP] = periodoParam.split('-').map(Number);
  const desdeV = new Date(Date.UTC(anioP, mesP - 1, 1));
  const hastaV = new Date(Date.UTC(anioP, mesP, 1)); // exclusivo (primer día del mes siguiente)
  const actsVinc = await prisma.actividadPlan.findMany({
    where: { organizacionId: org.id, obligacionVencimiento: { not: null } },
    select: { obligacionVencimiento: true, area: { select: { nombre: true } } },
  });
  const areaPorKey = new Map(actsVinc.map((a) => [a.obligacionVencimiento!, a.area?.nombre ?? 'Sin área']));
  const vencs = await prisma.vencimientoEmpresa.findMany({
    where: { organizacionId: org.id, fechaVencimiento: { gte: desdeV, lt: hastaV } },
    select: {
      estado: true, fechaVencimiento: true, obligacion: true,
      empresa: { select: { id: true, nombre: true } },
      asesor: { select: { id: true, nombre: true } },
      auxiliar: { select: { id: true, nombre: true } },
    },
  });
  for (const v of vencs) {
    const key = vinculoDeObligacion(v.obligacion);
    if (!key || !areaPorKey.has(key)) continue; // solo declaraciones vinculadas a una actividad
    const areaNombre = areaPorKey.get(key)!;
    const esEjec = EJECUTADA_VENC.includes(v.estado);
    const esVenc = !esEjec && (v.estado === 'no_presentado' || v.fechaVencimiento < hoy);
    total++;
    if (esEjec) ejecutadas++;
    if (esVenc) vencidas++;
    const a = areaMap.get(areaNombre) ?? { total: 0, ejecutadas: 0 };
    a.total++; if (esEjec) a.ejecutadas++; areaMap.set(areaNombre, a);
    const c = cliMap.get(v.empresa.id) ?? { empresa: v.empresa.nombre, total: 0, ejecutadas: 0, vencidas: 0 };
    c.total++; if (esEjec) c.ejecutadas++; if (esVenc) c.vencidas++; cliMap.set(v.empresa.id, c);
    if (v.asesor) acumPersona(asesorMap, v.asesor.id, v.asesor.nombre, esEjec, esVenc);
    if (v.auxiliar) acumPersona(auxiliarMap, v.auxiliar.id, v.auxiliar.nombre, esEjec, esVenc);
  }

  const pct = (e: number, t: number) => (t ? Math.round((e / t) * 100) : 0);

  const porArea = Array.from(areaMap.entries())
    .map(([area, v]) => ({ area, total: v.total, ejecutadas: v.ejecutadas, cumplimiento: pct(v.ejecutadas, v.total) }))
    .sort((x, y) => y.total - x.total);

  const porCliente = Array.from(cliMap.values())
    .map((v) => ({ empresa: v.empresa, total: v.total, ejecutadas: v.ejecutadas, vencidas: v.vencidas, cumplimiento: pct(v.ejecutadas, v.total) }))
    .sort((x, y) => x.cumplimiento - y.cumplimiento); // en riesgo primero

  const mapPersona = (m: Map<string, Persona>) =>
    Array.from(m.values())
      .map((v) => ({ nombre: v.nombre, total: v.total, ejecutadas: v.ejecutadas, vencidas: v.vencidas, cumplimiento: pct(v.ejecutadas, v.total) }))
      .sort((x, y) => x.cumplimiento - y.cumplimiento || y.total - x.total);

  // El nombre de la firma se consulta aparte: el token solo trae su identificador.
  const datosOrg = await prisma.organizacion.findUnique({ where: { id: org.id }, select: { nombre: true, slug: true } });

  res.json({
    organizacion: datosOrg ? { nombre: datosOrg.nombre } : null,
    periodo: periodoParam,
    kpis: { total, ejecutadas, vencidas, porAuditar, cumplimiento: pct(ejecutadas, total) },
    porArea,
    porCliente,
    porAsesor: mapPersona(asesorMap),
    porAuxiliar: mapPersona(auxiliarMap),
  });
});
