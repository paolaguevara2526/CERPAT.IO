// El rol Auditor veía la cola de Auditoría y no podía aprobar nada: la pantalla
// se le abría y el botón devolvía un 403. Estas pruebas fijan quién audita.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeAuditar } from './auditoria.js';

const TAREA = { asesorId: 'asesor-1' };
const u = (roles: string[], sub = 'otro') => ({ esRoot: false, roles, sub });

test('el Auditor puede auditar: era el error reportado', () => {
  assert.equal(puedeAuditar(u(['Auditor']), TAREA), true);
});

test('Administrador y Coordinador también, por su cargo', () => {
  assert.equal(puedeAuditar(u(['Administrador']), TAREA), true);
  assert.equal(puedeAuditar(u(['Coordinador']), TAREA), true);
  assert.equal(puedeAuditar({ esRoot: true, roles: [], sub: 'x' }, TAREA), true);
});

test('el asesor de la tarea aprueba lo de sus auxiliares', () => {
  assert.equal(puedeAuditar(u(['Asesor'], 'asesor-1'), TAREA), true);
});

test('un asesor ajeno no audita la tarea de otro', () => {
  assert.equal(puedeAuditar(u(['Asesor'], 'asesor-2'), TAREA), false);
});

test('el auxiliar no audita su propio trabajo', () => {
  // Es la razón de ser del paso: si el que ejecuta pudiera aprobar, la auditoría
  // sería un trámite.
  assert.equal(puedeAuditar(u(['Auxiliar'], 'aux-9'), TAREA), false);
});

test('sin usuario, no', () => {
  assert.equal(puedeAuditar(null, TAREA), false);
  assert.equal(puedeAuditar(undefined, TAREA), false);
});

test('un rol nuevo no hereda permiso de auditar', () => {
  // Falla cerrado: quien no está en la lista, no audita. El Revisor revisa
  // impuestos, que es otro circuito.
  assert.equal(puedeAuditar(u(['Revisor']), TAREA), false);
  assert.equal(puedeAuditar(u([]), TAREA), false);
  assert.equal(puedeAuditar(u(['RolInventado']), TAREA), false);
});

test('una tarea sin asesor no la audita cualquiera', () => {
  assert.equal(puedeAuditar(u(['Asesor'], 'asesor-1'), { asesorId: null }), false);
  assert.equal(puedeAuditar(u(['Auditor']), { asesorId: null }), true, 'el Auditor sí, por su cargo');
});
