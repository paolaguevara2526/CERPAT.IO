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

// ---- Seguimiento por persona ----
//
// El tablero mostraba clientes y etapas, y nunca una persona. Con 67 filas
// idénticas, la pregunta que sigue a "65 detenidos en captura" es "¿de quién
// son?", y no estaba en pantalla. La firma se coordina con personas.

test('cada fila dice quién responde, separando asesor de auxiliar', () => {
  // El auxiliar es quien EJECUTA la captura, que es donde se atasca el cierre:
  // decir solo el asesor manda a preguntarle a quien no lo está haciendo.
  assert.match(fuente, /<PersonasCelda etiqueta="Asesor"/);
  assert.match(fuente, /<PersonasCelda etiqueta="Auxiliar"/);
  assert.match(fuente, /sin asignar/);
});

test('el tablero se puede acotar a una persona o a un cliente', () => {
  assert.match(fuente, /name="persona"/);
  assert.match(fuente, /name="q"/);
  assert.match(fuente, /!persona \|\| gente\(c\)\.some\(\(u\) => u\.id === persona\)/);
});

test('el desplegable solo ofrece gente con clientes en el período', () => {
  // Escoger a alguien sin nada este mes daría una lista vacía sin explicación.
  assert.match(fuente, /const personas = Array\.from\(new Map\(todos\.flatMap\(gente\)/);
});

test('"sin plan" y "el filtro no encontró nada" se dicen distinto', () => {
  // Decirlos igual manda a generar un plan que ya existe.
  assert.match(fuente, /todos\.length === 0 \?/);
  assert.match(fuente, /Ningún cliente coincide con el filtro/);
});

test('filtrar no devuelve al mes en curso', () => {
  assert.match(fuente, /<input type="hidden" name="periodo" value=\{searchParams\?\.periodo \?\? ''\} \/>/);
});
