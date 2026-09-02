// Vencimientos que nacían sin dueño.
//
// El responsable se resolvía por un solo camino —obligación → actividad
// vinculada → área → asignación— y si faltaba cualquier eslabón el vencimiento
// quedaba sin asesor, en silencio: no le aparece a nadie en Mi Día y se descubre
// cuando ya está vencido. Se vio de golpe al exportar a Excel, con la columna
// "Responsable" en blanco en decenas de obligaciones nuevas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverResponsable, type Asignacion } from './responsable.js';

const IMPUESTOS = 'area-imp';
const NOMINA = 'area-nom';

const a = (areaId: string, asesorId: string | null, auxiliarId: string | null = null): Asignacion =>
  ({ areaId, asesorId, auxiliarId });

test('manda el área de la obligación cuando se puede resolver', () => {
  const r = resolverResponsable(NOMINA, [a(IMPUESTOS, 'ana'), a(NOMINA, 'diego', 'aux-1')]);
  assert.deepEqual(r, { asesorId: 'diego', auxiliarId: 'aux-1', origen: 'area' });
});

test('el área manda incluso si la empresa tiene un solo asesor', () => {
  // No es lo mismo "el área no se pudo resolver" que "el área dice otra cosa".
  const r = resolverResponsable(NOMINA, [a(NOMINA, 'diego')]);
  assert.equal(r.origen, 'area');
  assert.equal(r.asesorId, 'diego');
});

test('sin área, si la empresa tiene UN solo asesor, es suyo', () => {
  // Es lo que pidió la dirección y el caso corriente: un cliente que lleva una
  // sola persona. Ahí no hay nada que adivinar.
  const r = resolverResponsable(null, [a(IMPUESTOS, 'ana', 'aux-1'), a(NOMINA, 'ana', 'aux-1')]);
  assert.deepEqual(r, { asesorId: 'ana', auxiliarId: 'aux-1', origen: 'empresa' });
});

test('también cuando el área existe pero esa asignación no tiene asesor', () => {
  const r = resolverResponsable(NOMINA, [a(IMPUESTOS, 'ana'), a(NOMINA, null)]);
  assert.equal(r.origen, 'empresa');
  assert.equal(r.asesorId, 'ana');
});

test('y cuando el área de la obligación ni siquiera está asignada en esa empresa', () => {
  const r = resolverResponsable(NOMINA, [a(IMPUESTOS, 'ana')]);
  assert.equal(r.origen, 'empresa');
  assert.equal(r.asesorId, 'ana');
});

test('con VARIOS asesores en la empresa no se reparte a dedo', () => {
  // Ponerle el trabajo de nómina al asesor de impuestos sería peor que dejarlo
  // sin asignar: un vencimiento sin dueño se ve y se reclama; uno con el dueño
  // equivocado se trabaja mal.
  const r = resolverResponsable(null, [a(IMPUESTOS, 'ana'), a(NOMINA, 'diego')]);
  assert.deepEqual(r, { asesorId: null, auxiliarId: null, origen: 'ninguno' });
});

test('el auxiliar sigue el mismo criterio: si hay varios, va vacío', () => {
  const r = resolverResponsable(null, [a(IMPUESTOS, 'ana', 'aux-1'), a(NOMINA, 'ana', 'aux-2')]);
  assert.equal(r.asesorId, 'ana', 'el asesor sí es único');
  assert.equal(r.auxiliarId, null, 'los auxiliares no, así que no se elige uno');
});

test('una empresa sin ninguna asignación queda sin dueño', () => {
  assert.deepEqual(resolverResponsable(IMPUESTOS, []), { asesorId: null, auxiliarId: null, origen: 'ninguno' });
  assert.deepEqual(resolverResponsable(null, []), { asesorId: null, auxiliarId: null, origen: 'ninguno' });
});

test('asignaciones sin asesor no cuentan como "varios"', () => {
  // Filas vacías no deben impedir que se resuelva por la empresa.
  const r = resolverResponsable(null, [a(IMPUESTOS, 'ana'), a(NOMINA, null), a('area-tes', null)]);
  assert.equal(r.origen, 'empresa');
  assert.equal(r.asesorId, 'ana');
});

test('el mismo asesor repetido en varias áreas sigue siendo uno solo', () => {
  const r = resolverResponsable(undefined, [a(IMPUESTOS, 'ana'), a(NOMINA, 'ana'), a('area-inf', 'ana')]);
  assert.equal(r.origen, 'empresa');
  assert.equal(r.asesorId, 'ana');
});
