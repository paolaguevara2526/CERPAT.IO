import { test } from 'node:test';
import assert from 'node:assert/strict';

import { etiquetasUnicas, hayNombresRepetidos } from './etiquetas.js';

test('los nombres que no se repiten quedan intactos', () => {
  // Marcar las noventa opciones con un id vuelve la lista ilegible para
  // resolver un caso.
  const e = etiquetasUnicas([
    { id: '1', nombre: 'Ana Delia Piña', nit: '900123456-7' },
    { id: '2', nombre: 'Comercial XYZ', nit: '800999111-2' },
  ]);
  assert.equal(e.get('1'), 'Ana Delia Piña');
  assert.equal(e.get('2'), 'Comercial XYZ');
});

test('dos fichas con el mismo nombre se pueden distinguir', () => {
  const e = etiquetasUnicas([
    { id: 'aaaaaa111111', nombre: 'Ana Delia Piña', nit: '900123456-7' },
    { id: 'bbbbbb222222', nombre: 'Ana Delia Piña', nit: '901222333-4' },
  ]);
  assert.notEqual(e.get('aaaaaa111111'), e.get('bbbbbb222222'));
  assert.match(e.get('aaaaaa111111')!, /900123456-7/);
  assert.match(e.get('bbbbbb222222')!, /901222333-4/);
});

test('sin NIT todavía se distinguen', () => {
  // Es justo el caso que crea el problema: fichas hechas a mano, sin NIT.
  const e = etiquetasUnicas([
    { id: 'aaaaaa111111', nombre: 'Ana Delia Piña', nit: null },
    { id: 'bbbbbb222222', nombre: 'ANA DELIA PINA', nit: '' },
  ]);
  assert.notEqual(e.get('aaaaaa111111'), e.get('bbbbbb222222'));
  assert.match(e.get('aaaaaa111111')!, /111111/);
});

test('la etiqueta repetida se marca, no solo se diferencia', () => {
  // Distinguirlas en silencio deja elegir bien y no enterarse de que hay algo
  // que unificar.
  const e = etiquetasUnicas([
    { id: '1', nombre: 'Ana Delia Piña' },
    { id: '2', nombre: 'ana delia piña' },
  ]);
  assert.match(e.get('1')!, /repetido/);
});

test('tildes y mayúsculas no hacen dos clientes distintos', () => {
  assert.equal(hayNombresRepetidos([{ id: '1', nombre: 'Ana Delia Piña' }, { id: '2', nombre: 'ANA DELIA PINA' }]), true);
  assert.equal(hayNombresRepetidos([{ id: '1', nombre: 'Ana' }, { id: '2', nombre: 'Beto' }]), false);
});
