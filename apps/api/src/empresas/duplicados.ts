// apps/api/src/empresas/duplicados.ts
// Cuándo dos fichas de cliente son EL MISMO cliente.
//
// El esquema no tiene índice único ni por nombre ni por NIT: nada impide que el
// mismo cliente exista dos veces. El importador de asignaciones ya lo sabía —
// avisa "Cliente duplicado (nombre ambiguo)" — pero solo al importar.
//
// Un cliente duplicado no se ve como un error: se ve como un misterio. La
// asignación se reparte entre las dos fichas, y entonces la coordinación abre
// "Plan por cliente", elige el nombre en el desplegable (que muestra las dos
// fichas idénticas, sin manera de distinguirlas), cambia el asesor, guarda —
// y al asesor viejo le sigue apareciendo el cliente, porque vive en la OTRA
// ficha. Se corrige, se vuelve a corregir, y nunca cambia nada.
//
// Se compara por dos llaves independientes:
//   - NIT: es el identificador de verdad. Dos fichas con el mismo NIT son el
//     mismo contribuyente, se llamen como se llamen.
//   - Nombre normalizado: sin tildes ni mayúsculas, porque "Ana Delia Piña" y
//     "ANA DELIA PINA" se teclearon dos veces y son la misma persona.

import { claveNombre } from '../catalogos/nombre.js';

export type FichaCliente = { id: string; nombre: string; nit?: string | null };

/**
 * Clave de agrupación por NIT: solo los dígitos, sin el dígito de verificación.
 * "900.123.456-7", "9001234567" y "900123456" son el mismo NIT escrito por tres
 * personas distintas, y el sistema tiene que verlos iguales.
 *
 * El NIT colombiano son nueve dígitos más el de verificación, así que con diez
 * se descarta el último. Es una regla del formato, no una adivinanza.
 *
 * Devuelve '' cuando no hay NIT utilizable: sin NIT no se puede afirmar nada,
 * y agrupar por vacío juntaría clientes que no tienen ninguna relación.
 */
export function claveNit(nit: string | null | undefined): string {
  const digitos = String(nit ?? '').replace(/\D/g, '');
  if (digitos.length < 5) return ''; // ni un NIT ni una cédula caben en menos
  return digitos.length === 10 ? digitos.slice(0, 9) : digitos;
}

/**
 * ¿Los dos identificadores son el mismo? Tolera el dígito de verificación
 * escrito o no, pero NO recorta a ciegas.
 *
 * Es más estricto que `claveNit` a propósito: agrupar de más solo produce una
 * fila de más en un diagnóstico que alguien lee, mientras que bloquear de más
 * impide crear un cliente real. Una cédula de diez dígitos se parece a un NIT
 * con verificación, y ahí la diferencia importa.
 */
export function mismoNit(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = String(a ?? '').replace(/\D/g, '');
  const db = String(b ?? '').replace(/\D/g, '');
  if (da.length < 5 || db.length < 5) return false;
  if (da === db) return true;
  const [corto, largo] = da.length < db.length ? [da, db] : [db, da];
  // Solo 9 vs 10: es la forma exacta de "el mismo NIT, uno con verificación".
  return corto.length === 9 && largo.length === 10 && largo.startsWith(corto);
}

export type GrupoDuplicado = {
  /** Por qué se agruparon: es lo que hay que explicarle a quien lo lee. */
  motivo: 'nit' | 'nombre';
  /** El valor que comparten, ya normalizado (para mostrarlo tal cual no sirve). */
  clave: string;
  /** Las fichas del grupo, en el orden en que llegaron. */
  ids: string[];
};

/**
 * Agrupa las fichas que parecen ser el mismo cliente.
 *
 * Un grupo por NIT manda sobre uno por nombre: si dos fichas comparten NIT ya
 * quedaron reportadas, y volver a reportarlas por nombre solo duplica la
 * alarma. Los grupos de un solo elemento no son duplicados y no se devuelven.
 */
export function gruposDuplicados(fichas: FichaCliente[]): GrupoDuplicado[] {
  const porNit = new Map<string, string[]>();
  for (const f of fichas) {
    const k = claveNit(f.nit);
    if (!k) continue;
    porNit.set(k, [...(porNit.get(k) ?? []), f.id]);
  }

  const grupos: GrupoDuplicado[] = [];
  const yaReportada = new Set<string>();
  for (const [clave, ids] of porNit) {
    if (ids.length < 2) continue;
    grupos.push({ motivo: 'nit', clave, ids });
    for (const id of ids) yaReportada.add(id);
  }

  const porNombre = new Map<string, string[]>();
  for (const f of fichas) {
    const k = claveNombre(f.nombre);
    if (!k) continue;
    porNombre.set(k, [...(porNombre.get(k) ?? []), f.id]);
  }
  for (const [clave, ids] of porNombre) {
    if (ids.length < 2) continue;
    // Si TODAS ya salieron por NIT, el grupo por nombre no agrega información.
    if (ids.every((id) => yaReportada.has(id))) continue;
    grupos.push({ motivo: 'nombre', clave, ids });
  }

  return grupos;
}

/**
 * La ficha con la que choca `nit` entre las existentes, o null.
 *
 * Sirve para no dejar crear la segunda: el NIT es inequívoco, así que ahí sí se
 * puede bloquear sin miedo a estorbar un caso legítimo. Con el nombre no se
 * bloquea — dos clientes pueden llamarse parecido de verdad — y por eso queda
 * el detector.
 */
export function choqueDeNit<T extends FichaCliente>(
  nit: string | null | undefined,
  existentes: T[],
  excluirId?: string,
): T | null {
  return existentes.find((x) => x.id !== excluirId && mismoNit(nit, x.nit)) ?? null;
}
