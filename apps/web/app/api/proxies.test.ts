// Los proxies catch-all tienen que reenviar TODOS los métodos.
//
// El error que esto cierra: el proxy de /api/ficha exportaba GET, POST, PATCH y
// DELETE, pero no PUT. Guardar las cifras fiscales de un cliente hace PUT, así
// que Next.js respondía 405 sin cuerpo, el frontend no encontraba un mensaje que
// mostrar y decía "No se pudo guardar." — sin más. La función **nunca** había
// funcionado, y nada lo delató: compila, arranca, pasa los tipos.
//
// Un proxy catch-all es un reenviador genérico: no hay razón para que le falte
// un verbo. Si algún día se necesita restringir uno, se restringe en la API,
// que es donde están los permisos, no escondiéndolo detrás de un 405 mudo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** Rutas `[...path]/route.ts` bajo app/api, a cualquier profundidad. */
function proxies(dir: string, encontrados: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (!statSync(ruta).isDirectory()) continue;
    if (nombre.startsWith('[...')) {
      const archivo = join(ruta, 'route.ts');
      try { statSync(archivo); encontrados.push(archivo); } catch { /* sin route.ts */ }
    }
    proxies(ruta, encontrados);
  }
  return encontrados;
}

const encontrados = proxies(AQUI);

test('hay proxies catch-all que revisar', () => {
  assert.ok(encontrados.length > 0, 'no se encontró ningún [...path]/route.ts: ¿cambió la estructura?');
});

for (const archivo of encontrados) {
  const nombre = archivo.slice(AQUI.length + 1);
  test(`${nombre}: reenvía todos los métodos`, () => {
    const src = readFileSync(archivo, 'utf8');
    const faltan = METODOS.filter((m) => !new RegExp(`export async function ${m}\\b`).test(src));
    assert.deepEqual(
      faltan, [],
      `Faltan ${faltan.join(', ')} en ${nombre}. Una llamada con ese método recibe 405 sin cuerpo, ` +
      'y en pantalla se ve un error genérico que no dice nada.',
    );
  });
}
