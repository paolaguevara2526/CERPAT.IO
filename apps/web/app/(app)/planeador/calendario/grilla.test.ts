// El calendario perdió tres días sin que nadie tocara el calendario.
//
// La grilla del mes se armaba con `repeat(N,1fr)`. "1fr" es "minmax(auto,1fr)",
// y ese `auto` deja que el contenido empuje la columna más allá del ancho
// disponible: al crecer los nombres de los clientes, las siete columnas
// pasaron a sumar más que el panel. Como el panel recorta lo que se sale
// (overflow:hidden), viernes, sábado y domingo quedaron fuera de la vista y sin
// forma de llegar a ellos — el mes se veía de lunes a jueves.
//
// No fue un despliegue: fue el dato creciendo. Por eso no basta con arreglarlo,
// tiene que quedar una prueba: el mismo error puede volver escribiendo "1fr" en
// cualquier grilla nueva, y no se nota hasta que a un cliente le falta un día.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(join(AQUI, 'CalendarioUnificado.tsx'), 'utf8');

test('la grilla del mes usa minmax(0,1fr): el contenido no ensancha las columnas', () => {
  const grillas = [...fuente.matchAll(/gridTemplateColumns:\s*`repeat\(\$\{[^}]+\},([^`]+)\)`/g)];
  assert.ok(grillas.length > 0, 'no se encontró la grilla del mes: ¿cambió la forma de declararla?');
  for (const [, medida] of grillas) {
    assert.equal(
      medida.trim(), 'minmax(0,1fr)',
      `La grilla del mes usa "${medida.trim()}". Con "1fr" el contenido puede ensanchar las columnas ` +
      'y el panel recorta los últimos días del mes.',
    );
  }
});

test('el panel del calendario sigue recortando, así que ninguna columna puede sobrar', () => {
  // Si algún día se quita el overflow:hidden del panel, este recorte deja de
  // esconder días (aparecería una barra de desplazamiento). Mientras esté, la
  // grilla TIENE que caber: esta prueba deja escrita esa dependencia.
  assert.match(
    fuente, /className="panel" style=\{\{ padding: 0, overflow: 'hidden'/,
    'El panel del mes ya no recorta: revisa si la grilla todavía necesita minmax(0,…).',
  );
});
