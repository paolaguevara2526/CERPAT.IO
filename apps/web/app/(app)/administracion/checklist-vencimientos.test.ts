// El botón de esta pantalla hace DOS cosas: aplica el checklist y asigna el
// responsable. Estaba deshabilitado cuando no había checklist pendiente —y solo
// por eso—, así que en el caso que importaba (obligaciones sin actividad
// vinculada, como FOPAT, PILA y AutoICA, cuyo responsable SÍ se puede resolver)
// la pantalla mostraba el problema y no dejaba arreglarlo: el botón gris.
//
// Un control deshabilitado no dice por qué. La dirección hizo clic, no pasó
// nada, y la conclusión razonable fue "está dañado".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(join(AQUI, 'ChecklistVencimientos.tsx'), 'utf8');

test('el botón de aplicar no se habilita solo por el checklist', () => {
  // Ojo con [^>]* aquí: el onClick trae una flecha `=>`, así que hay que dejar
  // pasar el `>` para llegar al disabled.
  const boton = /className="dbtn green"[\s\S]*?disabled=\{([^}]+)\}/.exec(fuente)?.[1];
  assert.ok(boton, 'no se encontró el botón de aplicar: ¿cambió de forma?');
  assert.doesNotMatch(boton, /porAplicar === 0/,
    'vuelve a estar deshabilitado cuando lo único pendiente es el responsable');
  assert.match(boton, /hayAlgoQueAplicar/);
});

test('"hay algo que aplicar" cuenta las dos cosas', () => {
  assert.match(fuente, /const hayAlgoQueAplicar = porAplicar > 0 \|\| sinResponsable > 0;/);
});

test('la pantalla muestra cuántos vencimientos no tienen responsable', () => {
  // Es el número que se estaba persiguiendo: trabajo que hoy no le aparece a
  // nadie en Mi Día. Sin la columna, el diagnóstico solo hablaba de checklist.
  assert.match(fuente, /Sin responsable<\/th>/);
  assert.match(fuente, /f\.sinResponsable/);
});

test('el encabezado y las filas tienen el mismo número de columnas', () => {
  // Agregar un <th> y olvidar el colSpan del "Cargando…" desalinea la tabla.
  const ths = [...fuente.matchAll(/<th[ >]/g)].length;
  const colSpan = Number(/colSpan=\{(\d+)\}/.exec(fuente)?.[1]);
  assert.equal(colSpan, ths, `hay ${ths} columnas y el colSpan dice ${colSpan}`);
});
