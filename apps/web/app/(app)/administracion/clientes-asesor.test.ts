// El asesor del cliente se ELIGE de la lista, no se escribe.
//
// La casilla era de texto libre y escribía `asesorNombre`, un campo que vino de
// la importación y que no reparte nada: el trabajo lo reparte la asignación
// cliente×área. Entonces se podía "ponerle asesor" a un cliente y que su trabajo
// no le apareciera a nadie — la misma raíz de los vencimientos huérfanos, vista
// desde el formulario de alta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(join(AQUI, 'EmpresasEditor.tsx'), 'utf8');

test('la casilla de asesor es una lista, no un campo de texto', () => {
  assert.doesNotMatch(fuente, /value=\{form\.asesorNombre[^}]*\}\s*onChange/,
    'volvió a ser texto libre: se puede escribir cualquier nombre y no asigna nada');
  assert.match(fuente, /value=\{form\.asesorId\} onChange/);
});

test('la lista sale de los usuarios de la firma', () => {
  assert.match(fuente, /fetch\('\/api\/admin\/usuarios'/);
  assert.match(fuente, /const ROLES_ASESOR = \['Asesor', 'Coordinador', 'Administrador'\];/);
});

test('el asesor elegido viaja al servidor', () => {
  // Va dentro del formulario completo; lo que se cuida es que el campo exista
  // en el estado que se envía.
  assert.match(fuente, /asesorId: ''/);
  assert.match(fuente, /JSON\.stringify\(form\)/);
});

test('la tabla muestra el asesor real, no el texto viejo', () => {
  // `asesorNombre` sigue existiendo como respaldo, pero un cliente sin
  // asignación se muestra como "sin asignar" aunque tenga ese texto: darlo por
  // asignado es exactamente lo que escondió el problema durante meses.
  assert.match(fuente, /asesoresDe\(e\)\.length/);
  assert.match(fuente, /sin asignar/);
  assert.doesNotMatch(fuente, /<td style=\{\{ color: 'var\(--muted\)' \}\}>\{e\.asesorNombre \?\? '—'\}<\/td>/);
});

test('la pantalla dice qué hace elegir un asesor', () => {
  // La casilla no reparte el cliente entero ni pisa lo ya asignado, y eso no se
  // adivina mirándola.
  assert.match(fuente, /no<\/strong> tienen ninguno/);
  assert.match(fuente, /Plan por cliente/);
});
