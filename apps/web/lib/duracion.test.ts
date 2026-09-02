// Cuánto duró una visita. Es un número que se va a usar para cobrar y para
// repartir la agenda, así que lo que importa no es solo que sume bien: es que no
// invente una duración cuando el dato está mal escrito.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutosDeHora, duracionEnMinutos, duracionTexto, duracionEnHoras } from './duracion.js';

test('lee una hora "HH:MM"', () => {
  assert.equal(minutosDeHora('08:30'), 8 * 60 + 30);
  assert.equal(minutosDeHora('00:00'), 0);
  assert.equal(minutosDeHora('23:59'), 23 * 60 + 59);
  assert.equal(minutosDeHora('9:05'), 9 * 60 + 5, 'una sola cifra en la hora también');
});

test('lo que no es una hora, no lo es', () => {
  assert.equal(minutosDeHora('24:00'), null);
  assert.equal(minutosDeHora('08:60'), null);
  assert.equal(minutosDeHora('8'), null);
  assert.equal(minutosDeHora('mañana'), null);
  assert.equal(minutosDeHora(''), null);
  assert.equal(minutosDeHora(null), null);
  assert.equal(minutosDeHora(undefined), null);
});

test('la duración normal de una visita', () => {
  assert.equal(duracionEnMinutos('08:00', '10:30'), 150);
  assert.equal(duracionEnMinutos('14:15', '15:00'), 45);
  assert.equal(duracionEnMinutos('09:00', '17:00'), 480, 'una jornada completa');
});

test('sin una de las dos horas no hay duración', () => {
  // El acta se llena a lo largo de la visita: mientras no se marque la salida,
  // no hay nada que mostrar — y eso está bien.
  assert.equal(duracionEnMinutos('08:00', ''), null);
  assert.equal(duracionEnMinutos('', '10:00'), null);
  assert.equal(duracionEnMinutos(null, null), null);
});

test('una salida ANTES de la entrada no se convierte en 18 horas', () => {
  // Es la prueba que más importa. Si esto diera la vuelta al día, un dedazo
  // ("15:00" a "09:00") se vería como una jornada larguísima — y esas horas se
  // facturan. En blanco, quien lo vea corrige la hora.
  assert.equal(duracionEnMinutos('15:00', '09:00'), null);
  assert.equal(duracionTexto('15:00', '09:00'), '');
});

test('entrar y salir a la misma hora es cero, no vacío', () => {
  // Distinto del caso anterior: aquí el dato es coherente, solo que la visita
  // no duró. Esconderlo sería perder la diferencia entre "no se registró" y
  // "no duró nada".
  assert.equal(duracionEnMinutos('10:00', '10:00'), 0);
  assert.equal(duracionTexto('10:00', '10:00'), '0 min');
});

test('el texto se lee como lo diría una persona', () => {
  assert.equal(duracionTexto('08:00', '10:30'), '2 h 30 min');
  assert.equal(duracionTexto('08:00', '11:00'), '3 h', 'sin "0 min" de relleno');
  assert.equal(duracionTexto('08:00', '08:45'), '45 min', 'sin "0 h" de relleno');
});

test('las horas decimales sirven para sumar y cobrar', () => {
  assert.equal(duracionEnHoras('08:00', '10:30'), 2.5);
  assert.equal(duracionEnHoras('08:00', '09:00'), 1);
  assert.equal(duracionEnHoras('08:00', '08:20'), 0.33, 'redondeado a dos decimales');
  assert.equal(duracionEnHoras('15:00', '09:00'), null);
});
