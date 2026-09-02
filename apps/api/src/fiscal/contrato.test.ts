// Las horas pactadas al mes con un cliente.
//
// De aquí sale el denominador del cumplimiento (ejecutadas / pactadas), así que
// un valor imposible no rompe nada visible: desvía el indicador en silencio. Un
// cero, por ejemplo, vuelve a ese cliente un cumplimiento infinito o una
// división por cero, según quién haga la cuenta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horasPactadas, MAX_HORAS_MES } from './contrato.js';

test('un número de horas normal', () => {
  assert.equal(horasPactadas(8), 8);
  assert.equal(horasPactadas('8'), 8);
  assert.equal(horasPactadas(7.5), 7.5);
});

test('acepta la coma decimal, que es como se escribe acá', () => {
  // El formulario puede mandar "7,5" y son siete horas y media, no un error.
  assert.equal(horasPactadas('7,5'), 7.5);
  assert.equal(horasPactadas('0,5'), 0.5);
});

test('sin dato es null, no cero', () => {
  // "Todavía no se sabe" y "se pactaron cero horas" son cosas distintas, y la
  // segunda no existe: nadie contrata cero horas.
  assert.equal(horasPactadas(''), null);
  assert.equal(horasPactadas('   '), null);
  assert.equal(horasPactadas(null), null);
  assert.equal(horasPactadas(undefined), null);
});

test('cero y negativos no se guardan', () => {
  // Cero volvería a ese cliente un cumplimiento infinito o una división por
  // cero; un negativo no significa nada.
  assert.equal(horasPactadas(0), null);
  assert.equal(horasPactadas('0'), null);
  assert.equal(horasPactadas(-5), null);
});

test('lo que no es un número tampoco', () => {
  assert.equal(horasPactadas('ocho'), null);
  assert.equal(horasPactadas('8 horas'), null);
  assert.equal(horasPactadas({}), null);
  assert.equal(horasPactadas(NaN), null);
  assert.equal(horasPactadas(Infinity), null);
});

test('se redondea a dos decimales', () => {
  // Sin esto, un 7,333333 en la ficha no cuadra con el 7,33 que se muestra.
  assert.equal(horasPactadas(7.3333333), 7.33);
  assert.equal(horasPactadas('0.125'), 0.13);
});

test('hay un tope de sensatez', () => {
  // Un dedazo de mil horas al mes daría un cumplimiento del 1 % en un cliente
  // que se está atendiendo bien.
  assert.equal(horasPactadas(999999), MAX_HORAS_MES);
});
