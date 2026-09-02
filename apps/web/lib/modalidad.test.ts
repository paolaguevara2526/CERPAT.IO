// Visita presencial vs. reunión virtual.
//
// Son la misma entidad —se programa, se levanta acta, deja compromisos— y solo
// cambia el nombre y qué se pregunta en "lugar". Lo que estas pruebas cuidan es
// que un dato viejo o raro NUNCA convierta una visita en reunión: hay cientos de
// actas ya registradas sin este campo, y todas son presenciales.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modalidadValida, nombreModalidad, etiquetaCalendario, etiquetaLugar, esEnlace, MODALIDADES } from './modalidad.js';

test('lo que no diga "virtual" es presencial', () => {
  // Falla hacia lo seguro: las actas que ya existen no tienen el campo y son
  // todas visitas. Si el valor por defecto fuera "virtual", el histórico entero
  // cambiaría de naturaleza de un día para otro.
  assert.equal(modalidadValida('virtual'), 'virtual');
  assert.equal(modalidadValida('presencial'), 'presencial');
  assert.equal(modalidadValida(null), 'presencial');
  assert.equal(modalidadValida(undefined), 'presencial');
  assert.equal(modalidadValida(''), 'presencial');
  assert.equal(modalidadValida('Virtual'), 'presencial', 'no se adivinan mayúsculas');
  assert.equal(modalidadValida('remota'), 'presencial');
  assert.equal(modalidadValida(7), 'presencial');
});

test('cada una se llama por su nombre', () => {
  assert.equal(nombreModalidad('presencial'), 'Visita');
  assert.equal(nombreModalidad('virtual'), 'Reunión');
});

test('el calendario las separa en dos etiquetas', () => {
  // Es lo que permite mirar solo lo presencial o solo lo virtual en el mes.
  assert.equal(etiquetaCalendario('presencial'), 'Visitas');
  assert.equal(etiquetaCalendario('virtual'), 'Reuniones');
  assert.equal(etiquetaCalendario(null), 'Visitas');
});

test('a una se le pide dirección y a la otra un enlace', () => {
  assert.equal(etiquetaLugar('presencial'), 'Lugar');
  assert.equal(etiquetaLugar('virtual'), 'Enlace de la reunión');
});

test('solo un enlace de verdad se pinta como enlace', () => {
  // Si bastara con contener texto, "Oficina principal" se volvería un vínculo
  // roto en el acta que se le manda al cliente.
  assert.equal(esEnlace('https://meet.google.com/abc-defg-hij'), true);
  assert.equal(esEnlace('http://teams.microsoft.com/x'), true);
  assert.equal(esEnlace('  https://zoom.us/j/123  '), true, 'con espacios alrededor');
  assert.equal(esEnlace('Oficina principal'), false);
  assert.equal(esEnlace('meet.google.com/abc'), false, 'sin protocolo no se abre solo');
  assert.equal(esEnlace('https://meet.google.com/a b'), false, 'con espacio en medio no es una URL');
  assert.equal(esEnlace(''), false);
  assert.equal(esEnlace(null), false);
});

test('las dos modalidades están completas', () => {
  assert.equal(MODALIDADES.length, 2);
  for (const m of MODALIDADES) {
    assert.ok(m.label && m.icono && m.color, `"${m.k}" incompleta`);
  }
});
