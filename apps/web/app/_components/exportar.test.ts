// La fecha de una celda de Excel.
//
// Si el día se manda ya formateado ("21 ago 2026"), Excel lo recibe como texto y
// la columna deja de ordenar y de filtrar por rango — justo lo primero que hace
// quien baja un listado de vencimientos. Va como Date, y armado desde las partes
// para que no se corra un día, que es el error que ya nos costó una corrección
// en toda la aplicación (ver lib/fechas.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaComoFecha } from './exportar.js';

const partes = (f: Date | null) => (f ? [f.getFullYear(), f.getMonth() + 1, f.getDate()] : null);

test('un día calendario queda en ese día, sin correrse', () => {
  // `new Date('2026-08-21')` lo leería como UTC y en Colombia (UTC-5) daría el 20.
  assert.deepEqual(partes(diaComoFecha('2026-08-21')), [2026, 8, 21]);
  assert.deepEqual(partes(diaComoFecha('2027-01-01')), [2027, 1, 1]);
  assert.deepEqual(partes(diaComoFecha('2026-12-31')), [2026, 12, 31]);
});

test('acepta la fecha completa que manda la API', () => {
  assert.deepEqual(partes(diaComoFecha('2026-08-21T00:00:00.000Z')), [2026, 8, 21]);
});

test('el 29 de febrero de un año bisiesto es válido', () => {
  assert.deepEqual(partes(diaComoFecha('2028-02-29')), [2028, 2, 29]);
});

test('una fecha imposible no se convierte en otra: queda vacía', () => {
  // JS convertiría el 31 de febrero en el 2 o 3 de marzo. Una celda vacía es
  // honesta; una fecha inventada se trabaja como si fuera cierta.
  assert.equal(diaComoFecha('2026-02-31'), null);
  assert.equal(diaComoFecha('2026-13-01'), null);
  assert.equal(diaComoFecha('2027-02-29'), null, '2027 no es bisiesto');
});

test('sin fecha, celda vacía', () => {
  assert.equal(diaComoFecha(''), null);
  assert.equal(diaComoFecha(null), null);
  assert.equal(diaComoFecha(undefined), null);
  assert.equal(diaComoFecha('no es una fecha'), null);
});
