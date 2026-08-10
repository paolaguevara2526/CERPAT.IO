// La CIIU está embebida y se generó parseando un PDF de 700 páginas del DANE.
// Ese origen es frágil: si alguien regenera el archivo con un parser peor, lo
// que se rompe no es el build sino la clasificación de los clientes, y en
// silencio. Estas pruebas fijan lo que tiene que seguir siendo cierto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CIIU_REV4_AC, SECCIONES_CIIU } from './ciiu-rev4-ac.js';

test('están las 499 clases, sin repetidos', () => {
  assert.equal(CIIU_REV4_AC.length, 499);
  assert.equal(new Set(CIIU_REV4_AC.map((c) => c.codigo)).size, 499);
});

test('cada clase tiene código de 4 dígitos, descripción y una sección válida', () => {
  for (const c of CIIU_REV4_AC) {
    assert.match(c.codigo, /^\d{4}$/, `código inválido: ${c.codigo}`);
    assert.ok(c.descripcion.trim().length > 5, `descripción vacía o mínima en ${c.codigo}`);
    assert.ok(SECCIONES_CIIU[c.seccion], `sección desconocida en ${c.codigo}: ${c.seccion}`);
  }
});

test('están las 21 secciones de la A a la U', () => {
  const letras = Object.keys(SECCIONES_CIIU).sort().join('');
  assert.equal(letras, 'ABCDEFGHIJKLMNOPQRSTU');
});

// Contrastadas una a una con el buscador del DANE. Si una de estas cambia, el
// archivo se regeneró mal: no las "arregles" para que pase la prueba.
test('clases de referencia, verificadas contra el DANE', () => {
  const de = (codigo: string) => CIIU_REV4_AC.find((c) => c.codigo === codigo);
  assert.equal(de('6920')?.descripcion,
    'Actividades de contabilidad, teneduría de libros, auditoría financiera y asesoría tributaria');
  assert.equal(de('0112')?.descripcion, 'Cultivo de arroz');
  assert.equal(de('4111')?.descripcion, 'Construcción de edificios residenciales');
  assert.equal(de('9900')?.descripcion, 'Actividades de organizaciones y entidades extraterritoriales');
  // 4711 y 4719 traían el código solo en su línea del PDF y un parser anterior
  // las perdía enteras sin fallar en nada.
  assert.ok(de('4711')?.descripcion.startsWith('Comercio al por menor en establecimientos no especializados'));
  assert.ok(de('4719'));
});

test('ninguna descripción quedó cortada por el salto de página', () => {
  // El PDF parte las descripciones en varias líneas y repite el encabezado de
  // sección en cada página. Un parser que trate ese encabezado como sección
  // nueva cierra la clase en curso y pierde el final de la frase — así quedó
  // 2814 en «…y piezas de», sin «transmisión».
  //
  // Se exige un espacio antes de la preposición en vez de \b: en JavaScript \b
  // no conoce las tildes, así que «ganadería» daba un falso positivo por
  // terminar en "a".
  const colgando = CIIU_REV4_AC.filter((c) => /(^|\s)(de|del|la|el|los|las|en|con|para|y|o|por|a)\s*$/i.test(c.descripcion));
  assert.deepEqual(colgando.map((c) => c.codigo), []);
  assert.equal(CIIU_REV4_AC.find((c) => c.codigo === '2814')?.descripcion,
    'Fabricación de cojinetes, engranajes, trenes de engranajes y piezas de transmisión');
});
