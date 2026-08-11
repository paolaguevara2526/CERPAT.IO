// Tests del aislamiento del portal del cliente. Si alguna vez un cambio rompe el
// aislamiento entre clientes (p. ej. que un cliente vea "todas" las empresas),
// estos tests fallan. Runner nativo de Node + tsx (sin dependencias extra).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esFirma, resolverAlcance, esStaffAcotado } from './alcance.js';

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

// --- esStaffAcotado: Asesor/Auxiliar sin rol elevado ven SOLO lo suyo ---
test('Asesor y Auxiliar (sin rol elevado) tienen vista acotada', () => {
  assert.equal(esStaffAcotado({ esRoot: false, roles: ['Asesor'], empresaCliente: null, grupoCliente: null }), true);
  assert.equal(esStaffAcotado({ esRoot: false, roles: ['Auxiliar'], empresaCliente: null, grupoCliente: null }), true);
});

test('un rol elevado o root NO es acotado (ve todo)', () => {
  assert.equal(esStaffAcotado({ esRoot: false, roles: ['Coordinador'], empresaCliente: null, grupoCliente: null }), false);
  assert.equal(esStaffAcotado({ esRoot: false, roles: ['Auditor'], empresaCliente: null, grupoCliente: null }), false);
  assert.equal(esStaffAcotado({ esRoot: false, roles: ['Administrador'], empresaCliente: null, grupoCliente: null }), false);
  assert.equal(esStaffAcotado(root), false);
  // Asesor que además es Coordinador: gana el rol elevado (ve todo).
  assert.equal(esStaffAcotado({ esRoot: false, roles: ['Asesor', 'Coordinador'], empresaCliente: null, grupoCliente: null }), false);
});

test('un cliente externo no es staff acotado', () => {
  assert.equal(esStaffAcotado(clienteEmpresa), false);
  assert.equal(esStaffAcotado(clienteGrupo), false);
  assert.equal(esStaffAcotado(null), false);
});

test('esStaffAcotado: acota a todo interno sin rol elevado', () => {
  const con = (roles: string[]) => ({ esRoot: false, roles, empresaCliente: null, grupoCliente: null });
  assert.equal(esStaffAcotado(con(['Asesor'])), true);
  assert.equal(esStaffAcotado(con(['Auxiliar'])), true);
  // Elevados y root ven toda la firma.
  for (const r of ['Administrador', 'Coordinador', 'Auditor']) assert.equal(esStaffAcotado(con([r])), false, r);
  assert.equal(esStaffAcotado(root), false);
  // Un rol elevado combinado con uno acotado manda el elevado.
  assert.equal(esStaffAcotado(con(['Asesor', 'Coordinador'])), false);
});

test('esStaffAcotado falla CERRADO ante roles que no conoce', () => {
  // Antes terminaba en roles.some(['Asesor','Auxiliar']) y devolvía false para
  // cualquier otra cosa: un Revisor, alguien con el rol mal puesto o un usuario
  // recién creado sin roles pasaban por "no acotado" y veían la cartera entera
  // de la firma. El peor caso debe ser "no ve lo que sí debe", no al revés.
  const con = (roles: string[]) => ({ esRoot: false, roles, empresaCliente: null, grupoCliente: null });
  assert.equal(esStaffAcotado(con(['Revisor'])), true);
  assert.equal(esStaffAcotado(con([])), true);
  assert.equal(esStaffAcotado(con(['RolQueNoExiste'])), true);
});

test('esStaffAcotado no aplica a clientes externos (se acotan por otro camino)', () => {
  assert.equal(esStaffAcotado(clienteEmpresa), false);
  assert.equal(esStaffAcotado(clienteGrupo), false);
  assert.equal(esStaffAcotado(null), false);
});
