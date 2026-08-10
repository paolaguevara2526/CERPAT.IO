// El conteo de un rango de consecutivos alimenta la cantidad de documentos que
// el auxiliar reporta cada día. Un error de uno se acumula todo el mes y solo
// aparece cuando alguien cuadra los soportes contra el software.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contarConsecutivos } from './consecutivos';

test('el rango es inclusivo: cuenta los dos extremos', () => {
  // De 100 a 105 hay SEIS documentos. El 100 también se capturó; restar a secas
  // da 5 y deja uno fuera cada vez.
  assert.equal(contarConsecutivos('100', '105'), '6');
  assert.equal(contarConsecutivos('1', '1'), '1');
});

test('funciona con prefijos, que es como vienen de verdad', () => {
  assert.equal(contarConsecutivos('CE-1045', 'CE-1290'), '246');
  assert.equal(contarConsecutivos('FV 200', 'FV 209'), '10');
});

test('los ceros a la izquierda no alteran la cuenta', () => {
  assert.equal(contarConsecutivos('0001', '0010'), '10');
});

test('sin datos suficientes no inventa un número', () => {
  // Vacío devuelve '' para que el campo quede en blanco y se pueda escribir a
  // mano, en vez de mostrar un 0 o un 1 que parecen un dato real.
  assert.equal(contarConsecutivos('', '105'), '');
  assert.equal(contarConsecutivos('100', ''), '');
  assert.equal(contarConsecutivos('', ''), '');
  assert.equal(contarConsecutivos('ABC', 'XYZ'), '');
});

test('un rango al revés no se calcula', () => {
  // Si el final es menor que el inicial, el dato está mal escrito. Devolver un
  // negativo, o el valor absoluto, sería tapar el error del usuario.
  assert.equal(contarConsecutivos('105', '100'), '');
});
