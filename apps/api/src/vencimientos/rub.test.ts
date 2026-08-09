// El RUB depende de la naturaleza jurídica del cliente, no de cómo declare renta.
//
// Antes se derivaba de `rentaTipo`, y eso borró vencimientos reales: una persona
// jurídica con la casilla de Renta en "No aplica" —opción legítima— quedaba sin
// RUB, y al regenerar sus vencimientos se eliminaban en silencio. Estos tests
// fijan la regla para que no vuelva a depender de un campo que no le corresponde.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicaRub } from './generador.js';

test('las personas jurídicas están obligadas', () => {
  assert.equal(aplicaRub('Persona Jurídica'), true);
  assert.equal(aplicaRub('persona juridica'), true); // sin tildes ni mayúsculas
});

test('los consorcios y uniones temporales están obligados', () => {
  assert.equal(aplicaRub('Consorcio o Unión Temporal'), true);
});

test('las personas naturales NO están obligadas', () => {
  assert.equal(aplicaRub('Persona Natural'), false);
  assert.equal(aplicaRub('PERSONA NATURAL'), false);
});

test('sin tipo definido no se inventa la obligación', () => {
  assert.equal(aplicaRub(null), false);
  assert.equal(aplicaRub(''), false);
  assert.equal(aplicaRub(undefined), false);
});
