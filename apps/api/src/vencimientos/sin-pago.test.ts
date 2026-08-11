// De esta función depende que una obligación muestre —o no— la casilla de valor
// a pagar y los estados de pago. Equivocarse hacia el lado permisivo hace que
// alguien digite un valor en algo que nunca se paga, y ese valor termina en
// Pagos y en los indicadores.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obligacionSinPago } from './generador.js';

test('las de solo presentación no llevan pago', () => {
  assert.equal(obligacionSinPago('Envío de nómina electrónica'), true);
  assert.equal(obligacionSinPago('Seguridad social (PILA)'), true);
  assert.equal(obligacionSinPago('RUB (Registro Único de Beneficiarios)'), true);
});

test('la información exógena nunca genera pago, se llame como se llame', () => {
  // Se agregan a mano y el nombre es texto libre: enumerarlas una por una
  // dejaría fuera la del municipio que se cargue mañana.
  assert.equal(obligacionSinPago('Exógena municipal (medios magnéticos)'), true);
  assert.equal(obligacionSinPago('Exógena de ICA'), true);
  assert.equal(obligacionSinPago('Información exógena DIAN'), true);
  assert.equal(obligacionSinPago('EXOGENA MUNICIPAL'), true, 'sin tilde y en mayúsculas también');
});

test('las declaraciones con saldo SÍ llevan pago', () => {
  // El error caro es al revés: esconder la casilla en algo que sí se paga
  // dejaría al asesor sin dónde registrar el valor.
  for (const o of ['Retención en la fuente', 'IVA', 'ICA', 'ReteICA', 'AutoICA',
                   'Renta Persona Jurídica', 'Impuesto al consumo', 'Anticipo RST']) {
    assert.equal(obligacionSinPago(o), false, o);
  }
});

test('no se cae con un nombre vacío', () => {
  assert.equal(obligacionSinPago(''), false);
  assert.equal(obligacionSinPago(undefined as unknown as string), false);
});
