// El caso real que llevó a esto: a Jonathan le aparecía "Ana Delia Piña ·
// Impuestos" en su bandeja, y en Plan por cliente esa área figuraba a nombre de
// Edinson Caicedo. Se cambió la asignación, se guardó, y a Jonathan le siguió
// apareciendo.
//
// La bandeja solo lista un área si uno es su asesor o su auxiliar, así que el
// dato no podía estar diciendo dos cosas a la vez: se estaban mirando DOS FILAS
// distintas. Dos fichas del mismo cliente hacen exactamente eso, y el
// desplegable las muestra idénticas.
//
// Estas pruebas cuidan que la pantalla no vuelva a esconder ninguna de las dos
// piezas: el aviso de que hay fichas repetidas, y la etiqueta que las separa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => readFileSync(join(AQUI, rel), 'utf8');
const editor = leer('PlanClienteEditor.tsx');
const panel = leer('ClientesDuplicados.tsx');

test('el desplegable de clientes no ofrece dos opciones idénticas', () => {
  assert.match(editor, /etiquetasUnicas\(empresas\)/);
  assert.match(editor, /\{etiquetas\.get\(e\.id\) \?\? e\.nombre\}/);
});

test('la ficha repetida se avisa en la misma pantalla donde estorba', () => {
  // Enterrado en otra sección no se ve nunca: el error se comete aquí, al
  // elegir el cliente.
  assert.match(editor, /<ClientesDuplicados onIr=/);
});

test('cada ficha muestra qué le cuelga, que es lo que decide cuál se queda', () => {
  // Sin las áreas y los conteos, el panel dice "hay un duplicado" y deja a
  // quien lo lee sin manera de resolverlo.
  for (const campo of ['f.areas', 'f.tareas', 'f.vencimientos', 'f.pagos']) {
    assert.ok(panel.includes(campo), `el panel no muestra ${campo}`);
  }
});

test('el panel dice qué hacer, no solo que hay un problema', () => {
  assert.match(panel, /Para unificar/);
  assert.match(panel, /no se mueven solos/);
});

test('el panel se calla cuando no hay duplicados', () => {
  // Un diagnóstico permanente en pantalla se vuelve parte del decorado.
  assert.match(panel, /if \(!cargado \|\| grupos\.length === 0\) return null;/);
});

test('no fusiona clientes por su cuenta', () => {
  // Unir dos clientes tiene consecuencias contables; el panel informa y la
  // decisión la toma una persona.
  assert.ok(!/fetch\([^)]*fusionar/.test(panel), 'el panel no debe fusionar fichas solo');
});
