import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizar, coincide } from './buscar.js';

test('se busca por pedazo, no por el comienzo', () => {
  // El desplegable saltaba a la primera opción que empezaba por la letra
  // tecleada. Pero uno no recuerda cómo arranca el nombre completo del cliente;
  // recuerda una palabra del medio.
  assert.ok(coincide('Grupo Empresarial Dajitaneja SAS', 'taneja'));
  assert.ok(coincide('Grupo Empresarial Dajitaneja SAS', 'empresarial'));
});

test('las tildes y las mayúsculas no cuentan', () => {
  assert.ok(coincide('Ana Delia Piña', 'pina'));
  assert.ok(coincide('ANA DELIA PINA', 'piña'));
  assert.equal(normalizar('  Ana   Delia  '), 'ana delia');
});

test('varias palabras se piden todas, en cualquier orden', () => {
  // Exigir el orden obligaría a recordar el nombre completo.
  assert.ok(coincide('Acme Consultores SAS', 'acme sas'));
  assert.ok(coincide('Acme Consultores SAS', 'sas acme'));
  assert.equal(coincide('Acme Consultores SAS', 'acme ltda'), false);
});

test('el campo vacío no filtra nada', () => {
  // Si una consulta vacía no coincidiera con nada, borrar el campo dejaría la
  // pantalla en blanco en vez de mostrarlo todo.
  assert.ok(coincide('Acme Consultores SAS', ''));
  assert.ok(coincide('Acme Consultores SAS', '   '));
});

test('un cliente sin nombre no coincide con una búsqueda real', () => {
  assert.equal(coincide(null, 'acme'), false);
  assert.equal(coincide('', 'acme'), false);
  // …pero sigue apareciendo cuando no se está filtrando.
  assert.ok(coincide(null, ''));
});

test('lo que no está, no aparece', () => {
  assert.equal(coincide('Acme Consultores SAS', 'zzz'), false);
});
