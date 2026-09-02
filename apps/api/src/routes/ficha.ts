// apps/api/src/routes/ficha.ts — Hoja de vida del cliente.
//
// Reúne en un solo lugar lo que hoy vive repartido en carpetas y correos:
// identificación, datos de notificación ante la DIAN y la cámara de comercio,
// actividades económicas (CIIU), representantes legales y registros de cámara.
//
// Quién puede verla y editarla: Administración, Coordinación y Asesores. Los
// auxiliares no. El cliente ve la suya desde el portal (solo lectura), y ese
// aislamiento lo hace el propio endpoint comparando contra su empresa/grupo.
//
// ⚠ Sin credenciales. Ver el comentario del modelo RegistroCamara: guardar
// usuario y contraseña de los clientes convierte una filtración de la base en
// una filtración de SUS cuentas. Se guarda quién tiene el acceso y dónde está
// la clave, nunca la clave.

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { orgDeSesion } from '../auth/tenant.js';
import { obligacionesPorCifras, naturalezaDe } from '../fiscal/reglas.js';
import { aplicaRub, RUB_OBLIGACION, ANIO_CALENDARIO } from '../vencimientos/generador.js';
import { CIIU_REV4_AC, SECCIONES_CIIU } from '../fiscal/ciiu-rev4-ac.js';
// Emparejar filas de Excel con clientes y leer montos vive aparte, con pruebas:
// casar una fila con el cliente equivocado le escribe cifras ajenas y de ahí
// salen mal sus obligaciones, sin que nada falle.
import { indexar, emparejar, montoDe, anioValido } from '../fiscal/importar-cifras.js';
import { horasPactadas, mesesContrato } from '../fiscal/contrato.js';

export const fichaRouter = Router();

const ROLES_FICHA = ['Administrador', 'Coordinador', 'Asesor'];

function puedeVerFicha(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || u.roles.some((r) => ROLES_FICHA.includes(r)));
}
// Editar la ficha es de Administración y Coordinación: un asesor la consulta.
function puedeEditarFicha(u: AuthedRequest['user']): boolean {
  return !!u && (u.esRoot || u.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)));
}

// Un cliente externo solo puede pedir SU empresa (o una de su grupo).
async function empresaPermitidaParaCliente(u: AuthedRequest['user'], empresaId: string): Promise<boolean> {
  if (!u) return false;
  if (u.empresaCliente) return u.empresaCliente === empresaId;
  if (u.grupoCliente) {
    const e = await prisma.empresa.findFirst({ where: { id: empresaId, grupoId: u.grupoCliente }, select: { id: true } });
    return !!e;
  }
  return false;
}

const texto = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};
const fecha = (v: unknown): Date | null => {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

// ---------- Cifras en bloque (plantilla e importación) ----------
//
// Registrar activos e ingresos cliente por cliente son 90 fichas a mano, y las
// cifras salen de un Excel que el equipo ya tiene. Estas dos rutas van ANTES de
// /:empresaId por la misma razón que /catalogos.

// GET /ficha/cifras?anio=YYYY — clientes activos con sus cifras de ese año.
// Alimenta la plantilla de Excel (que ya sale con los clientes y sus NIT) y la
// tabla de revisión.
fichaRouter.get('/cifras', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeVerFicha(req.user)) return res.status(403).json({ error: 'Sin acceso a las fichas de clientes.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const anio = anioValido(req.query.anio) ?? new Date().getFullYear() - 1;

  const empresas = await prisma.empresa.findMany({
    where: { organizacionId: org.id, activo: true },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, nit: true, cifrasFiscales: { where: { anio } } },
  });

  res.json({
    anio,
    editable: puedeEditarFicha(req.user),
    filas: empresas.map((e) => {
      const c = e.cifrasFiscales[0];
      return {
        empresaId: e.id, empresa: e.nombre, nit: e.nit,
        activosBrutos: c?.activosBrutos != null ? Number(c.activosBrutos) : null,
        ingresosBrutos: c?.ingresosBrutos != null ? Number(c.ingresosBrutos) : null,
        fuente: c?.fuente ?? null,
      };
    }),
  });
});

