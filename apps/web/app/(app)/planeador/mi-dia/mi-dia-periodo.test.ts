// Mi Día se recorre mes a mes, como el resto del plan.
//
// El caso real: cerrado agosto, no había forma de volver a revisar qué capturó
// cada auxiliar por empresa. El backend siempre supo servir cualquier mes —los
// endpoints de captura y procesamiento aceptan ?periodo= desde siempre— pero Mi
// Día era la única pantalla del plan sin navegador de mes, así que nadie se lo
// pedía nunca.
//
// Lo segundo que cuidan estas pruebas es que la pantalla no se contradiga: si
// el encabezado dice agosto, los paneles de abajo no pueden estar mostrando
// septiembre. Con datos que se ven igual de bien en los dos meses, eso no se
// nota — se descubre semanas después, discutiendo cifras que nadie sabe de qué
// mes son.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => readFileSync(join(AQUI, rel), 'utf8');
const pagina = leer('page.tsx');
const captura = leer('CapturaDelDia.tsx');

test('Mi Día tiene navegador de mes', () => {
  assert.match(pagina, /<NavegadorPeriodo \/>/);
  assert.match(pagina, /import NavegadorPeriodo from '@\/app\/_components\/NavegadorPeriodo'/);
});

test('las tareas del período siguen el mes de la URL', () => {
  // Si el listado se quedara en el mes en curso, el encabezado diría agosto y
  // la tabla mostraría septiembre.
  assert.match(pagina, /periodoValido\(searchParams\?\.periodo\)/);
  assert.match(pagina, /miDia=1\$\{periodo \? `&periodo=/);
});

test('todos los paneles del período miran el mismo mes', () => {
  const paneles = [
    ['la captura del día', 'CapturaDelDia.tsx'],
    ['listo para procesar', 'ListoParaProcesar.tsx'],
    ['esperando al cliente', 'InsumoDelCliente.tsx'],
    ['liberar insumo', 'LiberarInsumo.tsx'],
  ] as const;
  for (const [donde, ruta] of paneles) {
    assert.match(leer(ruta), /params\.get\('periodo'\)/, `${donde} no lee el mes de la URL`);
  }
});

test('recargar depende del mes, no se queda pegado al primero', () => {
  // Con [] como dependencias, cambiar de mes dejaría los datos del anterior en
  // pantalla: lo peor de los dos mundos, porque parece que sí cambió.
  assert.match(captura, /\}, \[periodoURL\]\)/);
  assert.match(captura, /useEffect\(\(\) => \{ cargar\(\); \}, \[cargar\]\)/);
});

test('un período roto en la URL no rompe la consulta', () => {
  assert.match(captura, /PERIODO_RE\.test\(periodoURL\) \? `\?periodo=/);
});

// Cuántas veces aparece algo. Con `match` bastaba una sola: hay DOS tablas
// (la propia y la de los auxiliares) y dos filas desplegables, así que arreglar
// una mitad dejaba la otra rota sin que ninguna prueba se enterara.
const veces = (texto: string, trozo: string) => texto.split(trozo).length - 1;

test('en un mes pasado no se habla de "hoy", en ninguna de las dos tablas', () => {
  // "0 con captura hoy" en agosto se lee como que nadie capturó, cuando lo que
  // pasa es que la pregunta no aplica. Lo que sirve ahí es el acumulado del mes.
  assert.match(captura, /const otroMes = /);
  assert.equal(veces(captura, "{!otroMes && <th style={{ ...th, textAlign: 'center' }}>Hoy</th>}"), 2);
  assert.match(captura, /con lotes en el mes/);
});

test('la tabla no se descuadra al ocultar la columna', () => {
  // Un colSpan fijo deja el detalle desalineado justo cuando se está revisando
  // lo que alguien registró. Son dos filas desplegables: los lotes y el
  // formulario de captura.
  assert.equal(veces(captura, 'colSpan={otroMes ? 5 : 6}'), 2);
});

test('el panel dice qué mes está mostrando', () => {
  assert.match(captura, /Los conteos son de ese mes, no de hoy/);
});
