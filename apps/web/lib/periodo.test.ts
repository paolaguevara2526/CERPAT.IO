// Moverse entre los meses del plan.
//
// El caso que lo motivó: generado septiembre, no había cómo devolverse a ver
// agosto — las capturas, los pendientes del cierre, nada. El backend sí servía
// cualquier mes; lo que faltaba era pedirlo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodoValido, periodoDe, moverPeriodo, periodoAnterior, periodoSiguiente,
  nombrePeriodo, mesesDesdeHoy, avisoPeriodo, periodoAMostrar,
} from './periodo.js';

test('qué es un período y qué no', () => {
  assert.equal(periodoValido('2026-09'), true);
  assert.equal(periodoValido('2026-13'), false, 'no hay mes 13');
  assert.equal(periodoValido('2026-00'), false);
  assert.equal(periodoValido('2026-9'), false, 'el mes va con dos dígitos');
  assert.equal(periodoValido('septiembre'), false);
  assert.equal(periodoValido(null), false);
});

test('el período sale del día calendario local', () => {
  // Con toISOString(), el 30 de septiembre a las 8 p.m. en Colombia ya sería
  // octubre y el planeador saltaría de mes una tarde antes de tiempo.
  assert.equal(periodoDe(new Date(2026, 8, 30, 20, 0)), '2026-09');
  assert.equal(periodoDe(new Date(2026, 0, 1, 0, 30)), '2026-01');
});

test('atrás y adelante, incluso cruzando el año', () => {
  assert.equal(periodoAnterior('2026-09'), '2026-08');
  assert.equal(periodoAnterior('2026-01'), '2025-12');
  assert.equal(periodoSiguiente('2026-12'), '2027-01');
  assert.equal(moverPeriodo('2026-09', -12), '2025-09');
});

test('un período inválido no se mueve a ninguna parte', () => {
  assert.equal(moverPeriodo('2026-13', -1), null);
  assert.equal(moverPeriodo('', 1), null);
});

test('el nombre del mes se lee, no se descifra', () => {
  assert.equal(nombrePeriodo('2026-08'), 'agosto 2026');
  assert.equal(nombrePeriodo('2026-12'), 'diciembre 2026');
  assert.equal(nombrePeriodo(null), '');
  assert.equal(nombrePeriodo('2026-13'), '');
});

test('a cuántos meses está de hoy', () => {
  assert.equal(mesesDesdeHoy('2026-09', '2026-09'), 0);
  assert.equal(mesesDesdeHoy('2026-08', '2026-09'), -1);
  assert.equal(mesesDesdeHoy('2026-10', '2026-09'), 1);
  assert.equal(mesesDesdeHoy('2025-09', '2026-09'), -12);
});

test('en el mes en curso no hay nada que advertir', () => {
  assert.equal(avisoPeriodo('2026-09', '2026-09')?.tipo, 'actual');
});

test('un mes cerrado se advierte, y dice cuál y hace cuánto', () => {
  // Es lo que evita el error caro: creer que se ve el trabajo de hoy cuando la
  // pantalla muestra el de hace tres meses.
  const a = avisoPeriodo('2026-06', '2026-09');
  assert.equal(a?.tipo, 'pasado');
  assert.equal(a?.meses, 3);
  assert.match(a!.texto, /junio 2026/);
  assert.match(a!.texto, /3 meses/);
});

test('un mes que aún no empieza también', () => {
  const a = avisoPeriodo('2026-10', '2026-09');
  assert.equal(a?.tipo, 'futuro');
  assert.match(a!.texto, /aún no empieza/);
  assert.match(a!.texto, /1 mes/, 'en singular cuando es uno solo');
});

test('un período roto en la URL no deja la pantalla en blanco', () => {
  // Llega de un enlace copiado a medias: se ignora y se muestra el mes en curso.
  assert.equal(periodoAMostrar('2026-08', '2026-09'), '2026-08');
  assert.equal(periodoAMostrar('basura', '2026-09'), '2026-09');
  assert.equal(periodoAMostrar(null, '2026-09'), '2026-09');
  assert.equal(periodoAMostrar('', '2026-09'), '2026-09');
});
