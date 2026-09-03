// Pasar UNA obligación a otro asesor.
//
// El caso real: hay impuestos que no los liquida el asesor asignado sino otro
// que estaba disponible esa semana. Hasta ahora la única manera de reflejarlo
// era cambiar la asignación del cliente, que mueve TODAS sus obligaciones y
// todas sus tareas del plan — demasiado para un relevo de una vez.
//
// Lo que estas pruebas cuidan es lo que hace peligroso el cambio: que se note
// de quién sale y a quién entra, que no se dispare por rozar una lista, y que
// no se lea como una reasignación del cliente completo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(AQUI, 'ImpuestosDelDia.tsx'), 'utf8');

test('la lista dice quién responde por cada obligación', () => {
  // La coordinación ve las de toda la firma: sin esta columna la lista no dice
  // de quién es nada.
  assert.match(panel, /label: 'Responsable'/);
  assert.match(panel, /f\.asesor \?\? 'sin asignar'/);
});

test('la columna es solo para quien ve las de toda la firma', () => {
  // Al asesor todas las filas son suyas: sería una columna repitiendo su
  // nombre treinta veces.
  assert.match(panel, /data\.esCoordinacion \? \[\{/);
});

test('quien no es coordinación no puede reasignar', () => {
  // El control no se dibuja, y el backend además lo rechaza.
  assert.match(panel, /asesores=\{data\.esCoordinacion \? \(data\.asesores \?\? \[\]\) : null\}/);
  assert.match(panel, /\{asesores && <Responsable/);
});

test('el cambio es en dos pasos, no al soltar un desplegable', () => {
  // Rozar una lista le quitaría trabajo medido a una persona.
  assert.match(panel, /disabled=\{!cambia \|\| trabajando\}/);
  assert.match(panel, /const cambia = !!elegido && elegido !== f\.asesorId;/);
});

test('la elección a medias no se arrastra a la siguiente obligación', () => {
  // Sería el candidato perfecto para reasignar el impuesto equivocado.
  assert.match(panel, /useEffect\(\(\) => \{ setElegido\(''\); \}, \[f\.id\]\);/);
});

test('no se ofrece pasarle la obligación a quien ya la tiene', () => {
  assert.match(panel, /asesores\.filter\(\(a\) => a\.id !== f\.asesorId\)/);
});

test('dice que cambia una obligación y no el cliente entero', () => {
  // Sin decirlo, quien lo usa espera que el mes entrante también cambie.
  assert.match(panel, /solo esta obligación/);
  assert.match(panel, /vuelve\s*\n?\s*a ser del titular|vuelve a ser del titular/);
});

test('avisa que el cambio queda registrado', () => {
  assert.match(panel, /Queda registrado quién hizo el cambio|Queda el registro de quién lo movió/);
});
