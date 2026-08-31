// Los filtros del calendario tienen que estar completos: cada uno vive en
// CUATRO sitios (su estado, el filtro de eventos, `hayFiltro` y el botón
// "Limpiar") y agregar uno olvidando cualquiera de los tres últimos deja un
// filtro que no se puede quitar o un "Limpiar" que no aparece. Es un error que
// no se ve al programar —el filtro nuevo funciona— y que solo se descubre
// cuando alguien se queda con la pantalla filtrada sin entender por qué.
//
// Se revisa sobre la fuente, como grilla.test.ts: la alternativa sería montar
// el componente entero, y lo que se quiere fijar aquí es el cableado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(join(AQUI, 'CalendarioUnificado.tsx'), 'utf8');

// Estados de filtro declarados en el componente: `const [x, setX] = useState<string[]>([])`.
const filtrosLista = [...fuente.matchAll(/const \[(\w+), (set\w+)\] = useState<string\[\]>\(\[\]\)/g)]
  .map(([, estado, setter]) => ({ estado, setter }));

const hayFiltro = /const hayFiltro = ([^;]+);/.exec(fuente)?.[1] ?? '';
const limpiar = /\{hayFiltro && <button onClick=\{\(\) => \{([^}]+)\}\}/.exec(fuente)?.[1] ?? '';
const visibles = /const visibles = useMemo\(([\s\S]*?)\n  \);/.exec(fuente)?.[1] ?? '';

test('se encontraron los tres puntos de cableado en la fuente', () => {
  // Si esto falla, cambió la forma de escribirlos y las pruebas de abajo
  // estarían pasando sin mirar nada.
  assert.ok(filtrosLista.length >= 3, `solo se encontraron ${filtrosLista.length} filtros de lista`);
  assert.ok(hayFiltro, 'no se encontró `const hayFiltro = …`');
  assert.ok(limpiar, 'no se encontró el botón Limpiar');
  assert.ok(visibles, 'no se encontró `const visibles = useMemo(…)`');
});

test('cada filtro filtra, cuenta para hayFiltro y se limpia', () => {
  for (const { estado, setter } of filtrosLista) {
    assert.ok(visibles.includes(estado), `El filtro "${estado}" no se aplica en \`visibles\`: no filtra nada.`);
    assert.ok(hayFiltro.includes(estado), `El filtro "${estado}" no cuenta para \`hayFiltro\`: el botón "Limpiar" no aparece al usarlo.`);
    assert.ok(limpiar.includes(`${setter}([])`), `"Limpiar" no restablece "${estado}": queda un filtro puesto que no se puede quitar.`);
  }
});

test('el estado de cumplimiento también se limpia', () => {
  // No es una lista, va aparte: mismo riesgo, misma prueba.
  assert.ok(hayFiltro.includes('cumpl'), 'el estado de cumplimiento no cuenta para hayFiltro');
  assert.ok(limpiar.includes("setCumpl('')"), '"Limpiar" no restablece el estado de cumplimiento');
});

test('existe el filtro "Asignado" y lee el responsable del evento', () => {
  // Pedido por la dirección para hacer seguimiento por asesor. El responsable de
  // un vencimiento es su ASESOR; el de una visita, su responsable.
  assert.match(fuente, /label="Asignado"/, 'desapareció el filtro "Asignado" del calendario');
  assert.match(fuente, /asignado: v\.asesor \?\? null/, 'el vencimiento ya no toma su asignado del asesor');
  assert.match(fuente, /asignado: v\.responsable \?\? null/, 'la visita ya no toma su asignado del responsable');
});

test('"Sin asignar" solo se ofrece si hay algo sin responsable', () => {
  // Es la razón de que esté en la lista: sirve para ENCONTRAR lo que falta por
  // asignar. Ofrecerlo siempre daría un filtro que no devuelve nada.
  assert.match(fuente, /huerfanos \? \[\.\.\.list, SIN_ASIGNAR\] : list/);
});
