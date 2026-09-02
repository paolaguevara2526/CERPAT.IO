// Qué se lleva el botón "Exportar a Excel" de Vencimientos.
//
// La lista está PAGINADA (100 por página) y tiene filtros por columna. Son tres
// conjuntos distintos: `items` (el año), `filtrados` (lo que pasa los filtros) y
// `enPantalla` (la página). Bajar el equivocado no falla ni avisa: el archivo se
// abre, tiene filas, y alguien trabaja sobre él creyendo que está completo.
//
// Lo correcto es `filtrados`: quien acaba de filtrar por un cliente espera ese
// recorte, no las 3.138 filas del año ni las 100 de la página.
//
// Se revisa sobre la fuente, como grilla.test.ts y filtros.test.ts del
// calendario: lo que se quiere fijar es el cableado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(join(AQUI, 'VencimientosView.tsx'), 'utf8');

const cuerpoExportar = /async function exportar\(\) \{([\s\S]*?)\n  \}/.exec(fuente)?.[1] ?? '';

test('existe la función que exporta', () => {
  assert.ok(cuerpoExportar, 'no se encontró `async function exportar()`: ¿cambió de nombre?');
});

test('exporta lo FILTRADO, no la página ni el año completo', () => {
  assert.match(cuerpoExportar, /filtrados\.map/, 'el archivo no se arma con `filtrados`');
  assert.doesNotMatch(cuerpoExportar, /enPantalla/, 'estaría bajando solo la página visible (100 filas)');
  assert.doesNotMatch(cuerpoExportar, /items\.map/, 'estaría bajando el año completo, ignorando los filtros');
});

test('el botón dice cuántas filas va a bajar', () => {
  // Es lo único que hace evidente, ANTES de abrir el archivo, que se baja el
  // recorte y no todo. Sin el número, la diferencia se descubre demasiado tarde.
  assert.match(fuente, /Exportar a Excel \(\$\{filtrados\.length\}\)/);
});

test('la fecha va como Date, no como texto', () => {
  // Con la fecha formateada, la columna "Vence" del archivo no ordena ni filtra
  // por rango — que es lo primero que se hace con este listado.
  assert.match(fuente, /valor: \(v\) => diaComoFecha\(v\.fechaVencimiento\)/);
  assert.doesNotMatch(fuente, /valor: \(v\) => fmtFecha\(/, 'la fecha del Excel no puede ir formateada');
});

test('el archivo lleva las columnas que la tabla no muestra', () => {
  // Municipio, responsable, valor y soporte no caben en pantalla, pero fuera de
  // la aplicación son por las que se reparte y se revisa el trabajo.
  for (const label of ['Compañía', 'Obligación', 'Período', 'Municipio', 'Vence', 'Estado', 'Responsable', 'Valor a pagar', 'Notas', 'Soporte']) {
    assert.match(fuente, new RegExp(`label: '${label}'`), `falta la columna "${label}"`);
  }
});