// POST /ficha/cifras/importar { dryRun, anio, filas:[{nit, cliente, activos, ingresos, fuente}] }
//
// Con dryRun no toca nada: devuelve qué se aplicaría y qué está mal. Importar
// cifras equivocadas cambia en silencio qué obligaciones le salen a un cliente,
// así que se ve antes de escribir.
fichaRouter.post('/cifras/importar', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditarFicha(req.user)) return res.status(403).json({ error: 'Solo Administración o Coordinación puede importar cifras.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });

  const anio = anioValido(req.body?.anio);
  if (!anio) return res.status(422).json({ error: 'Año inválido.' });
  const filas = Array.isArray(req.body?.filas) ? req.body.filas : null;
  if (!filas) return res.status(422).json({ error: 'No llegaron filas.' });
  if (filas.length > 5000) return res.status(413).json({ error: 'Demasiadas filas (máximo 5000).' });
  const dryRun = req.body?.dryRun !== false;

  const empresas = await prisma.empresa.findMany({
    where: { organizacionId: org.id }, select: { id: true, nombre: true, nit: true },
  });
  const idx = indexar(empresas);

  const problemas: string[] = [];
  const preview: string[] = [];
  const aplicar: { empresaId: string; nombre: string; activos: number | null; ingresos: number | null; fuente: string | null }[] = [];
  const yaVisto = new Map<string, number>();
  const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

  filas.forEach((f: Record<string, unknown>, i: number) => {
    const linea = i + 2; // +2: fila 1 son los encabezados del Excel
    const activos = montoDe(f.activosBrutos);
    const ingresos = montoDe(f.ingresosBrutos);
    if (activos === 'invalido' || ingresos === 'invalido') {
      problemas.push(`Fila ${linea}: hay un valor que no es un número (${activos === 'invalido' ? 'activos' : 'ingresos'}).`);
      return;
    }
    if (activos == null && ingresos == null) return; // fila en blanco: se ignora sin ruido

    const m = emparejar(idx, f.nit, f.cliente);
    if ('error' in m) { problemas.push(`Fila ${linea}: ${m.error}.`); return; }

    const antes = yaVisto.get(m.empresa.id);
    if (antes != null) {
      problemas.push(`Fila ${linea}: ${m.empresa.nombre} ya venía en la fila ${antes}; se ignora esta.`);
      return;
    }
    yaVisto.set(m.empresa.id, linea);

    aplicar.push({
      empresaId: m.empresa.id, nombre: m.empresa.nombre, activos, ingresos,
      fuente: typeof f.fuente === 'string' && f.fuente.trim() ? f.fuente.trim() : null,
    });
    if (preview.length < 40) {
      preview.push(`${m.empresa.nombre} — activos ${activos != null ? cop(activos) : '—'} · ingresos ${ingresos != null ? cop(ingresos) : '—'}`);
    }
  });

  if (dryRun) return res.json({ anio, aplicar: aplicar.length, problemas, preview, totalFilas: filas.length });

  for (const a of aplicar) {
    const datos = { activosBrutos: a.activos, ingresosBrutos: a.ingresos, fuente: a.fuente };
    await prisma.cifrasFiscales.upsert({
      where: { empresaId_anio: { empresaId: a.empresaId, anio } },
      create: { organizacionId: org.id, empresaId: a.empresaId, anio, ...datos },
      update: datos,
    });
  }
  res.json({ anio, aplicadas: aplicar.length, problemas });
});

// GET /ficha/catalogos — opciones para los desplegables de la ficha.
//
// Va ANTES de GET /:empresaId: si se declarara después, Express haría coincidir
// "catalogos" con :empresaId y respondería "Cliente no encontrado".
fichaRouter.get('/catalogos', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  if (!puedeVerFicha(req.user)) return res.status(403).json({ error: 'Sin acceso a las fichas de clientes.' });
  const [tipos, regimenes] = await Promise.all([
    prisma.tipoEmpresa.findMany({ where: { organizacionId: org.id }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], select: { id: true, nombre: true } }),
    prisma.regimenTributario.findMany({ where: { organizacionId: org.id }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], select: { id: true, nombre: true } }),
  ]);
  res.json({ tipos, regimenes });
});

