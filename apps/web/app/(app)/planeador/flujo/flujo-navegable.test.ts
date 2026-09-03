// El Flujo del cierre tiene que tener salida.
//
// La pantalla diagnostica bien —"64 clientes detenidos en Captura"— y ahí se
// acababa: no se podía hacer clic en nada. Un diagnóstico sin siguiente paso
// asusta y no deja hacer nada con el dato, y quien lo mira concluye,
// razonablemente, que la pantalla está incompleta o dañada.
//
// Y la etapa de Entrega decía "Entregado" a secas. Eso hacía ver que la cadena
// avanzó sola cuando en agosto lo que hubo fue un "Liberar período" en bloque
// con la captura sin terminar: dos situaciones muy distintas leídas igual.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(join(AQUI, 'page.tsx'), 'utf8');

test('el nombre del cliente entra a sus tareas del mes', () => {
  assert.match(fuente, /href=\{urlLista\(\{ periodo: data\?\.periodo, empresaId: c\.empresaId \}\)\}/);
});

test('cada etapa entra a sus tareas, filtradas por fase', () => {
  for (const fase of ['captura', 'procesamiento', 'revision']) {
    assert.match(fuente, new RegExp(`fase: '${fase}'`), `la etapa ${fase} no lleva a ninguna parte`);
  }
});

test('una etapa sin tareas no se enlaza', () => {
  // Un enlace que abre una lista vacía enseña a desconfiar de los demás.
  assert.match(fuente, /href=\{c\.etapas\.captura\.total \? urlLista\(/);
  assert.match(fuente, /if \(!href\) return <div style=\{caja\}/);
});

test('el cuello del período lleva a los clientes detenidos', () => {
  assert.match(fuente, /titulo="Cuello del período"[\s\S]{0,400}href=\{r\?\.cuello/);
});

test('el enlace conserva el mes que se está viendo', () => {
  // Sin esto, entrar desde agosto abría la lista de septiembre — y el error no
  // se nota: la lista se ve normal, solo que es de otro mes.
  assert.match(fuente, /function urlLista[\s\S]{0,400}q\.set\('periodo', p\.periodo\)/);
});

test('la entrega dice CÓMO llegó el insumo, no solo que llegó', () => {
  assert.match(fuente, /ORIGEN_LABEL/);
  assert.match(fuente, /manual: 'liberado a mano'/);
  assert.match(fuente, /nota=\{c\.etapas\.entrega\.origen/);
});

test('la pantalla dice para qué sirve y que se puede entrar', () => {
  assert.match(fuente, /diagnostica, no se trabaja/);
  assert.match(fuente, /haz clic en el cliente o en cualquier etapa/);
});
