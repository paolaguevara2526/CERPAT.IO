// Registrar abonos era solo del Administrador; la dirección lo abrió a Asesor y
// Coordinador. Estas pruebas fijan las dos mitades del permiso: QUIÉN puede
// abonar y SOBRE CUÁLES obligaciones. La segunda importa igual que la primera:
// sin ella un asesor podría abonar contra cualquier obligación de la firma
// mandando un id, aunque en pantalla solo vea las suyas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeRegistrarAbono, puedeEliminarAbono, abonoEnAlcance } from './abonos.js';

const u = (roles: string[], extra: Record<string, unknown> = {}) => ({ esRoot: false, roles, sub: 'u1', ...extra });

// ---- Quién registra ----

test('Asesor y Coordinador ya registran abonos', () => {
  assert.equal(puedeRegistrarAbono(u(['Asesor'])), true);
  assert.equal(puedeRegistrarAbono(u(['Coordinador'])), true);
});

test('Administrador y root siguen pudiendo', () => {
  assert.equal(puedeRegistrarAbono(u(['Administrador'])), true);
  assert.equal(puedeRegistrarAbono({ esRoot: true, roles: [], sub: 'r' }), true);
});

test('los demás roles no registran abonos', () => {
  // Falla cerrado: quien no está en la lista, no abona. Un abono mueve el saldo,
  // el interés de mora, la sanción y —al llegar a cero— el estado de la
  // obligación; no es un campo más.
  assert.equal(puedeRegistrarAbono(u(['Auxiliar'])), false);
  assert.equal(puedeRegistrarAbono(u(['Auditor'])), false);
  assert.equal(puedeRegistrarAbono(u(['Revisor'])), false);
  assert.equal(puedeRegistrarAbono(u([])), false);
  assert.equal(puedeRegistrarAbono(u(['RolInventado'])), false);
  assert.equal(puedeRegistrarAbono(null), false);
});

test('un cliente del portal nunca abona, tenga el rol que tenga', () => {
  assert.equal(puedeRegistrarAbono(u(['Asesor'], { empresaCliente: 'emp-1' })), false);
  assert.equal(puedeRegistrarAbono(u(['Administrador'], { grupoCliente: 'gr-1' })), false);
});

// ---- Quién elimina ----

test('eliminar un abono NO se abrió: sigue en Administración', () => {
  // Registrar suma información; borrar la desaparece, junto con el rastro de una
  // plata que alguien reportó.
  assert.equal(puedeEliminarAbono(u(['Asesor'])), false);
  assert.equal(puedeEliminarAbono(u(['Coordinador'])), false);
  assert.equal(puedeEliminarAbono(u(['Administrador'])), true);
  assert.equal(puedeEliminarAbono({ esRoot: true, roles: [], sub: 'r' }), true);
});

// ---- Sobre cuáles ----

const VENC = { empresaId: 'emp-1', asesorId: 'asesor-9', auxiliarId: null };

test('quien ve toda la firma abona sobre cualquier obligación', () => {
  assert.equal(abonoEnAlcance(null, 'quien-sea', VENC), true);
});

test('el staff acotado abona sobre sus empresas asignadas', () => {
  assert.equal(abonoEnAlcance(['emp-1'], 'u1', VENC), true);
  assert.equal(abonoEnAlcance(['emp-2'], 'u1', VENC), false);
});

test('y sobre lo que está a su nombre aunque falte la asignación', () => {
  // Misma regla que el calendario (alcance-lista.ts): leer y escribir con el
  // mismo criterio evita ver algo que no se puede tocar, y al revés.
  assert.equal(abonoEnAlcance([], 'asesor-9', VENC), true);
  assert.equal(abonoEnAlcance([], 'aux-3', { ...VENC, auxiliarId: 'aux-3' }), true);
});

test('no abona sobre la obligación de otro', () => {
  assert.equal(abonoEnAlcance([], 'ajeno', VENC), false);
  assert.equal(abonoEnAlcance(['emp-9'], 'ajeno', VENC), false);
});
