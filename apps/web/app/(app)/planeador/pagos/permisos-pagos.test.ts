// Quién puede qué en Pagos.
//
// Coordinación lleva el seguimiento de cartera: es quien se entera de que hay
// una deuda vieja sin cargar y quien persigue el pago. Tenía el botón de abonos
// pero no el de "+ Agregar pago pendiente" ni el de guardar valor y estado, así
// que para cada deuda tenía que pedirle a Administración que la cargara.
//
// Lo llamativo es que el backend ya lo permitía: `PATCH /vencimientos/:id`
// acepta coordinación desde siempre. Solo la pantalla lo escondía — un permiso
// que existe pero no se ve es un permiso que no existe.
//
// El corte que SÍ se mantiene es otro: borrar. Eliminar un pago pendiente o un
// abono no corrige un dato, borra una deuda registrada de la que después nadie
// se acuerda. Eso sigue siendo del Administrador.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const pagina = readFileSync(join(AQUI, 'page.tsx'), 'utf8');

test('coordinación es Administrador, Coordinador o root', () => {
  assert.match(pagina, /const esCoordinacion = !!sesion && \(sesion\.esRoot \|\| sesion\.roles\.some\(\(r\) => \['Administrador', 'Coordinador'\]\.includes\(r\)\)\)/);
});

test('coordinación puede agregar un pago pendiente', () => {
  assert.match(pagina, /<PendientesManuales[^>]*editable=\{esCoordinacion\}/);
});

test('coordinación puede registrar el valor y el estado del pago', () => {
  // Poder cargar la deuda y no poder marcarla pagada deja el trabajo a medias:
  // hay que ir a pedir que la cierren.
  assert.match(pagina, /<VencimientoPagoEditor[^>]*editable=\{esCoordinacion\}/);
});

test('borrar sigue siendo del Administrador', () => {
  // Es el único corte que se mantiene, y por una razón distinta: no corrige un
  // dato, elimina una deuda registrada.
  assert.match(pagina, /const esEditor = !!sesion && \(sesion\.esRoot \|\| sesion\.roles\.includes\('Administrador'\)\)/);
  assert.match(pagina, /i\.manual && esEditor \? <BorrarPendiente/);
  assert.match(pagina, /<AbonosBoton[^>]*puedeEliminar=\{esEditor\}/);
});

test('la leyenda dice lo que el usuario puede hacer de verdad', () => {
  // Decirle "solo consulta" a quien sí puede marcar el pago lo manda a pedir
  // permiso que ya tiene.
  assert.match(pagina, /\{esCoordinacion \? '\(marca el pago\)'/);
});
