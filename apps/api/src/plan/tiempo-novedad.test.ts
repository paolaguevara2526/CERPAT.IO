// De esta cuenta sale el total que va a responder "¿cuánto nos cuesta el
// internet al mes?". Un minuto mal sumado por novedad, con varias personas y
// todos los días, deja de ser un detalle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutosNovedad, formatoMinutos } from './tiempo-novedad.js';

test('cuenta los minutos entre dos horas', () => {
  assert.equal(minutosNovedad('08:00', '09:30'), 90);
  assert.equal(minutosNovedad('14:15', '14:45'), 30);
  assert.equal(minutosNovedad('7:05', '08:00'), 55, 'una cifra en la hora también');
});

test('mismo inicio y fin es cero, no nulo', () => {
  // Una novedad de un minuto existe; cero también. Devolver null la sacaría del
  // total como si no hubiera pasado.
  assert.equal(minutosNovedad('10:00', '10:00'), 0);
});

test('si el fin va antes que el inicio, no inventa', () => {
  // No se asume que cruzó la medianoche: esta gente trabaja de día, así que lo
  // más probable es que esté mal escrito. Un número inventado ensucia el total.
  assert.equal(minutosNovedad('15:00', '09:00'), null);
});

test('sin horas no hay cuenta', () => {
  assert.equal(minutosNovedad(null, '09:00'), null);
  assert.equal(minutosNovedad('09:00', null), null);
  assert.equal(minutosNovedad(null, null), null);
  assert.equal(minutosNovedad('', ''), null);
});

test('rechaza horas imposibles en vez de aceptarlas', () => {
  assert.equal(minutosNovedad('25:00', '26:00'), null);
  assert.equal(minutosNovedad('09:75', '10:00'), null);
  assert.equal(minutosNovedad('nueve', '10:00'), null);
  assert.equal(minutosNovedad('9-00', '10:00'), null);
});

test('el formato se lee como lo diría una persona', () => {
  assert.equal(formatoMinutos(45), '45 min');
  assert.equal(formatoMinutos(60), '1 h');
  assert.equal(formatoMinutos(90), '1 h 30 min');
  assert.equal(formatoMinutos(125), '2 h 5 min');
  assert.equal(formatoMinutos(0), '0 min');
  assert.equal(formatoMinutos(null), '—');
});
