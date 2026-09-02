// La fecha de una celda de Excel.
//
// Si el día se manda ya formateado ("21 ago 2026"), Excel lo recibe como texto y
// la columna deja de ordenar y de filtrar por rango — justo lo primero que hace
// quien baja un listado de vencimientos. Va como Date, y armado desde las partes
// para que no se corra un día, que es el error que ya nos costó una corrección
// en toda la aplicación (ver lib/fechas.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaComoFecha, serialExcel, FORMATO_FECHA_XLSX } from './exportar.js';

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

// ---- El número de serie de Excel ----
//
// La primera versión le pasaba el `Date` a la librería y dejaba que ella lo
// convirtiera. La librería usa el huso del navegador, y en Colombia (UTC-5) el
// 7 de septiembre quedaba con serie 46271,9998 — o sea, el 6. En pantalla todo
// se veía bien; solo el archivo mentía, que es la peor forma de fallar porque el
// archivo es el que se manda al cliente.

test('el día correcto, con serie entera', () => {
  // 46272 es el 7 de septiembre de 2026 en el calendario de Excel; 36526, el
  // 1 de enero de 2000, que es el valor de referencia conocido.
  assert.equal(serialExcel(new Date(2026, 8, 7)), 46272);
  assert.equal(serialExcel(new Date(2000, 0, 1)), 36526);
  assert.equal(serialExcel(new Date(2027, 0, 15)), 46402);
});

test('la hora del día no mueve la fecha', () => {
  // Es la invariante que hace que el archivo no dependa del huso de quien lo
  // baja: solo se leen año, mes y día.
  const dia = 46272;
  assert.equal(serialExcel(new Date(2026, 8, 7, 0, 0, 0)), dia);
  assert.equal(serialExcel(new Date(2026, 8, 7, 12, 0, 0)), dia);
  assert.equal(serialExcel(new Date(2026, 8, 7, 23, 59, 59)), dia);
});

test('días consecutivos, series consecutivas', () => {
  assert.equal(serialExcel(new Date(2026, 8, 8)) - serialExcel(new Date(2026, 8, 7)), 1);
  assert.equal(serialExcel(new Date(2027, 0, 1)) - serialExcel(new Date(2026, 11, 31)), 1, 'cambio de año');
  assert.equal(serialExcel(new Date(2028, 1, 29)) - serialExcel(new Date(2028, 1, 28)), 1, 'bisiesto');
});

test('lo que sale de diaComoFecha entra en serialExcel sin corrimiento', () => {
  const f = diaComoFecha('2026-09-07');
  assert.ok(f);
  assert.equal(serialExcel(f), 46272);
});

test('la celda de fecha lleva formato de fecha', () => {
  // Sin el formato, Excel abriría el archivo mostrando "46272" en vez del día.
  assert.equal(FORMATO_FECHA_XLSX, 'dd/mm/yyyy');
});
