// La bandeja de liberación no puede contradecir a la pantalla que la rodea.
//
// El caso real: en la Lista conviven la bandeja "Liberar insumo a asesores"
// (arriba) y las tareas (abajo). Karen marcó la captura de Nómina como
// Terminado abajo, miró arriba y la bandeja seguía diciendo "falta captura".
//
// Dos causas, las dos de sincronía:
//   1. La bandeja carga sus datos al abrir la página y nadie le avisa.
//      `router.refresh()` no alcanza: rehace los componentes de SERVIDOR, y la
//      bandeja es de cliente con su propio fetch — no se remonta.
//   2. La bandeja pedía siempre el mes en curso, ignorando el navegador de mes
//      de la pantalla. Parada en agosto abajo, arriba se veía septiembre.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => readFileSync(join(AQUI, rel), 'utf8');
const bandeja = leer('LiberarInsumo.tsx');

test('la bandeja se entera cuando cambia el estado de una tarea', () => {
  assert.match(bandeja, /alCambiarTarea\(\(\) => \{ cargar\(\); \}\)/);
  assert.match(bandeja, /import \{ alCambiarTarea \} from '@\/lib\/eventos'/);
});

test('todos los sitios que cambian el estado avisan', () => {
  // Si uno se queda callado, la bandeja se desactualiza solo desde esa pantalla
  // — el peor tipo de error: el que aparece a veces.
  const emisores = [
    ['la Lista y el detalle', '../EstadoSelect.tsx'],
    ['el Tablero', '../Tablero.tsx'],
    ['la captura del día', 'CapturaDelDia.tsx'],
    ['listo para procesar', 'ListoParaProcesar.tsx'],
  ] as const;
  for (const [donde, ruta] of emisores) {
    assert.match(leer(ruta), /avisarTareaCambiada\(\)/, `${donde} no avisa del cambio`);
  }
});

test('la bandeja mira el mismo mes que la pantalla', () => {
  assert.match(bandeja, /const periodoURL = params\.get\('periodo'\)/);
  assert.match(bandeja, /liberar-insumo\$\{qs\}/);
});

test('un período roto en la URL no rompe la consulta', () => {
  // Llega de un enlace copiado a medias: se ignora y se pide el mes en curso.
  assert.match(bandeja, /test\(periodoURL\) \? `\?periodo=/);
});

test('recargar depende del mes, no se queda pegada al primero', () => {
  // Con [] como dependencias, cambiar de mes dejaría los datos del mes anterior.
  assert.match(bandeja, /\}, \[periodoURL\]\)/);
  assert.match(bandeja, /useEffect\(\(\) => \{ cargar\(\); \}, \[cargar\]\)/);
});
