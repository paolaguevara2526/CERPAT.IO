// La vigencia del contrato en la ficha: desde, meses y hasta.
//
// La cuenta que relaciona los tres está probada en lib/contrato.ts. Lo que se
// cuida aquí es el CABLEADO, que es donde se pierde: que los campos nuevos
// viajen en el PATCH (si no, se escriben y no se guardan), y —sobre todo— que
// la propuesta automática de la fecha de terminación no pise una fecha ya
// guardada. Una prórroga puede terminar donde no cuadra con la aritmética, y
// si el sistema la corrige solo, el dato del papel se pierde sin que nadie lo
// note.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(join(AQUI, 'FichaCliente.tsx'), 'utf8');

test('los campos de vigencia viajan al servidor', () => {
  // Sin esto el usuario los escribe, ve el "Guardado" y al recargar no están.
  assert.match(fuente, /mesesContrato: f\.mesesContrato/);
  assert.match(fuente, /contratoHasta: soloFecha\(f\.contratoHasta\)/);
  assert.match(fuente, /contratoDesde: soloFecha\(f\.contratoDesde\)/);
});

test('la fecha de terminación solo se propone si está vacía', () => {
  const propuesta = /const propuesta = ([^;]+);/.exec(fuente)?.[1];
  assert.ok(propuesta, 'ya no se propone la fecha de terminación: ¿cambió de forma?');
  assert.match(propuesta, /!soloFecha\(f\.contratoHasta\)/,
    'la propuesta pisaría una fecha ya guardada, que puede ser una prórroga');
});

test('la propuesta no borra la fecha guardada cuando no aplica', () => {
  // El spread condicional es el que evita escribir `contratoHasta: null` en el
  // caso en que la propuesta no se calcula.
  assert.match(fuente, /\.\.\.\(propuesta \? \{ contratoHasta: propuesta \} : \{\}\)/);
});

test('la discrepancia se avisa, no se corrige', () => {
  assert.match(fuente, /fechasCoherentes\(/);
  assert.match(fuente, /Si es una prórroga, déjala como está/);
  // Y en ningún lado se fuerza la fecha guardada a la calculada.
  assert.doesNotMatch(fuente, /set\('contratoHasta', calculada/);
});

test('el estado del contrato se calcula contra el día local', () => {
  // toISOString() daría el día siguiente después de las 7 p.m. en Colombia, y
  // un contrato aparecería vencido una tarde antes de tiempo.
  assert.match(fuente, /estadoContrato\(hasta, hoyISO\(\)\)/);
  assert.doesNotMatch(fuente, /toISOString\(\)\.slice\(0, 10\)/);
});
