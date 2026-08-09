// Resolución del TENANT (organización) de cada petición.
//
// Regla de seguridad #0 (ADR-0001): toda consulta se filtra por `organizacionId`
// y ese identificador sale de LA SESIÓN, nunca de algo que mande el cliente.
//
// Hasta ahora los endpoints lo resolvían con el texto fijo `slug: 'cerpat'`.
// Funcionaba con una sola firma, pero era el bloqueo para vender la plataforma
// (ADR-0002): un segundo tenant habría visto los datos de CERPAT. El token ya
// traía la organización del usuario; aquí simplemente se usa.

import { prisma } from '../db.js';
import type { AuthedRequest } from './middleware.js';

/**
 * Organización de quien hizo la petición, tomada del token.
 *
 * Devuelve la forma `{ id }` a propósito: es la misma que traían las consultas
 * que reemplaza, así que los `org.id` de cada endpoint siguen funcionando igual.
 *
 * Caso root de plataforma: en el modelo, un root vive POR FUERA de las firmas
 * (`organizacionId = null`). Mientras exista una sola organización, se le deja
 * operar sobre ella; en cuanto haya varias tendrá que elegir cuál — y ahí este
 * es el único punto que hay que tocar.
 */
export async function orgDeSesion(req: AuthedRequest): Promise<{ id: string } | null> {
  const id = req.user?.org;
  if (id) return { id };
  if (!req.user?.esRoot) return null;

  const organizaciones = await prisma.organizacion.findMany({ select: { id: true }, take: 2 });
  return organizaciones.length === 1 ? organizaciones[0] : null;
}
