// Importar cifras desde Excel escribe activos e ingresos, y de ellos salen seis
// obligaciones. Una fila que casa con el cliente equivocado no rompe nada: deja
// al cliente A con las cifras de B y le calcula obligaciones que no le tocan.
// Estas pruebas fijan a quién se le puede escribir y a quién no.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexar, emparejar, montoDe, anioValido, type EmpresaIdx } from './importar-cifras.js';

const EMPRESAS: EmpresaIdx[] = [
  { id: 'e1', nombre: 'Acme Consultores SAS', nit: '900950136' },
  { id: 'e2', nombre: 'Agropecuaria la Dinastía SAS', nit: '901703310' },
  { id: 'e3', nombre: 'Ana Delia Piña Tobías', nit: '35477867' },
  { id: 'e4', nombre: 'César Andrés Guevara Salamanca', nit: '1006877717' },
];
const idx = indexar(EMPRESAS);

const casa = (nit: unknown, cliente?: unknown) => {
  const r = emparejar(idx, nit, cliente);
  return 'empresa' in r ? r.empresa.id : `ERROR: ${r.error}`;
};

test('empareja por NIT exacto', () => {
  assert.equal(casa('900950136'), 'e1');
});

test('el NIT puede venir con puntos, guiones y espacios', () => {
  assert.equal(casa('900.950.136'), 'e1');
  assert.equal(casa(' 900 950 136 '), 'e1');
  assert.equal(casa(900950136), 'e1');
});

test('acepta el dígito de verificación aunque la base no lo tenga', () => {
  // El RUT trae 900950136-1; la base guarda 900950136.
  assert.equal(casa('900950136-1'), 'e1');
});

test('una cédula NO se confunde con un NIT al que le sobra un dígito', () => {
  // Este es el caso que justifica todo el cuidado: 1006877717 es la cédula de
  // e4. Si se le quitara el último dígito "por si acaso" se buscaría 100687771,
  // y si algún día existiera ese NIT, las cifras entrarían en el cliente
  // equivocado. La coincidencia exacta tiene que ganar siempre.
  assert.equal(casa('1006877717'), 'e4');
});

test('sin coincidencia devuelve error, nunca un cliente aproximado', () => {
  const r = casa('999999999');
  assert.match(String(r), /^ERROR/);
});

test('un NIT ambiguo se rechaza en vez de elegir uno', () => {
  const dobles = indexar([
    { id: 'a', nombre: 'Uno SAS', nit: '900111222' },
    { id: 'b', nombre: 'Dos SAS', nit: '900111222' },
  ]);
  const r = emparejar(dobles, '900111222', '');
  assert.ok('error' in r && /repetido/.test(r.error));
});

test('sin NIT cae al nombre, sin tildes ni mayúsculas ni espacios de más', () => {
  assert.equal(casa('', 'agropecuaria  LA dinastia sas'), 'e2');
  assert.equal(casa('', 'Ana Delia Piña Tobías'), 'e3');
});

test('un nombre repetido se rechaza en vez de elegir uno', () => {
  const dobles = indexar([
    { id: 'a', nombre: 'Comercializadora SAS', nit: '900111222' },
    { id: 'b', nombre: 'Comercializadora SAS', nit: '900333444' },
  ]);
  const r = emparejar(dobles, '', 'Comercializadora SAS');
  assert.ok('error' in r && /repetido/.test(r.error));
});

test('el NIT manda sobre el nombre cuando ambos vienen', () => {
  // Fila con el NIT de Acme y el nombre de Dinastía: gana el NIT, que es el
  // identificador. Da igual cómo esté escrito el nombre en el archivo.
  assert.equal(casa('900950136', 'Agropecuaria la Dinastía SAS'), 'e1');
});

test('lee montos en los formatos que salen de Excel y de la DIAN', () => {
  assert.equal(montoDe(1234567), 1234567);
  assert.equal(montoDe('1.234.567'), 1234567);
  assert.equal(montoDe('$ 1.234.567'), 1234567);
  assert.equal(montoDe('1234567,50'), 1234567.5);
  assert.equal(montoDe(''), null);
  assert.equal(montoDe(null), null);
  assert.equal(montoDe(undefined), null);
});

test('un texto que no es número se marca inválido, nunca se toma como cero', () => {
  // Un 0 silencioso diría que el cliente no tiene activos ni ingresos, y eso lo
  // sacaría de obligaciones que sí le aplican.
  assert.equal(montoDe('n/a'), 'invalido');
  assert.equal(montoDe('pendiente'), 'invalido');
  assert.equal(montoDe('-500'), 'invalido');
  assert.equal(montoDe('1.2.3.4x'), 'invalido');
});

test('el año se valida antes de escribir nada', () => {
  assert.equal(anioValido(2025), 2025);
  assert.equal(anioValido('2025'), 2025);
  assert.equal(anioValido(1999), null);
  assert.equal(anioValido('el año pasado'), null);
  assert.equal(anioValido(2025.5), null);
});
