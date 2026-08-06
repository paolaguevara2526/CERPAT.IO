// Tests del aislamiento del portal del cliente. Si alguna vez un cambio rompe el
// aislamiento entre clientes (p. ej. que un cliente vea "todas" las empresas),
// estos tests fallan. Runner nativo de Node + tsx (sin dependencias extra).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esFirma, resolverAlcance } from './alcance.js';

const firma = { esRoot: false, roles: ['Coordinador'], empresaCliente: null, grupoCliente: null };
const root = { esRoot: true, roles: [], empresaCliente: null, grupoCliente: null };
const clienteEmpresa = { esRoot: false, roles: ['Cliente'], empresaCliente: 'emp-A', grupoCliente: null };
const clienteGrupo = { esRoot: false, roles: ['Cliente'], empresaCliente: null, grupoCliente: 'grp-1' };
const sinVinculo = { esRoot: false, roles: [], empresaCliente: null, grupoCliente: null };

test('esFirma: personal interno sí, cliente no', () => {
  assert.equal(esFirma(firma), true);
  assert.equal(esFirma(root), true);
  assert.equal(esFirma(clienteEmpresa), false);
  assert.equal(esFirma(clienteGrupo), false);
  assert.equal(esFirma(sinVinculo), false);
  assert.equal(esFirma(null), false);
});

test('la firma ve TODAS las empresas', () => {
  assert.equal(resolverAlcance(firma, []), 'todas');
  assert.equal(resolverAlcance(root, []), 'todas');
});

test('cliente por empresa ve SOLO su empresa', () => {
  assert.deepEqual(resolverAlcance(clienteEmpresa, []), ['emp-A']);
});

test('cliente por grupo ve SOLO las empresas de su grupo', () => {
  assert.deepEqual(resolverAlcance(clienteGrupo, ['emp-A', 'emp-B']), ['emp-A', 'emp-B']);
});

test('un cliente NUNCA obtiene "todas" (blindaje anti-fuga)', () => {
  assert.notEqual(resolverAlcance(clienteEmpresa, []), 'todas');
  assert.notEqual(resolverAlcance(clienteGrupo, ['emp-A']), 'todas');
});

test('sin vínculo y sin sesión → sin acceso (null)', () => {
  assert.equal(resolverAlcance(sinVinculo, []), null);
  assert.equal(resolverAlcance(null, []), null);
  assert.equal(resolverAlcance(undefined, []), null);
});

test('el cliente por empresa ignora ids de grupo ajenos', () => {
  // Aunque llegue una lista de grupo, un cliente ligado a empresa solo ve la suya.
  assert.deepEqual(resolverAlcance(clienteEmpresa, ['emp-X', 'emp-Y']), ['emp-A']);
});