// GET /ficha/ciiu — nomenclatura CIIU Rev. 4 A.C. completa (499 clases).
//
// Va embebida en el código y no en la base: es la clasificación nacional del
// DANE, idéntica para todas las firmas y que no edita nadie. Se manda entera
// —son unos 60 KB— para que el buscador de la ficha filtre al instante sin ir
// y volver al servidor con cada tecla.
//
// También antes de /:empresaId, por el mismo motivo que /catalogos.
fichaRouter.get('/ciiu', requireAuth, (_req, res) => {
  res.set('Cache-Control', 'private, max-age=86400');
  res.json({ secciones: SECCIONES_CIIU, clases: CIIU_REV4_AC });
});

// GET /ficha/:empresaId — hoja de vida completa.
fichaRouter.get('/:empresaId', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = req.user;
  const esCliente = !!u?.empresaCliente || !!u?.grupoCliente;

  if (esCliente) {
    if (!(await empresaPermitidaParaCliente(u, req.params.empresaId))) {
      return res.status(403).json({ error: 'Sin acceso a esta ficha.' });
    }
  } else if (!puedeVerFicha(u)) {
    return res.status(403).json({ error: 'Sin acceso a las fichas de clientes.' });
  }

  const e = await prisma.empresa.findFirst({
    where: { id: req.params.empresaId, organizacionId: org.id },
    select: {
      id: true, nombre: true, nit: true, activo: true, servicio: true,
      direccion: true, emailDian: true, telefonoDian: true, emailCamara: true, telefonoCamara: true,
      fechaConstitucion: true,
      contratoDesde: true, mesesContrato: true, contratoHasta: true,
      horasPactadasMes: true, alcanceServicio: true,
      tipoId: true, regimenId: true,
      tipo: { select: { nombre: true } },
      regimen: { select: { nombre: true } },
      municipio: { select: { nombre: true, departamento: true } },
      actividadesEconomicas: { orderBy: [{ principal: 'desc' }, { orden: 'asc' }] },
      representantes: { orderBy: [{ principal: 'desc' }, { nombre: 'asc' }] },
      registrosCamara: {
        orderBy: { camara: 'asc' },
        include: { responsable: { select: { id: true, nombre: true } } },
      },
    },
  });
  if (!e) return res.status(404).json({ error: 'Cliente no encontrado.' });

  res.json({
    // El Decimal de Prisma no viaja como número en JSON: sin esto llega como
    // texto y cualquier suma del lado del cliente lo concatena.
    ficha: { ...e, horasPactadasMes: e.horasPactadasMes != null ? Number(e.horasPactadasMes) : null },
    editable: !esCliente && puedeEditarFicha(u),
  });
});

// PATCH /ficha/:empresaId — datos de identificación y notificación.
fichaRouter.patch('/:empresaId', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditarFicha(req.user)) return res.status(403).json({ error: 'Solo Administración o Coordinación puede editar la ficha.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });

  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  for (const campo of ['direccion', 'emailDian', 'telefonoDian', 'emailCamara', 'telefonoCamara', 'alcanceServicio'] as const) {
    if (campo in b) data[campo] = texto(b[campo]);
  }
  if ('fechaConstitucion' in b) data.fechaConstitucion = fecha(b.fechaConstitucion);
  if ('contratoDesde' in b) data.contratoDesde = fecha(b.contratoDesde);
  if ('contratoHasta' in b) data.contratoHasta = fecha(b.contratoHasta);
  // Los meses no se validan contra la fecha de terminación a propósito: una
  // prórroga puede terminar en una fecha que no cuadre con el plazo, y ahí manda
  // el papel. La pantalla avisa de la discrepancia; el backend no la impone.
  if ('mesesContrato' in b) data.mesesContrato = mesesContrato(b.mesesContrato);
  // Las horas pactadas se miden contra las ejecutadas, así que un valor
  // imposible aquí desviaría el indicador en silencio (ver fiscal/contrato.ts).
  if ('horasPactadasMes' in b) data.horasPactadasMes = horasPactadas(b.horasPactadasMes);
  // El tipo de empresa decide la naturaleza jurídica, y de ella salen el RUB, el
  // revisor fiscal y el 368-2. Se edita aquí, junto al resto de la identificación
  // del cliente, y no solo en Administración: quien ve el hueco es quien está
  // revisando la ficha. Cadena vacía = "sin asignar", no "no tocar".
  for (const c of ['tipoId', 'regimenId'] as const) if (c in b) data[c] = b[c] || null;

  const r = await prisma.empresa.updateMany({ where: { id: req.params.empresaId, organizacionId: org.id }, data });
  if (r.count === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
  res.json({ ok: true });
});

// ---------- Listas de la ficha (CIIU, representantes, cámaras) ----------
// Las tres se comportan igual, así que comparten el mismo esqueleto.

type Lista = 'actividades' | 'representantes' | 'camaras';

const CAMPOS: Record<Lista, readonly string[]> = {
  actividades: ['codigo', 'descripcion', 'principal', 'orden'],
  representantes: ['nombre', 'documento', 'cargo', 'principal', 'desde', 'hasta', 'email', 'telefono'],
  camaras: ['camara', 'matricula', 'responsableId', 'ubicacionClave', 'notas'],
};
const FECHAS = new Set(['desde', 'hasta']);
const BOOLEANOS = new Set(['principal']);
const NUMEROS = new Set(['orden']);

function datosDe(lista: Lista, body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const campo of CAMPOS[lista]) {
    if (!(campo in body)) continue;
    if (FECHAS.has(campo)) data[campo] = fecha(body[campo]);
    else if (BOOLEANOS.has(campo)) data[campo] = body[campo] === true || body[campo] === 'true';
    else if (NUMEROS.has(campo)) data[campo] = Number(body[campo]) || 0;
    else data[campo] = texto(body[campo]);
  }
  return data;
}

