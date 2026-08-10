// Convertir un error del servidor en algo que se pueda leer en pantalla.
//
// Hasta ahora, cuando un endpoint fallaba, el proxy del frontend recibía un
// cuerpo que no era JSON, lo convertía en `{}` y la pantalla mostraba un
// genérico: "No se pudo guardar el plan". El motivo real —tiempo agotado, disco
// lleno, dato inválido— se quedaba en los registros del servidor, y sin acceso a
// ellos no hay forma de arreglar nada.
//
// No se filtra el detalle interno al usuario: se traduce a la causa y a qué
// hacer. Lo crudo va a la consola del servidor.

type PrismaLike = { code?: unknown; message?: unknown };

const MENSAJES: Record<string, string> = {
  // Transacción interactiva que no alcanzó a terminar.
  P2028: 'La operación tardó demasiado y se canceló. No se guardó nada. Vuelve a intentarlo; si se repite, avisa: hay que revisar la base.',
  P2002: 'Ya existe un registro con esos datos.',
  P2003: 'No se puede guardar porque depende de un registro que no existe.',
  P2025: 'El registro que se intentaba modificar ya no existe.',
  // Sin conexión / la base no responde.
  P1001: 'La base de datos no responde. Reintenta en un momento.',
  P1008: 'La base de datos tardó demasiado en responder.',
  P1017: 'Se perdió la conexión con la base de datos. Reintenta.',
};

/** Mensaje para el usuario a partir de un error desconocido. */
export function mensajeDeError(e: unknown, porDefecto = 'No se pudo completar la operación.'): string {
  const err = e as PrismaLike;
  const code = typeof err?.code === 'string' ? err.code : null;
  if (code && MENSAJES[code]) return MENSAJES[code];

  const texto = typeof err?.message === 'string' ? err.message : '';
  // El disco lleno es el que más despista: la lectura sigue funcionando y solo
  // fallan los guardados, así que parece un error de la pantalla.
  if (/no space left on device|disk full|SQLSTATE\[53100\]|53100/i.test(texto)) {
    return 'La base de datos se quedó sin espacio en disco. Hay que ampliar el volumen antes de poder guardar.';
  }
  if (/timeout|timed out/i.test(texto)) {
    return 'La operación tardó demasiado y se canceló. No se guardó nada.';
  }
  if (code) return `${porDefecto} (código ${code})`;
  return porDefecto;
}

/** Registra el error crudo y responde con un mensaje legible. */
export function responderError(
  res: { status: (n: number) => { json: (b: unknown) => unknown } },
  contexto: string,
  e: unknown,
  porDefecto?: string,
): void {
  console.error(`[${contexto}]`, e);
  res.status(500).json({ error: mensajeDeError(e, porDefecto) });
}
