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

  res.json({ ficha: e, editable: !esCliente && puedeEditarFicha(u) });
});

// PATCH /ficha/:empresaId — datos de identificación y notificación.
fichaRouter.patch('/:empresaId', requireAuth, async (req: AuthedRequest, res) => {
  if (!puedeEditarFicha(req.user)) return res.status(403).json({ error: 'Solo Administración o Coordinación puede editar la ficha.' });
  const org = await orgDeSesion(req);
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });

  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  for (const campo of ['direccion', 'emailDian', 'telefonoDian', 'emailCamara', 'telefonoCamara'] as const) {
    if (campo in b) data[campo] = texto(b[campo]);
  }
  if ('fechaConstitucion' in b) data.fechaConstitucion = fecha(b.fechaConstitucion);

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
