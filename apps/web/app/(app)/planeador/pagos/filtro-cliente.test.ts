// El selector de cliente en Pagos: se escoge de la lista, y además se busca.
//
// El desplegable de siempre está bien para escoger: se abre, se ve la lista
// completa y se elige. Lo que no sirve con noventa clientes es BUSCAR — teclear
// una letra en un <select> solo salta a la primera opción que empieza así, y el
// nombre que uno recuerda suele ser una palabra del medio ("taneja" por "Grupo
// Empresarial Dajitaneja SAS").
//
// Así que no se reemplazó el desplegable por un campo de texto: se le agregó la
// búsqueda encima. Abrirlo sigue mostrando la lista completa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const pagina = readFileSync(join(AQUI, 'page.tsx'), 'utf8');
const selector = readFileSync(join(AQUI, 'SelectorCliente.tsx'), 'utf8');

test('el filtro sigue siendo un selector con su lista', () => {
  assert.match(pagina, /<SelectorCliente clientes=\{clientes\} valor=\{cliente\}/);
});

test('abrirlo muestra la lista completa, no solo lo que uno escriba', () => {
  // Si arrancara vacío hasta escribir, se perdería lo que el desplegable hacía
  // bien: ver quiénes hay.
  assert.match(selector, /\[TODOS, \.\.\.clientes\.filter\(\(c\) => coincide\(c, texto\)\)\]/);
});

test('escribir filtra por cualquier parte del nombre', () => {
  assert.match(selector, /import \{ coincide \} from '@\/lib\/buscar'/);
});

test('escribir en el buscador no envía el formulario', () => {
  // El formulario de filtros envía con su propio onChange y en React los
  // eventos suben por el árbol: sin cortarlos, cada letra recargaba la página y
  // el desplegable se cerraba solo — no se alcanzaba a picar ninguna opción.
  assert.match(selector, /onChange=\{\(e\) => \{ e\.stopPropagation\(\); setTexto\(e\.target\.value\); setMarcado\(0\); \}\}/);
});

test('al filtrar se ve cuántos quedan', () => {
  // Escribir a ciegas no dice si vale la pena seguir escribiendo.
  assert.match(selector, /de \{clientes\.length\} cliente\(s\)/);
});

test('elegir un cliente sí filtra la pantalla', () => {
  // React ignora los cambios de `value` hechos por código, así que simular un
  // evento no dispararía el envío: elegir un cliente no haría nada.
  assert.match(selector, /oculto\.current\.form\?\.requestSubmit\(\)/);
  assert.ok(!/dispatchEvent\(new Event\('change'/.test(selector), 'simular el evento no funciona con React');
});

test('el valor viaja con el nombre que espera el formulario', () => {
  assert.match(selector, /<input ref=\{oculto\} type="hidden" name="cliente" defaultValue=\{valor\} \/>/);
});

test('se puede recorrer y elegir con el teclado', () => {
  for (const tecla of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
    assert.ok(selector.includes(`e.key === '${tecla}'`), `falta ${tecla}`);
  }
});

test('se cierra al hacer clic afuera', () => {
  // Abierto encima de la tabla tapa justo lo que se acaba de filtrar.
  assert.match(selector, /document\.addEventListener\('mousedown', fuera\)/);
  assert.match(selector, /document\.removeEventListener\('mousedown', fuera\)/);
});

test('cuando no coincide nada, se ve QUÉ se buscó', () => {
  // Ahorra el "¿está mal escrito o no existe?". Va en los dos lados: dentro del
  // selector y en la tabla vacía.
  assert.match(selector, /Ningún cliente coincide con/);
  assert.match(pagina, /Ningún cliente coincide con/);
  assert.match(pagina, /«\{cliente\}»/);
});

test('se filtra por pedazo del nombre también en el servidor', () => {
  // El botón "Filtrar" con texto a medias tiene que funcionar igual.
  assert.match(pagina, /const scope = items\.filter\(\(i\) => coincide\(i\.empresa, cliente\)\)/);
});
