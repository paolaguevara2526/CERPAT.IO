// El asesor elegido en la ficha del cliente llena vacíos, no pisa reparto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areasSinAsesor, resumenAsignacion } from './asesor-inicial.js';

const AREAS = ['contable', 'impuestos', 'nomina'];

test('un cliente nuevo no tiene nada asignado: se llenan todas', () => {
  // Es el caso que importa: hasta ahora el cliente nacía sin dueño y su trabajo
  // no le aparecía a nadie hasta que alguien se acordara de repartirlo.
  assert.deepEqual(areasSinAsesor(AREAS, []), AREAS);
});

test('las áreas ya repartidas no se tocan', () => {
  // La coordinación puso a alguien en Contable a propósito: una casilla suelta
  // en la ficha no puede deshacerlo sin que nadie se entere.
  const asign = [{ areaId: 'contable', asesorId: 'u1' }];
  assert.deepEqual(areasSinAsesor(AREAS, asign), ['impuestos', 'nomina']);
});

test('una asignación existente SIN asesor sí se llena', () => {
  // La fila puede existir solo por la talla o el auxiliar y seguir sin dueño.
  const asign = [{ areaId: 'contable', asesorId: null }, { areaId: 'impuestos', asesorId: 'u2' }];
  assert.deepEqual(areasSinAsesor(AREAS, asign), ['contable', 'nomina']);
});

test('si ya está todo repartido no se cambia nada', () => {
  const asign = AREAS.map((areaId) => ({ areaId, asesorId: 'u1' }));
  assert.deepEqual(areasSinAsesor(AREAS, asign), []);
});

test('el resumen dice qué va a pasar antes de guardar', () => {
  assert.deepEqual(resumenAsignacion(AREAS, [{ areaId: 'contable', asesorId: 'u1' }]), { porLlenar: 2, respetadas: 1 });
  assert.deepEqual(resumenAsignacion(AREAS, []), { porLlenar: 3, respetadas: 0 });
});
