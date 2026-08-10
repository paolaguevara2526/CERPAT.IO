// Express resuelve las rutas EN EL ORDEN EN QUE SE DECLARAN.
//
// Si `/entregas/:empresaId` va antes que `/entregas/liberar-periodo`, la segunda
// no se alcanza nunca: la primera captura "liberar-periodo" como si fuera el id
// de un cliente y responde "Cliente no encontrado". Compila, arranca, pasa las
// pruebas de tipos — y falla en producción con un mensaje que apunta al lado
// equivocado.
//
// Ya pasó dos veces en la misma noche (en /ficha se evitó a mano; en /entregas
// no). Un comentario no basta: esto lo tiene que atrapar una prueba.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));

type Ruta = { metodo: string; segmentos: string[]; linea: number; cruda: string };

/** Rutas declaradas en un archivo de router, en orden de aparición. */
function rutasDe(src: string): Ruta[] {
  const out: Ruta[] = [];
  const re = /^\s*\w+Router\.(get|post|put|patch|delete)\(\s*'([^']+)'/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({
      metodo: m[1],
      segmentos: m[2].split('/').filter(Boolean),
      linea: src.slice(0, m.index).split('\n').length,
      cruda: m[2],
    });
  }
  return out;
}

/**
 * Una ruta queda tapada si otra anterior, del mismo método y misma longitud,
 * la absorbe: en cada posición o coinciden los literales, o la anterior tiene
 * un parámetro donde esta tiene un literal.
 */
function tapadaPor(previa: Ruta, actual: Ruta): boolean {
  if (previa.metodo !== actual.metodo) return false;
  if (previa.segmentos.length !== actual.segmentos.length) return false;
  let hayParametroComodin = false;
  for (let i = 0; i < previa.segmentos.length; i++) {
    const a = previa.segmentos[i];
    const b = actual.segmentos[i];
    if (a.startsWith(':')) {
      if (!b.startsWith(':')) hayParametroComodin = true;
      continue;
    }
    if (a !== b) return false;
  }
  return hayParametroComodin;
}

test('ninguna ruta con segmento fijo queda tapada por otra con parámetro', () => {
  const archivos = readdirSync(AQUI).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const problemas: string[] = [];

  for (const archivo of archivos) {
    const rutas = rutasDe(readFileSync(join(AQUI, archivo), 'utf8'));
    for (let i = 0; i < rutas.length; i++) {
      for (let j = 0; j < i; j++) {
        if (tapadaPor(rutas[j], rutas[i])) {
          problemas.push(
            `${archivo}:${rutas[i].linea} — ${rutas[i].metodo.toUpperCase()} '${rutas[i].cruda}' nunca se alcanza: `
            + `la tapa '${rutas[j].cruda}' declarada en la línea ${rutas[j].linea}. Muévela antes.`,
          );
        }
      }
    }
  }

  assert.deepEqual(problemas, [], `\n${problemas.join('\n')}\n`);
});
