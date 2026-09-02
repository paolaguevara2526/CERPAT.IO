// Vigencia del contrato: desde, meses y hasta.
//
// Los tres datos no son independientes, y esa es toda la dificultad: si se
// guardan sin relacionarlos terminan contradiciéndose, y el día que discrepen
// nadie sabe cuál creer. Aquí se fija la cuenta que los une y, sobre todo, qué
// pasa cuando NO cuadran.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesesContrato, finDeContrato, fechasCoherentes, diasParaVencer, estadoContrato } from './contrato.js';

// ---- Meses ----

test('los meses son un entero positivo', () => {
  assert.equal(mesesContrato(12), 12);
  assert.equal(mesesContrato('12'), 12);
  assert.equal(mesesContrato(6.9), 6, 'no hay medio mes de contrato');
});

test('cero, negativo o texto no son meses', () => {
  assert.equal(mesesContrato(0), null);
  assert.equal(mesesContrato(-3), null);
  assert.equal(mesesContrato('doce'), null);
  assert.equal(mesesContrato(''), null);
  assert.equal(mesesContrato(null), null);
});

test('hay un tope: más de cincuenta años es un dedazo', () => {
  assert.equal(mesesContrato(99999), 600);
});

// ---- Fecha de terminación ----

test('un año de contrato termina el día antes de cumplirse', () => {
  // Así se leen los contratos: 12 meses desde el 1 de febrero cubren hasta el
  // 31 de enero, no hasta el 1 de febrero siguiente.
  assert.equal(finDeContrato('2026-02-01', 12), '2027-01-31');
  assert.equal(finDeContrato('2026-01-01', 12), '2026-12-31');
  assert.equal(finDeContrato('2026-09-15', 6), '2027-03-14');
});

test('contratos cortos y de varios años', () => {
  assert.equal(finDeContrato('2026-09-01', 1), '2026-09-30');
  assert.equal(finDeContrato('2026-09-01', 24), '2028-08-31');
});

test('si el día no existe en el mes destino, se ajusta al último', () => {
  // 31 de enero + 1 mes es el 28 de febrero, no el 3 de marzo. Inventar un día
  // del mes siguiente alargaría el contrato en silencio.
  assert.equal(finDeContrato('2026-01-31', 1), '2026-02-27');
  assert.equal(finDeContrato('2026-03-31', 1), '2026-04-29');
});

test('el año bisiesto no descuadra la cuenta', () => {
  assert.equal(finDeContrato('2028-02-29', 12), '2029-02-27');
  assert.equal(finDeContrato('2027-03-01', 12), '2028-02-29');
});

test('sin fecha o sin meses no se inventa una terminación', () => {
  assert.equal(finDeContrato(null, 12), null);
  assert.equal(finDeContrato('2026-02-01', null), null);
  assert.equal(finDeContrato('2026-02-01', 0), null);
  assert.equal(finDeContrato('no es fecha', 12), null);
});

// ---- Coherencia entre los tres ----

test('cuando la terminación guardada cuadra con los meses', () => {
  assert.equal(fechasCoherentes('2026-02-01', 12, '2027-01-31'), true);
});

test('cuando NO cuadra, se detecta', () => {
  // Es el caso que importa: alguien cambió los meses y dejó la fecha vieja, o
  // al revés. No se corrige sola —una prórroga puede terminar en una fecha que
  // no cuadre con la aritmética— pero sí se avisa.
  assert.equal(fechasCoherentes('2026-02-01', 12, '2027-06-30'), false);
  assert.equal(fechasCoherentes('2026-02-01', 6, '2027-01-31'), false);
});

test('sin datos suficientes no hay contradicción que denunciar', () => {
  assert.equal(fechasCoherentes(null, 12, '2027-01-31'), true);
  assert.equal(fechasCoherentes('2026-02-01', null, '2027-01-31'), true);
  assert.equal(fechasCoherentes('2026-02-01', 12, null), true);
});

// ---- Estado ----

test('cuántos días faltan, y si ya pasó', () => {
  assert.equal(diasParaVencer('2026-09-30', '2026-09-02'), 28);
  assert.equal(diasParaVencer('2026-09-02', '2026-09-02'), 0, 'hoy mismo');
  assert.equal(diasParaVencer('2026-08-31', '2026-09-02'), -2, 'ya venció');
  assert.equal(diasParaVencer(null, '2026-09-02'), null);
});

test('el estado avisa antes de que se venza, no después', () => {
  // "Por vencer" es la ventana en la que todavía se puede renovar. Después ya
  // se está prestando el servicio sin papel vigente.
  assert.equal(estadoContrato('2027-06-30', '2026-09-02'), 'vigente');
  assert.equal(estadoContrato('2026-10-15', '2026-09-02'), 'por_vencer');
  assert.equal(estadoContrato('2026-09-02', '2026-09-02'), 'por_vencer', 'el último día todavía cuenta');
  assert.equal(estadoContrato('2026-09-01', '2026-09-02'), 'vencido');
  assert.equal(estadoContrato(null, '2026-09-02'), 'sin_fecha');
});

test('la ventana de aviso se puede ajustar', () => {
  assert.equal(estadoContrato('2026-11-01', '2026-09-02', 30), 'vigente');
  assert.equal(estadoContrato('2026-11-01', '2026-09-02', 90), 'por_vencer');
});
