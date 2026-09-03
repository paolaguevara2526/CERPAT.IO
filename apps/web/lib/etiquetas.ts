// apps/web/lib/etiquetas.ts
// Un desplegable no puede ofrecer dos opciones que se lean igual.
//
// Nada impide que el mismo cliente exista dos veces en la base. Cuando pasa, el
// selector de "Plan por cliente" muestra el nombre repetido y no hay forma de
// saber cuál se abrió: se corrige el asesor en una ficha, se guarda, y al asesor
// viejo le sigue apareciendo el cliente — porque vive en la otra. El error no se
// siente como un dato duplicado, se siente como que el sistema no guarda.
//
// La salida no es esconder el duplicado (eso deja trabajo colgando de una ficha
// invisible) sino hacerlo distinguible y visible: se marca, se elige a
// conciencia, y quien lo ve entiende que hay algo que unificar.

export type Nombrado = { id: string; nombre: string; nit?: string | null };

const clave = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Etiquetas únicas para una lista: devuelve `id → texto a mostrar`.
 *
 * A los nombres que no se repiten no les pasa nada — cargar todas las opciones
 * con un identificador las vuelve ilegibles para resolver un caso entre noventa.
 * Solo los repetidos reciben una marca que los separa: el NIT si lo hay, y si no
 * el final del id, que siempre existe.
 */
export function etiquetasUnicas(items: Nombrado[]): Map<string, string> {
  const veces = new Map<string, number>();
  for (const x of items) veces.set(clave(x.nombre), (veces.get(clave(x.nombre)) ?? 0) + 1);

  const salida = new Map<string, string>();
  for (const x of items) {
    if ((veces.get(clave(x.nombre)) ?? 0) < 2) { salida.set(x.id, x.nombre); continue; }
    const distintivo = x.nit?.trim() ? `NIT ${x.nit.trim()}` : `id …${x.id.slice(-6)}`;
    salida.set(x.id, `${x.nombre} ⚠ repetido · ${distintivo}`);
  }
  return salida;
}

/** ¿Hay algún nombre repetido en la lista? Para avisar sin recorrerla dos veces. */
export function hayNombresRepetidos(items: Nombrado[]): boolean {
  const vistos = new Set<string>();
  for (const x of items) {
    const k = clave(x.nombre);
    if (vistos.has(k)) return true;
    vistos.add(k);
  }
  return false;
}
