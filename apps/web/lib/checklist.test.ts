// Lo que se prueba aquí es una medición, no una pantalla: de estos números sale
// si una empresa "cumplió" el mes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progresoChecklist, etiquetaProgreso, siguienteEstado } from './checklist';

const subs = (...estados: string[]) => estados.map((estado) => ({ estado }));

test('lo que no aplica sale del denominador', () => {
  // El caso que motivó todo: empresa sin movimiento, 2 puntos de 13 que sí
  // aplicaban, ambos hechos. Antes se veía 2/13 y parecía incumplimiento.
  const p = progresoChecklist(subs('realizada', 'realizada', ...Array(11).fill('no_aplica')));
  assert.equal(p.hechas, 2);
  assert.equal(p.aplicables, 2);
  assert.equal(p.total, 13);
  assert.equal(p.pct, 100);
  assert.equal(p.completo, true);
});

test('la empresa con operación completa se mide contra los 13', () => {
  const p = progresoChecklist(subs(...Array(10).fill('realizada'), ...Array(3).fill('pendiente')));
  assert.equal(p.aplicables, 13);
  assert.equal(p.pct, 77);
  assert.equal(p.completo, false);
});

test('un checklist entero "no aplica" está completo, no en cero', () => {
  // Devolver 0 % lo mostraría como incumplido, que es el error que esto corrige.
  const p = progresoChecklist(subs('no_aplica', 'no_aplica'));
  assert.equal(p.pct, 100);
  assert.equal(p.completo, true);
});

test('un checklist vacío no rompe ni inventa cumplimiento', () => {
  const p = progresoChecklist([]);
  assert.equal(p.pct, 0);
  assert.equal(p.total, 0);
});

test('"no realizada" sí cuenta como pendiente, no se esconde', () => {
  // Distinto de "no aplica": aquí había que hacerlo y no se hizo. Sacarlo del
  // denominador sería premiar el incumplimiento.
  const p = progresoChecklist(subs('realizada', 'no_realizada'));
  assert.equal(p.aplicables, 2);
  assert.equal(p.hechas, 1);
  assert.equal(p.completo, false);
});

test('la etiqueta avisa cuándo el total cambió', () => {
  assert.equal(etiquetaProgreso(progresoChecklist(subs('realizada', 'pendiente'))), '1/2');
  // Con "no aplica" se muestra el detalle: si solo dijera 2/2, nadie sabría por
  // qué el checklist de 13 puntos aparece con 2.
  assert.equal(etiquetaProgreso(progresoChecklist(subs('realizada', 'realizada', 'no_aplica'))), '2/2 · 1 n/a');
});

test('el ciclo del clic da la vuelta completa', () => {
  assert.equal(siguienteEstado('pendiente'), 'realizada');
  assert.equal(siguienteEstado('realizada'), 'no_aplica');
  assert.equal(siguienteEstado('no_aplica'), 'pendiente');
  // El caso de todos los días —marcar hecho— sigue siendo un solo clic.
  assert.equal(siguienteEstado('no_realizada'), 'pendiente');
  assert.equal(siguienteEstado('lo_que_sea'), 'realizada');
});
