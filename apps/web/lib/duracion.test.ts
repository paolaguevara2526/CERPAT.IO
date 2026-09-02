// Cuánto duró una visita. Es un número que se va a usar para cobrar y para
// repartir la agenda, así que lo que importa no es solo que sume bien: es que no
// invente una duración cuando el dato está mal escrito.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutosDeHora, duracionEnMinutos, duracionBrutaEnMinutos, duracionTexto, duracionEnHoras, minutosDeAlmuerzo, almuerzoTexto } from './duracion.js';

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

// ---- El almuerzo ----
// En una visita de todo el día son 8 horas de presencia contra 7 de trabajo, y
// esa hora se factura. Por eso el descuento no es un detalle de presentación:
// cambia el número que se cobra.

test('el almuerzo se descuenta del tiempo trabajado', () => {
  assert.equal(duracionEnMinutos('08:00', '17:00', 60), 480, 'jornada de 9 h menos 1 h');
  assert.equal(duracionEnMinutos('08:00', '17:00', 30), 510);
  assert.equal(duracionTexto('08:00', '17:00', 60), '8 h');
  assert.equal(duracionEnHoras('08:00', '17:00', 90), 7.5);
});

test('sin almuerzo, el cálculo es el de antes', () => {
  // Compatibilidad: las visitas cortas y las ya registradas no llevan descanso.
  assert.equal(duracionEnMinutos('08:00', '10:30'), 150);
  assert.equal(duracionEnMinutos('08:00', '10:30', 0), 150);
  assert.equal(duracionEnMinutos('08:00', '10:30', null), 150);
  assert.equal(duracionEnMinutos('08:00', '10:30', undefined), 150);
  assert.equal(duracionEnMinutos('08:00', '10:30', ''), 150);
});

test('un almuerzo mal escrito no resta al revés', () => {
  // Un negativo sumaría tiempo trabajado, que es exactamente lo que no puede
  // pasar en un número que se factura.
  assert.equal(minutosDeAlmuerzo(-60), 0);
  assert.equal(minutosDeAlmuerzo('abc'), 0);
  assert.equal(minutosDeAlmuerzo(null), 0);
  assert.equal(minutosDeAlmuerzo('45'), 45, 'un texto con número sí sirve: viene de un input');
  assert.equal(minutosDeAlmuerzo(45.7), 45, 'sin fracciones de minuto');
  assert.equal(duracionEnMinutos('08:00', '10:00', -60), 120, 'un negativo no alarga la visita');
});

test('un almuerzo más largo que la visita es un error, no un cero', () => {
  // Mostrarlo como 0 escondería el dedazo. En blanco se ve y se corrige.
  assert.equal(duracionEnMinutos('08:00', '10:00', 180), null);
  assert.equal(duracionTexto('08:00', '10:00', 180), '');
});

test('un almuerzo igual a toda la visita sí es cero', () => {
  // Coherente, aunque raro: entró, almorzó y se fue. No es lo mismo que un dato
  // imposible.
  assert.equal(duracionEnMinutos('12:00', '13:00', 60), 0);
  assert.equal(duracionTexto('12:00', '13:00', 60), '0 min');
});

test('la presencia se puede ver aparte del tiempo trabajado', () => {
  // Son dos cosas distintas y a veces hay que mostrar las dos: "estuvo 9 h,
  // trabajó 8".
  assert.equal(duracionBrutaEnMinutos('08:00', '17:00'), 540);
  assert.equal(duracionEnMinutos('08:00', '17:00', 60), 480);
});

test('el descanso se escribe como lo diría una persona', () => {
  assert.equal(almuerzoTexto(60), '1 h');
  assert.equal(almuerzoTexto(45), '45 min');
  assert.equal(almuerzoTexto(90), '1 h 30 min');
  assert.equal(almuerzoTexto(0), '');
  assert.equal(almuerzoTexto(null), '');
});
