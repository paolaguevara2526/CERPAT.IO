// El plan de trabajo se puede recorrer mes a mes.
//
// El backend siempre supo servir cualquier período: casi todos los endpoints del
// plan aceptan ?periodo=. Lo que no existía era cómo pedirlo — ninguna pantalla
// tenía un control de mes, salvo una casilla donde había que escribir "2026-08"
// a mano. Generado septiembre, agosto quedaba fuera de alcance aunque estuviera
// completo en la base.
//
// Estas pruebas cuidan el cableado: que cada pantalla del período monte el
// navegador y que el mes elegido llegue de verdad a la consulta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => readFileSync(join(AQUI, rel), 'utf8');

const PANTALLAS: [string, string][] = [
  ['Tablero', 'tablero/page.tsx'],
  ['Lista', 'lista/page.tsx'],
  ['Flujo del cierre', 'flujo/page.tsx'],
  ['Auditoría', 'auditoria/page.tsx'],
];

for (const [nombre, ruta] of PANTALLAS) {
  test(`${nombre} monta el navegador de mes`, () => {
    const fuente = leer(ruta);
    assert.match(fuente, /<NavegadorPeriodo\s*\/>/, `${nombre} se quedó sin control de período`);
    assert.match(fuente, /import NavegadorPeriodo from '@\/app\/_components\/NavegadorPeriodo'/);
  });
}

test('Coordinación también, y por fuera del "no hay datos"', () => {
  // Si el navegador viviera dentro del condicional, caer en un mes sin plan
  // dejaría la pantalla sin manera de devolverse — el callejón sin salida.
  const fuente = leer('../coordinacion/page.tsx');
  const iNav = fuente.indexOf('<NavegadorPeriodo />');
  const iError = fuente.indexOf('{error ? (');
  assert.ok(iNav > 0, 'Coordinación se quedó sin control de período');
  assert.ok(iNav < iError, 'el navegador quedó dentro del condicional de datos');
});

test('el mes elegido llega a la consulta, no se queda en la pantalla', () => {
  // Sin esto el control se mueve y la pantalla sigue mostrando el mes en curso.
  assert.match(leer('tablero/page.tsx'), /qs\.set\('periodo', periodo\)/);
  assert.match(leer('auditoria/page.tsx'), /fetchAuditoria\(periodoAMostrar\(searchParams\?\.periodo\)\)/);
  assert.match(leer('lista/page.tsx'), /'periodo'\]? as const|'periodo'\] as const/);
});

test('filtrar no devuelve al mes en curso', () => {
  // Los filtros se mandan por GET: si el período no viaja en el formulario, cada
  // filtro borra el mes que se estaba viendo.
  assert.match(leer('tablero/page.tsx'), /<input type="hidden" name="periodo" value=\{periodo\} \/>/);
  assert.match(leer('lista/page.tsx'), /<input type="hidden" name="periodo" value=\{p\.periodo \?\? ''\} \/>/);
});

test('la Lista deja pedir las capturas de un mes', () => {
  // "Las capturas de agosto" no se podía pedir: había que reconocerlas una por
  // una por el nombre de la actividad.
  const fuente = leer('lista/page.tsx');
  assert.match(fuente, /name="fase"/);
  assert.match(fuente, /<option value="captura">Captura<\/option>/);
});

test('ya no queda ninguna casilla de "YYYY-MM" que llenar a mano', () => {
  for (const [nombre, ruta] of PANTALLAS) {
    assert.doesNotMatch(leer(ruta), /placeholder="YYYY-MM"/, `${nombre} volvió a pedir el período escrito`);
  }
});
