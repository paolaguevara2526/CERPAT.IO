import { test } from 'node:test';
import assert from 'node:assert/strict';

import { claveNit, mismoNit, gruposDuplicados, choqueDeNit } from './duplicados.js';

test('el mismo NIT escrito de tres maneras es el mismo NIT', () => {
  assert.equal(claveNit('900.123.456-7'), claveNit('9001234567'));
  assert.equal(claveNit('900.123.456-7'), claveNit('900123456'));
  assert.ok(mismoNit('900.123.456-7', '9001234567'));
  assert.ok(mismoNit('900.123.456-7', '900123456'));
});

test('bloquear es más estricto que agrupar', () => {
  // Dos cédulas de diez dígitos que solo difieren en el último son dos
  // personas. Salen juntas en el diagnóstico (una fila que alguien lee) pero
  // no impiden crear la segunda ficha.
  assert.equal(claveNit('1020304050'), claveNit('1020304059'));
  assert.equal(mismoNit('1020304050', '1020304059'), false);
});

test('sin NIT no se afirma nada', () => {
  // Agrupar por vacío juntaría clientes que no tienen ninguna relación.
  assert.equal(claveNit(null), '');
  assert.equal(claveNit('   '), '');
  assert.equal(claveNit('-'), '');
  assert.equal(claveNit('123'), '');
});

test('dos fichas del mismo contribuyente salen aunque se llamen distinto', () => {
  const g = gruposDuplicados([
    { id: 'a', nombre: 'Ana Delia Piña', nit: '900123456-7' },
    { id: 'b', nombre: 'ANA D. PIÑA', nit: '900.123.456' },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].motivo, 'nit');
  assert.deepEqual(g[0].ids, ['a', 'b']);
});

test('el mismo nombre tecleado dos veces sale aunque no haya NIT', () => {
  // Es el caso real: la ficha se creó a mano dos veces y el desplegable de
  // "Plan por cliente" muestra dos opciones idénticas.
  const g = gruposDuplicados([
    { id: 'a', nombre: 'Ana Delia Piña', nit: null },
    { id: 'b', nombre: 'ANA DELIA PINA', nit: '' },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].motivo, 'nombre');
  assert.deepEqual(g[0].ids, ['a', 'b']);
});

test('un grupo ya reportado por NIT no se repite por nombre', () => {
  // La misma pareja dos veces en la lista se lee como dos problemas.
  const g = gruposDuplicados([
    { id: 'a', nombre: 'Comercial XYZ', nit: '900123456-7' },
    { id: 'b', nombre: 'Comercial XYZ', nit: '9001234567' },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].motivo, 'nit');
});

test('un tercero con el mismo nombre sí se reporta aunque dos ya salieran por NIT', () => {
  const g = gruposDuplicados([
    { id: 'a', nombre: 'Comercial XYZ', nit: '900123456-7' },
    { id: 'b', nombre: 'Comercial XYZ', nit: '9001234567' },
    { id: 'c', nombre: 'comercial xyz', nit: null },
  ]);
  const porNombre = g.find((x) => x.motivo === 'nombre');
  assert.ok(porNombre, 'la tercera ficha se pierde si el grupo por nombre se descarta entero');
  assert.deepEqual(porNombre!.ids, ['a', 'b', 'c']);
});

test('clientes distintos no se agrupan', () => {
  assert.deepEqual(
    gruposDuplicados([
      { id: 'a', nombre: 'Ana Delia Piña', nit: '900123456-7' },
      { id: 'b', nombre: 'Comercial XYZ', nit: '800999111-2' },
    ]),
    [],
  );
});

test('crear una segunda ficha con el mismo NIT choca', () => {
  const existentes = [{ id: 'a', nombre: 'Ana Delia Piña', nit: '900.123.456-7' }];
  assert.equal(choqueDeNit('9001234567', existentes)?.id, 'a');
  assert.equal(choqueDeNit('800999111', existentes), null);
});

test('una ficha no choca consigo misma al editarla', () => {
  // Sin esto, corregirle el formato al NIT sería imposible.
  const existentes = [{ id: 'a', nombre: 'Ana Delia Piña', nit: '900123456-7' }];
  assert.equal(choqueDeNit('900.123.456-7', existentes, 'a'), null);
});

test('sin NIT no se bloquea la creación', () => {
  // Hay clientes persona natural cargados sin NIT; bloquearlos entre sí sería
  // decir que son el mismo por no tener dato.
  const existentes = [{ id: 'a', nombre: 'Ana', nit: null }];
  assert.equal(choqueDeNit(null, existentes), null);
  assert.equal(choqueDeNit('', existentes), null);
});
