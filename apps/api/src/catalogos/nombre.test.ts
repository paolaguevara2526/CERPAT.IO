// Cuándo dos nombres de catálogo son el mismo.
//
// El caso real: el desplegable de servicios del formulario de clientes mostraba
// "Asesoria Contable" y "Asesoría Contable", y "Outsourcing contable" y
// "Outsourcing Contable". Se sembraron desde el texto libre viejo, tal como
// estaban escritos, y el índice único de la base —que compara texto exacto— los
// dejó pasar a todos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveNombre, mismoNombre, duplicadoDe } from './nombre.js';

test('la tilde no hace un servicio distinto', () => {
  assert.ok(mismoNombre('Asesoría Contable', 'Asesoria Contable'));
  assert.ok(mismoNombre('Auditoría Externa', 'Auditoria externa'));
});

test('la mayúscula tampoco', () => {
  assert.ok(mismoNombre('Outsourcing Contable', 'Outsourcing contable'));
  assert.ok(mismoNombre('OCASIONAL', 'Ocasional'));
});

test('ni los espacios de más', () => {
  assert.ok(mismoNombre('Revisoria  Contable', 'Revisoria Contable'));
  assert.ok(mismoNombre('  Asesoría ', 'Asesoría'));
});

test('pero servicios de verdad distintos siguen distintos', () => {
  // Esto es lo que impide que la limpieza se lleve por delante datos buenos:
  // "Asesoría" y "Asesoría Contable" NO son el mismo servicio, ni "Outsourcing"
  // y "Outsourcing Contable".
  assert.equal(mismoNombre('Asesoría', 'Asesoría Contable'), false);
  assert.equal(mismoNombre('Outsourcing', 'Outsourcing Contable'), false);
  assert.equal(mismoNombre('Revisoría Contable', 'Asesoría Contable'), false);
});

test('la clave normaliza pero no es lo que se guarda', () => {
  // El nombre se guarda como lo escribió la firma; la clave solo sirve para
  // comparar.
  assert.equal(claveNombre('Asesoría Contable'), 'asesoria contable');
  assert.equal(claveNombre('Diseño'), 'diseno');
});

const CAT = [
  { id: 'a', nombre: 'Asesoría' },
  { id: 'b', nombre: 'Asesoría Contable' },
  { id: 'c', nombre: 'Outsourcing' },
];

test('se detecta la variante antes de crearla', () => {
  assert.equal(duplicadoDe('asesoria contable', CAT)?.id, 'b');
  assert.equal(duplicadoDe('OUTSOURCING', CAT)?.id, 'c');
  assert.equal(duplicadoDe('Auditoría Externa', CAT), null);
});

test('un elemento no es duplicado de sí mismo', () => {
  // Sin esto no se le podría corregir la tilde a una opción ya guardada: el
  // catálogo quedaría con la falta de ortografía para siempre.
  assert.equal(duplicadoDe('Asesoria Contable', CAT, 'b'), null);
  assert.equal(duplicadoDe('Asesoría', CAT, 'b')?.id, 'a', 'sigue chocando con las demás');
});
