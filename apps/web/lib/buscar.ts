// apps/web/lib/buscar.ts
// Buscar escribiendo, como se busca de verdad.
//
// Un desplegable con noventa clientes obliga a saber por dónde empieza el
// nombre: se teclea una letra y salta a la primera opción que arranca con ella.
// Pero nadie recuerda si el cliente está guardado como "Grupo Empresarial
// Dajitaneja SAS" o como "Dajitaneja"; lo que uno recuerda es una palabra suelta
// del medio.
//
// Reglas:
//   - Se busca por PEDAZO, no por el comienzo: "taneja" encuentra "Dajitaneja".
//   - Tildes y mayúsculas no cuentan: "piña" y "PINA" son lo mismo.
//   - Varias palabras se piden TODAS, en cualquier orden: "acme sas" encuentra
//     "Acme Consultores SAS", y también lo encuentra "sas acme". Exigir el orden
//     obligaría a recordar el nombre completo, que es justo lo que no pasa.

/** Sin tildes, sin mayúsculas y con los espacios colapsados. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿`texto` contiene todas las palabras de `consulta`?
 *
 * Una consulta vacía coincide con todo: es "sin filtro", no "nada coincide" —
 * lo contrario dejaría la pantalla en blanco al borrar el campo.
 */
export function coincide(texto: string | null | undefined, consulta: string): boolean {
  const palabras = normalizar(consulta).split(' ').filter(Boolean);
  if (palabras.length === 0) return true;
  const base = normalizar(String(texto ?? ''));
  if (!base) return false;
  return palabras.every((p) => base.includes(p));
}
