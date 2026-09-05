// El filtro de cliente en Pagos se escribe, no se escoge.
//
// Con noventa clientes, un <select> obliga a saber por dónde EMPIEZA el nombre:
// se teclea una letra y salta a la primera opción que arranca con ella. Pero uno
// no recuerda si el cliente quedó guardado como "Grupo Empresarial Dajitaneja
// SAS" o como "Dajitaneja" — lo que recuerda es una palabra del medio.
//
// La lista completa no se pierde: sigue ahí como autocompletado, así que quien
// prefiera escoger, escoge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const pagina = readFileSync(join(AQUI, 'page.tsx'), 'utf8');

test('el filtro de cliente es un campo de texto', () => {
  assert.match(pagina, /<input name="cliente" defaultValue=\{cliente\} list="clientes-pagos"/);
  assert.ok(!/<select name="cliente"/.test(pagina), 'el desplegable de cliente ya no debería existir');
});

test('la lista de clientes sigue disponible como sugerencia', () => {
  // Quitarla convertiría el cambio en una pérdida: quien prefiere escoger de una
  // lista se quedaría sin saber cómo está escrito cada nombre.
  assert.match(pagina, /<datalist id="clientes-pagos">/);
});

test('se filtra por pedazo del nombre, no por coincidencia exacta', () => {
  // `i.empresa === cliente` obligaba a dar con el nombre completo, que con
  // noventa clientes es lo mismo que no tener filtro.
  assert.match(pagina, /const scope = items\.filter\(\(i\) => coincide\(i\.empresa, cliente\)\)/);
  assert.match(pagina, /import \{ coincide \} from '@\/lib\/buscar'/);
});

test('cuando no coincide nada, se ve QUÉ se buscó', () => {
  // Con texto libre casi siempre es una palabra mal escrita, y "estos filtros"
  // no dice cuál de los dos falló.
  assert.match(pagina, /Ningún cliente coincide con/);
  assert.match(pagina, /«\{cliente\}»/);
});
