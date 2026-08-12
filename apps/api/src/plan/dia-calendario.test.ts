// Un auxiliar reportó que lo capturado hoy quedaba con la fecha de ayer. No era
// un error de digitación: la fecha se guardaba y se leía como si fuera un
// instante, y entre Colombia (UTC−5) y UTC hay cinco horas que se comían un día.
//
// Estas pruebas fijan la regla: el día que se escribe es el día que se guarda.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaCalendario, estaVencido, hoyEnColombia } from './dia-calendario.js';

test('guarda el día que se escribió, a medianoche UTC', () => {
  assert.equal(diaCalendario('2026-08-11').toISOString(), '2026-08-11T00:00:00.000Z');
  assert.equal(diaCalendario('2026-01-01').toISOString(), '2026-01-01T00:00:00.000Z');
});

test('una captura de la noche colombiana NO se pasa al día siguiente', () => {
  // 8:30 p. m. del 11 en Colombia son las 01:30 UTC del 12. Antes se guardaba
  // ese instante y el lote aparecía el 12; el auxiliar capturó el 11.
  assert.equal(diaCalendario('2026-08-11T20:30:00-05:00').toISOString(), '2026-08-11T00:00:00.000Z');
});

test('descarta un día que no existe en vez de correrlo', () => {
  // new Date("2026-02-31") no falla: lo corre al 3 de marzo. Guardar eso sería
  // inventar un día que nadie escribió.
  const d = diaCalendario('2026-02-31');
  assert.notEqual(d.toISOString().slice(0, 10), '2026-03-03');
  assert.equal(d.toISOString().slice(11), '00:00:00.000Z', 'sea cual sea el día, va a medianoche UTC');
});

test('sin fecha usa hoy, siempre a medianoche', () => {
  for (const v of [undefined, null, '', 'cualquier cosa']) {
    const d = diaCalendario(v);
    assert.equal(d.toISOString().slice(11), '00:00:00.000Z');
    assert.equal(d.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));
  }
});

test('guardar bien no basta: mostrarlo en hora local resta un día', () => {
  // Esta es la mitad que fallaba en pantalla. Se deja escrita para que quede
  // claro por qué el formateo tiene que ser en UTC y no "el que traiga el
  // navegador": es exactamente el día que el auxiliar veía mal.
  const guardado = diaCalendario('2026-08-11');
  const fmt = (tz: string) => guardado.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: tz });

  assert.equal(fmt('UTC'), fmt('UTC'), 'referencia');
  assert.notEqual(
    fmt('America/Bogota'), fmt('UTC'),
    'si algún día coinciden, esta prueba dejó de proteger nada',
  );
  assert.match(fmt('UTC'), /11/, 'en UTC se ve el 11, que es el día que se capturó');
  assert.match(fmt('America/Bogota'), /10/, 'en hora local se veía el 10: el error reportado');
});

// --- Vencido: se comparan DÍAS, no instantes ---
//
// El error que esto cierra: `fechaVencimiento < new Date()` marcaba vencida una
// obligación desde las 7 p. m. del día ANTERIOR, porque a esa hora el reloj UTC
// ya pasó la medianoche del día de vencimiento. Una alarma falsa a quien está
// corriendo contra un vencimiento real.

test('el mismo día del vencimiento NO está vencido', () => {
  const vence = new Date('2026-08-13T00:00:00.000Z');
  // 7 a. m. y 11 p. m. en Colombia del 13: todavía tiene plazo.
  assert.equal(estaVencido(vence, new Date('2026-08-13T12:00:00Z')), false);
  assert.equal(estaVencido(vence, new Date('2026-08-14T03:59:00Z')), false, '11 p. m. del 13 en Colombia');
});

test('a las 7 p. m. del día anterior NO está vencido (el error reportado)', () => {
  const vence = new Date('2026-08-13T00:00:00.000Z');
  // 8:30 p. m. del 12 en Colombia = 01:30 UTC del 13. Antes daba "vencido".
  assert.equal(estaVencido(vence, new Date('2026-08-13T01:30:00Z')), false);
});

test('al día siguiente sí está vencido', () => {
  const vence = new Date('2026-08-13T00:00:00.000Z');
  assert.equal(estaVencido(vence, new Date('2026-08-14T12:00:00Z')), true);
});

test('sin fecha no hay vencimiento', () => {
  for (const v of [null, undefined, '', 'nunca']) assert.equal(estaVencido(v as never), false);
});

test('hoyEnColombia no se adelanta al servidor en UTC', () => {
  // 8:30 p. m. del 12 en Colombia: en UTC ya es 13, pero para la firma es 12.
  assert.equal(hoyEnColombia(new Date('2026-08-13T01:30:00Z')), '2026-08-12');
  assert.equal(hoyEnColombia(new Date('2026-08-13T12:00:00Z')), '2026-08-13');
});
