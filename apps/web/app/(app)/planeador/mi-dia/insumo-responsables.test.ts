// Cada fila tiene que decir POR QUÉ te aparece.
//
// El caso real: a Jonathan le salía "Ana Delia Piña · Impuestos" en su bandeja,
// y en Plan por cliente esa área figuraba a nombre de otro asesor. La bandeja
// lista las áreas donde uno es asesor **o** auxiliar — así que aparecer ahí es
// correcto si uno es el auxiliar. Pero la tabla no mostraba ni al asesor ni al
// auxiliar, así que no había manera de saberlo mirando: se leía como un error
// de asignación, y llevó a buscar un problema donde no lo había.
//
// El API ya mandaba los dos nombres. Solo faltaba mostrarlos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(AQUI, 'InsumoDelCliente.tsx'), 'utf8');

test('la fila dice quién es el asesor y quién el auxiliar', () => {
  assert.match(panel, /label: 'Responsables'/);
  assert.match(panel, /asesor: string \| null; auxiliar: string \| null;/);
});

test('los dos roles se distinguen, no se mezclan en un solo nombre', () => {
  // Decir solo "Ana Delia Piña · Jonathan" no responde nada: la pregunta es en
  // calidad de qué aparece.
  assert.match(panel, />Asesor <\/span>/);
  assert.match(panel, />Auxiliar <\/span>/);
});

test('un área sin asesor se marca en vez de quedar en blanco', () => {
  // Un espacio vacío se lee como "no cargó"; "sin asignar" es un dato.
  assert.match(panel, /sin asignar/);
});

test('el panel explica el criterio por el que lista', () => {
  assert.match(panel, /eres asesor o auxiliar de esa área/);
});

test('a quien ve TODA la firma no se le dice que son sus áreas', () => {
  // Coordinación no se filtra por asignación: ve la lista completa. Con el
  // mismo texto para los dos, ver ahí un cliente ajeno se lee como un error de
  // asignación y se sale a corregir algo que está bien.
  assert.match(panel, /data\.esCoordinacion/);
  assert.match(panel, /TODA la firma/);
});
