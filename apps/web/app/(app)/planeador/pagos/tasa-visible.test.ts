// La tasa con la que se liquida tiene que verse.
//
// El caso real: se entra a septiembre y no hay dónde poner la tasa del mes...
// salvo que sí la hay (Administración → Parámetros), solo que nada en Pagos
// decía con qué tasa se estaba calculando ni de cuándo era. Una tasa vieja no
// se ve vieja: el número sigue ahí, la pantalla sigue sumando, y el interés se
// le cobra al cliente liquidado con la tasa del mes pasado.
//
// Estas pruebas cuidan las dos mitades: que el número diga con qué se calculó, y
// que la pantalla avise cuando eso ya no es lo vigente.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const pagos = readFileSync(join(AQUI, 'page.tsx'), 'utf8');
const admin = readFileSync(join(AQUI, '../../administracion/AdminPanel.tsx'), 'utf8');

test('el interés dice con qué tasa y de qué mes se calculó', () => {
  assert.match(pagos, /tasa \$\{\(tasa\.tasaAnual \* 100\)/);
  assert.match(pagos, /sin mes registrado/);
});

test('Pagos avisa cuando la tasa no es la del mes en curso', () => {
  // Quien mira Pagos es quien va a cobrar ese interés: el aviso no puede vivir
  // solo en Administración.
  assert.match(pagos, /tasa && !tasa\.alDia && tasa\.aviso/);
  assert.match(pagos, /Se cambia en Administración → Parámetros/);
});

test('la pantalla no promete que la tasa se actualice sola', () => {
  // Lo que se recalcula solo son los DÍAS de mora. Decir "se actualiza solo" a
  // secas es justo lo que hace que nadie vaya a cargar la tasa nueva.
  assert.ok(!/El interés de mora se calcula a hoy y se actualiza solo\./.test(pagos));
  assert.match(pagos, /la publica la DIAN cada mes/);
});

test('Parámetros muestra el estado de la tasa cargada', () => {
  assert.match(admin, /tasa && !tasa\.alDia && tasa\.aviso/);
  assert.match(admin, /Tasa de mora cargada para \{tasa\.mes\}/);
});

test('guardar la tasa refresca el aviso en el momento', () => {
  // Si el aviso siguiera puesto después de corregirla, se leería como que no
  // guardó — y se guardaría otra vez.
  assert.match(admin, /setTasa\(data\.tasaMora \?\? null\); setOk\(true\)/);
});
