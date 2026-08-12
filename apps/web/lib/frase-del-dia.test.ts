import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fraseDelDia, diaEnColombia, FRASES } from './frase-del-dia.js';

test('todo el equipo ve la misma frase el mismo día', () => {
  // Es el punto de la función: si cada quien viera una distinta, no habría de
  // qué hablar en la mañana.
  const manana = new Date('2026-08-12T13:00:00Z');
  const tarde = new Date('2026-08-12T21:30:00Z');
  assert.equal(fraseDelDia(manana), fraseDelDia(tarde));
});

test('la frase no cambia a las 7 p. m., que es cuando el servidor cambia de día', () => {
  // 6:30 p. m. y 8:30 p. m. en Colombia son días distintos en UTC. Sin el huso,
  // la frase cambiaba en plena jornada.
  const antes = new Date('2026-08-12T23:30:00Z'); // 6:30 p. m. en Colombia
  const despues = new Date('2026-08-13T01:30:00Z'); // 8:30 p. m. del MISMO día
  assert.equal(diaEnColombia(antes), '2026-08-12');
  assert.equal(diaEnColombia(despues), '2026-08-12');
  assert.equal(fraseDelDia(antes), fraseDelDia(despues));
});

test('cambia de un día al siguiente', () => {
  assert.notEqual(fraseDelDia(new Date('2026-08-12T15:00:00Z')), fraseDelDia(new Date('2026-08-13T15:00:00Z')));
});

test('no se repite antes de recorrerlas todas', () => {
  const vistas = new Set<string>();
  const inicio = Date.UTC(2026, 7, 12);
  for (let i = 0; i < FRASES.length; i++) vistas.add(fraseDelDia(new Date(inicio + i * 86400000)));
  assert.equal(vistas.size, FRASES.length, 'un mes largo debería ver frases distintas todos los días');
});

test('el cambio de año no reinicia la rotación', () => {
  // Con el día DEL AÑO, el 31 de diciembre y el 1 de enero caían en índices
  // vecinos y podía repetirse la frase. Se cuenta desde una fecha fija.
  assert.notEqual(fraseDelDia(new Date('2026-12-31T15:00:00Z')), fraseDelDia(new Date('2027-01-01T15:00:00Z')));
});

test('no se cae sin frases', () => {
  assert.equal(fraseDelDia(new Date(), []), '');
});

test('las frases están completas y en español', () => {
  for (const f of FRASES) {
    assert.ok(f.trim().length > 0, 'ninguna vacía');
    assert.match(f, /[.!?]$/, `sin puntuación final: "${f}"`);
    assert.ok(f.length <= 110, `demasiado larga para una línea: "${f}"`);
  }
  assert.equal(new Set(FRASES).size, FRASES.length, 'hay frases repetidas');
});
