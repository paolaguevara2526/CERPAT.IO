// apps/api/src/bootstrap-root.ts
//
// Promoción puntual a ROOT de plataforma. El rol root no se edita desde la
// interfaz a propósito (es el permiso más alto y, con el modelo multi-tenant,
// vive por encima de las firmas). Para otorgarlo sin acceso directo a la base:
//
//   1. En Railway → servicio de la API → Variables, agregar:
//        PROMOVER_ROOT_EMAIL = correo@cerpat.io
//   2. Redesplegar. Al arrancar, la API promueve esa cuenta y lo deja en el log.
//   3. QUITAR la variable (ya no hace falta; dejarla no repite nada, pero es
//      mejor no dejar puertas abiertas).
//
// Es idempotente y best-effort: si algo falla, la API arranca igual.

import { prisma } from './db.js';

export async function promoverRootSiSePide(): Promise<void> {
  const email = process.env.PROMOVER_ROOT_EMAIL?.trim().toLowerCase();
  if (!email) return;

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { email },
      select: { id: true, nombre: true, email: true, activo: true, esRootPlataforma: true },
    });

    if (!usuario) {
      console.warn(`[root] No existe ningún usuario con el correo "${email}". Créalo primero en Usuarios.`);
      return;
    }
    if (usuario.esRootPlataforma) {
      console.log(`[root] "${usuario.email}" ya era root de plataforma. Sin cambios.`);
      return;
    }

    await prisma.usuario.update({ where: { id: usuario.id }, data: { esRootPlataforma: true, activo: true } });
    console.log(`[root] ✅ "${usuario.email}" (${usuario.nombre}) ahora es ROOT de plataforma. Ya puedes quitar PROMOVER_ROOT_EMAIL.`);
  } catch (e) {
    console.error('[root] No se pudo promover:', e instanceof Error ? e.message : e);
  }
}