const modelo = (lista: Lista) =>
  lista === 'actividades' ? prisma.actividadEconomica
  : lista === 'representantes' ? prisma.representanteLegal
  : prisma.registroCamara;

// Campos obligatorios: sin ellos la fila no dice nada.
const OBLIGATORIO: Record<Lista, string> = { actividades: 'codigo', representantes: 'nombre', camaras: 'camara' };

for (const lista of ['actividades', 'representantes', 'camaras'] as Lista[]) {
  fichaRouter.post(`/:empresaId/${lista}`, requireAuth, async (req: AuthedRequest, res) => {
    if (!puedeEditarFicha(req.user)) return res.status(403).json({ error: 'Sin permiso para editar la ficha.' });
    const org = await orgDeSesion(req);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
    const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: org.id }, select: { id: true } });
    if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

    const data = datosDe(lista, req.body ?? {});
    if (!data[OBLIGATORIO[lista]]) return res.status(422).json({ error: `El campo "${OBLIGATORIO[lista]}" es obligatorio.` });

    const creado = await (modelo(lista) as any).create({
      data: { ...data, organizacionId: org.id, empresaId: empresa.id },
      select: { id: true },
    });
    res.status(201).json({ ok: true, id: creado.id });
  });

  fichaRouter.patch(`/${lista}/:id`, requireAuth, async (req: AuthedRequest, res) => {
    if (!puedeEditarFicha(req.user)) return res.status(403).json({ error: 'Sin permiso para editar la ficha.' });
    const org = await orgDeSesion(req);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
    const r = await (modelo(lista) as any).updateMany({
      where: { id: req.params.id, organizacionId: org.id },
      data: datosDe(lista, req.body ?? {}),
    });
    if (r.count === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    res.json({ ok: true });
  });

  fichaRouter.delete(`/${lista}/:id`, requireAuth, async (req: AuthedRequest, res) => {
    if (!puedeEditarFicha(req.user)) return res.status(403).json({ error: 'Sin permiso para editar la ficha.' });
    const org = await orgDeSesion(req);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
    const r = await (modelo(lista) as any).deleteMany({ where: { id: req.params.id, organizacionId: org.id } });
    if (r.count === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    res.json({ ok: true });
  });
}

// ---------- Cifras y obligaciones derivadas ----------
//
// Las normas comparan contra el "año inmediatamente anterior": para saber qué le
// aplica a un cliente en 2026 se miran sus cifras de 2025, medidas con la UVT y
// el SMMLV de ESE año. Por eso todo va por año y nunca con un valor "actual".

const anioAnterior = (anio: number) => anio - 1;

// GET /ficha/:empresaId/obligaciones?anio=YYYY
// Qué le aplica al cliente según sus cifras, y en qué se aparta de cómo está
// configurado hoy. No cambia nada: señala, no corrige.
fichaRouter.get('/:empresaId/obligaciones', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = req.user;
  const esCliente = !!u?.empresaCliente || !!u?.grupoCliente;
  if (esCliente) {
    if (!(await empresaPermitidaParaCliente(u, req.params.empresaId))) return res.status(403).json({ error: 'Sin acceso.' });
  } else if (!puedeVerFicha(u)) {
    return res.status(403).json({ error: 'Sin acceso a las fichas de clientes.' });
  }

  const anioEval = Number(req.query.anio) || new Date().getFullYear();
  const anioCifras = anioAnterior(anioEval);

  const empresa = await prisma.empresa.findFirst({
    where: { id: req.params.empresaId, organizacionId: org.id },
    select: {
      id: true,
      tipo: { select: { nombre: true } },
      configuracionTributaria: { select: { ivaPeriodicidad: true, retencionFuente: true, rentaTipo: true, anticipoRstPeriodicidad: true } },
      cifrasFiscales: { where: { anio: anioCifras } },
    },
  });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const params = await prisma.parametroAnual.findFirst({ where: { organizacionId: org.id, anio: anioCifras } });
  const c = empresa.cifrasFiscales[0];

  const obligaciones = obligacionesPorCifras(
    c ? { anio: anioCifras, activosBrutos: c.activosBrutos ? Number(c.activosBrutos) : null, ingresosBrutos: c.ingresosBrutos ? Number(c.ingresosBrutos) : null } : null,
    params ? { anio: params.anio, uvt: Number(params.uvt), smmlv: Number(params.smmlv) } : null,
    naturalezaDe(empresa.tipo?.nombre),
  );

  // Contraste con lo configurado. Solo se compara lo que existe como campo; el
  // resto queda como información. Nunca se cambia la configuración sola: si la
  // norma y la parametrización difieren, lo decide una persona.
  const cfg = empresa.configuracionTributaria;
  const configuradoDe = (campo: string): string | null => {
    if (!cfg) return null;
    if (campo === 'ivaPeriodicidad') return cfg.ivaPeriodicidad ?? 'sin definir';
    if (campo === 'retencionFuente') return cfg.retencionFuente ? 'sí' : 'no';
    if (campo === 'rst') return cfg.rentaTipo === 'rst_consolidada' || cfg.anticipoRstPeriodicidad ? 'puede' : 'no puede';
    return null;
  };

  const conContraste = obligaciones.map((o) => {
    if (!o.contrastaCon || o.sugerido == null || o.aplica == null) return { ...o, configurado: null, discrepa: false };
    const configurado = configuradoDe(o.contrastaCon);
    return { ...o, configurado, discrepa: configurado != null && configurado !== o.sugerido };
  });

  res.json({
    anioEvaluado: anioEval,
    anioCifras,
    cifras: c ? { anio: c.anio, activosBrutos: c.activosBrutos, ingresosBrutos: c.ingresosBrutos, fuente: c.fuente, notas: c.notas } : null,
    parametros: params ? { anio: params.anio, uvt: params.uvt, smmlv: params.smmlv } : null,
    obligaciones: conContraste,
    editable: !esCliente && puedeEditarFicha(u),
  });
});

