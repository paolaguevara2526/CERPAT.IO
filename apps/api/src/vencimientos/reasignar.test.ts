import { test } from 'node:test';
import assert from 'node:assert/strict';

import { candidatosParaLiquidar, cambioDeAsesor, rastroDeReasignacion } from './reasignar.js';

const P = (id: string, nombre: string, roles: string[], activo = true) => ({ id, nombre, roles, activo });

test('solo se ofrece a quien puede liquidar', () => {
  // Un auxiliar en la casilla del asesor no falla al guardarse: falla cuando le
  // aparece una declaración que no le toca hacer.
  const c = candidatosParaLiquidar([
    P('1', 'Nicolás', ['Asesor']),
    P('2', 'Karen', ['Auxiliar']),
    P('3', 'Paola', ['Administrador']),
    P('4', 'Rita', ['Revisor']),
  ]);
  assert.deepEqual(c.map((x) => x.nombre), ['Nicolás', 'Paola']);
});

test('quien ya no está en la firma no se ofrece', () => {
  const c = candidatosParaLiquidar([P('1', 'Nicolás', ['Asesor']), P('2', 'Exasesor', ['Asesor'], false)]);
  assert.deepEqual(c.map((x) => x.nombre), ['Nicolás']);
});

test('la lista sale ordenada, con los acentos en su sitio', () => {
  // No en el orden en que los devuelva la base: en una lista de personas eso se
  // lee como desordenada y hay que recorrerla entera para encontrar a alguien.
  const c = candidatosParaLiquidar([P('1', 'Zulma', ['Asesor']), P('2', 'Ángela', ['Asesor']), P('3', 'Beto', ['Asesor'])]);
  assert.deepEqual(c.map((x) => x.nombre), ['Ángela', 'Beto', 'Zulma']);
});

test('guardar el mismo responsable no es un cambio', () => {
  // Dejaría en el rastro una reasignación que nunca pasó.
  const r = cambioDeAsesor('u1', 'u1');
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /ya está a nombre/);
});

test('hay que elegir a alguien: no se deja sin responsable', () => {
  // Una obligación sin dueño no le aparece a nadie y llega vencida.
  for (const v of ['', '   ', null, undefined, 42]) {
    assert.equal(cambioDeAsesor('u1', v).ok, false);
  }
});

test('un cambio real pasa, con el id limpio', () => {
  const r = cambioDeAsesor('u1', ' u2 ');
  assert.deepEqual(r, { ok: true, asesorId: 'u2' });
});

test('se puede asignar una obligación que estaba huérfana', () => {
  assert.deepEqual(cambioDeAsesor(null, 'u2'), { ok: true, asesorId: 'u2' });
});

test('el rastro nombra a los dos lados', () => {
  // "Quedó en Nicolás" no permite auditar nada si no se sabe de quién salió.
  assert.equal(rastroDeReasignacion('Edinson', 'Nicolás'), 'Responsable: Edinson → Nicolás');
  assert.equal(rastroDeReasignacion(null, 'Nicolás'), 'Responsable: sin asignar → Nicolás');
});
