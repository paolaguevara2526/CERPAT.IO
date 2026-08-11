// Un auxiliar reportó que lo capturado hoy quedaba con la fecha de ayer. No era
// un error de digitación: la fecha se guardaba y se leía como si fuera un
// instante, y entre Colombia (UTC−5) y UTC hay cinco horas que se comían un día.
//
// Estas pruebas fijan la regla: el día que se escribe es el día que se guarda.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaDeCaptura } from './dia-captura.js';

test('guarda el día que se escribió, a medianoche UTC', () => {
  assert.equal(diaDeCaptura('2026-08-11').toISOString(), '2026-08-11T00:00:00.000Z');
  assert.equal(diaDeCaptura('2026-01-01').toISOString(), '2026-01-01T00:00:00.000Z');
});

test('una captura de la noche colombiana NO se pasa al día siguiente', () => {
  // 8:30 p. m. del 11 en Colombia son las 01:30 UTC del 12. Antes se guardaba
  // ese instante y el lote aparecía el 12; el auxiliar capturó el 11.
  assert.equal(diaDeCaptura('2026-08-11T20:30:00-05:00').toISOString(), '2026-08-11T00:00:00.000Z');
});

test('descarta un día que no existe en vez de correrlo', () => {
  // new Date("2026-02-31") no falla: lo corre al 3 de marzo. Guardar eso sería
  // inventar un día que nadie escribió.
  const d = diaDeCaptura('2026-02-31');
  assert.notEqual(d.toISOString().slice(0, 10), '2026-03-03');
  assert.equal(d.toISOString().slice(11), '00:00:00.000Z', 'sea cual sea el día, va a medianoche UTC');
});

test('sin fecha usa hoy, siempre a medianoche', () => {
  for (const v of [undefined, null, '', 'cualquier cosa']) {
    const d = diaDeCaptura(v);
    assert.equal(d.toISOString().slice(11), '00:00:00.000Z');
    assert.equal(d.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));
  }
});

test('guardar bien no basta: mostrarlo en hora local resta un día', () => {
  // Esta es la mitad que fallaba en pantalla. Se deja escrita para que quede
  // claro por qué el formateo tiene que ser en UTC y no "el que traiga el
  // navegador": es exactamente el día que el auxiliar veía mal.
  const guardado = diaDeCaptura('2026-08-11');
  const fmt = (tz: string) => guardado.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: tz });

  assert.equal(fmt('UTC'), fmt('UTC'), 'referencia');
  assert.notEqual(
    fmt('America/Bogota'), fmt('UTC'),
    'si algún día coinciden, esta prueba dejó de proteger nada',
  );
  assert.match(fmt('UTC'), /11/, 'en UTC se ve el 11, que es el día que se capturó');
  assert.match(fmt('America/Bogota'), /10/, 'en hora local se veía el 10: el error reportado');
});