// ---------- Situación tributaria del cliente ----------
//
// Qué responsabilidades tiene configuradas y qué vencimientos le salieron de
// ellas, para ESTE cliente. Antes había que salir a Administración a mirarlo:
// una pestaña para la configuración y otra para el diagnóstico del RUB. Revisar
// un cliente obligaba a abrir tres pantallas y recordar de memoria lo visto en
// las otras dos, que es justo como se cuela un error.
//
// Es de solo lectura a propósito: la edición sigue viviendo en Config.
// tributaria, que es un editor pesado (config nacional + ICA municipio por
// municipio). Aquí se ve el estado y se llega a él por un enlace.

// GET /ficha/:empresaId/tributaria?anio=YYYY
fichaRouter.get('/:empresaId/tributaria', requireAuth, async (req: AuthedRequest, res) => {
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const u = req.user;
  const esCliente = !!u?.empresaCliente || !!u?.grupoCliente;
  if (esCliente) {
    if (!(await empresaPermitidaParaCliente(u, req.params.empresaId))) return res.status(403).json({ error: 'Sin acceso.' });
  } else if (!puedeVerFicha(u)) {
    return res.status(403).json({ error: 'Sin acceso a las fichas de clientes.' });
  }

  const anio = Number(req.query.anio) || ANIO_CALENDARIO;

  const empresa = await prisma.empresa.findFirst({
    where: { id: req.params.empresaId, organizacionId: org.id },
    select: {
      id: true,
      tipo: { select: { nombre: true } },
      configuracionTributaria: {
        select: {
          ivaPeriodicidad: true, consumoPeriodicidad: true, rentaTipo: true,
          anticipoRstPeriodicidad: true, retencionFuente: true, fopat: true,
          nominaElectronica: true, seguridadSocial: true,
        },
      },
      municipiosIca: {
        select: {
          id: true, icaPeriodicidad: true, reteica: true, reteicaPeriodicidad: true,
          autoica: true, autoicaPeriodicidad: true,
          municipio: { select: { nombre: true, departamento: true } },
        },
      },
    },
  });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  // Qué vencimientos tiene realmente cargados este año, por obligación. Es el
  // contraste que faltaba: la configuración dice qué DEBERÍA tener, esto dice
  // qué tiene. Cuando no cuadran, se ve aquí y no tres pantallas más allá.
  const porObligacion = await prisma.vencimientoEmpresa.groupBy({
    by: ['obligacion'],
    where: { organizacionId: org.id, empresaId: empresa.id, anio },
    _count: { _all: true },
  });
  const vencimientos = porObligacion
    .map((v) => ({ obligacion: v.obligacion, n: v._count._all }))
    .sort((a, b) => a.obligacion.localeCompare(b.obligacion, 'es'));

  const tipo = empresa.tipo?.nombre ?? null;
  const rubAplica = aplicaRub(tipo);
  const rubCargados = vencimientos.find((v) => v.obligacion === RUB_OBLIGACION)?.n ?? 0;

  res.json({
    anio,
    tipo,
    config: empresa.configuracionTributaria,
    ica: empresa.municipiosIca.map((m) => ({
      id: m.id,
      municipio: m.municipio?.nombre ?? null,
      departamento: m.municipio?.departamento ?? null,
      icaPeriodicidad: m.icaPeriodicidad,
      reteica: m.reteica, reteicaPeriodicidad: m.reteicaPeriodicidad,
      autoica: m.autoica, autoicaPeriodicidad: m.autoicaPeriodicidad,
    })),
    rub: {
      aplica: rubAplica,
      cargados: rubCargados,
      estado: !tipo ? 'sin_tipo' : (!rubAplica ? 'tipo_no_obligado' : (rubCargados === 0 ? 'falta_regenerar' : 'ok')),
    },
    vencimientos,
    // Regenerar y editar la config son de Administración; el resto solo mira.
    puedeAdministrar: !esCliente && !!u && (u.esRoot || u.roles.includes('Administrador')),
  });
});

// PUT /ficha/:empresaId/cifras — cifras de un año (crea o actualiza).
fichaRouter.put('/:empresaId/cifras', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditarFicha(req.user)) return res.status(403).json({ error: 'Solo Administración o Coordinación puede registrar cifras.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  const empresa = await prisma.empresa.findFirst({ where: { id: req.params.empresaId, organizacionId: org.id }, select: { id: true } });
  if (!empresa) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const anio = Number(req.body?.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return res.status(422).json({ error: 'Año inválido.' });
  const num = (v: unknown): number | null => {
    const s = String(v ?? '').replace(/[^\d.-]/g, '');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const datos = {
    activosBrutos: num(req.body?.activosBrutos),
    ingresosBrutos: num(req.body?.ingresosBrutos),
    fuente: texto(req.body?.fuente),
    notas: texto(req.body?.notas),
  };

  await prisma.cifrasFiscales.upsert({
    where: { empresaId_anio: { empresaId: empresa.id, anio } },
    create: { organizacionId: org.id, empresaId: empresa.id, anio, ...datos },
    update: datos,
  });
  res.json({ ok: true });
});
