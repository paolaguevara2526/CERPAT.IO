// El error que estas pruebas cierran: un ReteICA que vence el 13 de agosto se
// mostraba "12 de ago" en Mi Día y "13" en el calendario. El dato era el mismo;
// lo que cambiaba era cómo se formateaba.
//
// Se corren con TZ=America/Bogota para reproducir el desfase real (UTC−5).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDia, fmtInstante, diaISO } from './fechas.js';

test('medianoche UTC se muestra en su propio día, no en el anterior', () => {
  // Este es el caso reportado, tal cual.
  assert.match(fmtDia('2026-08-13T00:00:00.000Z'), /13/);
  assert.match(fmtDia('2026-08-14T00:00:00.000Z'), /14/);
});

test('da igual si viene con hora o sin ella', () => {
  assert.equal(fmtDia('2026-08-13'), fmtDia('2026-08-13T00:00:00.000Z'));
});

test('el mes y el año también se respetan en los bordes', () => {
  // El 1 de un mes es donde más se nota: restando cinco horas cambia de MES.
  assert.equal(fmtDia('2026-09-01T00:00:00.000Z', { day: '2-digit', month: '2-digit', year: 'numeric' }), '01/09/2026');
  assert.equal(fmtDia('2027-01-01T00:00:00.000Z', { day: '2-digit', month: '2-digit', year: 'numeric' }), '01/01/2027');
});

test('sin fecha o con basura no revienta', () => {
  for (const v of [null, undefined, '', 'mañana', '13/08/2026']) assert.equal(fmtDia(v), '—');
});

test('un instante SÍ se convierte al huso: son cosas distintas', () => {
  // 01:30 UTC del 13 son las 8:30 p. m. del 12 en Colombia. Para un sello de
  // creación eso es lo correcto —pasó el 12 por la noche—, y por eso hay dos
  // funciones y no una.
  //
  // El huso va explícito y no se hereda del entorno: si dependiera de la
  // variable TZ, esta prueba pasaría en un computador y fallaría en CI, que
  // corre en UTC — y una prueba que depende de dónde corre no prueba nada.
  const enBogota = { day: '2-digit', month: 'short', timeZone: 'America/Bogota' } as const;
  assert.match(fmtInstante('2026-08-13T01:30:00.000Z', enBogota), /12/, 'el instante se corre al huso');
  assert.match(fmtDia('2026-08-13T01:30:00.000Z'), /13/, 'el día de calendario no');
});

test('diaISO recorta para el <input type="date">', () => {
  assert.equal(diaISO('2026-08-13T00:00:00.000Z'), '2026-08-13');
  assert.equal(diaISO(null), '');
});
