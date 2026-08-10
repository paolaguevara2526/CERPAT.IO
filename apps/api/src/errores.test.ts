// Traducir errores del servidor a algo accionable.
//
// El caso que originó esto: guardar el plan de un cliente fallaba y la pantalla
// solo decía "No se pudo guardar el plan". El motivo real se perdía, así que no
// había nada que arreglar — solo volver a intentarlo a ciegas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeDeError } from './errores.js';

test('una transacción cancelada dice que no se guardó nada', () => {
  const m = mensajeDeError({ code: 'P2028', message: 'Transaction already closed' });
  assert.match(m, /tardó demasiado/i);
  assert.match(m, /No se guardó nada/i);
});

test('el disco lleno se nombra, no se disfraza de error genérico', () => {
  // Es el más engañoso: leer sigue funcionando y solo fallan los guardados, así
  // que parece un problema de la pantalla y no de la base.
  const m = mensajeDeError(new Error('could not extend file: No space left on device'));
  assert.match(m, /sin espacio en disco/i);
});

test('los errores de conexión se distinguen de los de datos', () => {
  assert.match(mensajeDeError({ code: 'P1001' }), /no responde/i);
  assert.match(mensajeDeError({ code: 'P2002' }), /Ya existe/i);
  assert.match(mensajeDeError({ code: 'P2025' }), /ya no existe/i);
});

test('un error desconocido conserva el código, para poder buscarlo', () => {
  const m = mensajeDeError({ code: 'P9999' }, 'No se pudo guardar el plan.');
  assert.match(m, /No se pudo guardar el plan\./);
  assert.match(m, /P9999/);
});

test('sin código ni pistas, devuelve el mensaje por defecto que le den', () => {
  assert.equal(mensajeDeError(new Error('boom'), 'No se pudo guardar el plan.'), 'No se pudo guardar el plan.');
  assert.equal(mensajeDeError(null), 'No se pudo completar la operación.');
  assert.equal(mensajeDeError(undefined), 'No se pudo completar la operación.');
});

test('no se filtra el detalle interno del error al usuario', () => {
  // El texto crudo puede traer nombres de tablas, rutas y consultas. Va a los
  // registros del servidor, no a la pantalla.
  const crudo = 'Invalid `prisma.planClienteActividad.upsert()` invocation in /app/dist/routes/admin.js:812';
  assert.equal(mensajeDeError(new Error(crudo), 'No se pudo guardar el plan.'), 'No se pudo guardar el plan.');
});
