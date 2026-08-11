import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicaEnMesPlan } from './periodicidad.js';

/** Meses (1..12) en los que se genera una actividad con esa periodicidad. */
const mesesDe = (p: string) => Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => aplicaEnMesPlan(p, m));

test('mensual cae todos los meses', () => {
  assert.deepEqual(mesesDe('Mensual'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('las demás se anclan en enero', () => {
  assert.deepEqual(mesesDe('Bimestral'), [1, 3, 5, 7, 9, 11]);
  assert.deepEqual(mesesDe('Trimestral'), [1, 4, 7, 10]);
  assert.deepEqual(mesesDe('Cuatrimestral'), [1, 5, 9]);
  assert.deepEqual(mesesDe('Semestral'), [1, 7]);
  assert.deepEqual(mesesDe('Anual'), [1]);
});

test('una periodicidad que no está en el catálogo no genera nada', () => {
  // Mejor que falte una tarea y alguien la reclame, a repartir trabajo
  // inventado a 90 clientes por un dato mal escrito.
  assert.deepEqual(mesesDe(''), []);
  assert.deepEqual(mesesDe('Quincenal'), []);
  assert.equal(aplicaEnMesPlan(null, 8), false);
  assert.equal(aplicaEnMesPlan(undefined, 8), false);
});

test('no le afectan los espacios sobrantes', () => {
  // La periodicidad puede venir de una importación de Excel.
  assert.equal(aplicaEnMesPlan(' Trimestral ', 4), true);
});

test('distingue mayúsculas, como el catálogo', () => {
  // Si algún día se acepta 'mensual' en minúscula, esta prueba avisa que hay
  // que decidirlo a propósito y no descubrirlo con tareas faltantes.
  assert.equal(aplicaEnMesPlan('mensual', 8), false);
});
