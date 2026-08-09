// Blindaje: ningún endpoint que exponga datos de la firma puede quedar sin
// autenticación. En agosto de 2026 se detectó que /usuarios, /empresas, /tareas y
// /plan/cumplimiento respondían SIN sesión (quedaron abiertos de antes del login),
// filtrando datos personales del equipo y la cartera de clientes. Este test lee el
// código fuente de los routers y falla si vuelve a aparecer una ruta sin proteger.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const leer = (archivo: string) => readFileSync(join(AQUI, archivo), 'utf8');

// Rutas públicas a propósito (no exponen datos): login y health.
const PUBLICAS = [
  { archivo: 'auth.ts', ruta: "'/login'" },
  { archivo: 'health.ts', ruta: "'/'" },
];

const ROUTERS = ['auth.ts', 'empresas.ts', 'usuarios.ts', 'tareas.ts', 'plan.ts', 'admin.ts', 'vencimientos.ts', 'visitas.ts', 'hallazgos.ts', 'ficha.ts'];

for (const archivo of ROUTERS) {
  test(`${archivo}: toda ruta exige sesión (salvo las públicas declaradas)`, () => {
    const src = leer(archivo);
    // Un router puede proteger todo de golpe con router.use(requireAuth).
    if (/\.use\(\s*requireAuth\s*\)/.test(src)) return;

    // Declaraciones tipo  xRouter.get('/ruta', ...)  hasta el final de esa línea.
    const decl = /\w+Router\.(get|post|patch|put|delete)\(\s*('[^']*'|`[^`]*`)([^\n]*)/g;
    const sinProteger: string[] = [];
    for (const m of src.matchAll(decl)) {
      const [, metodo, ruta, resto] = m;
      if (PUBLICAS.some((p) => p.archivo === archivo && p.ruta === ruta)) continue;
      if (!resto.includes('requireAuth')) sinProteger.push(`${metodo.toUpperCase()} ${ruta}`);
    }
    assert.deepEqual(sinProteger, [], `Rutas sin requireAuth en ${archivo}: ${sinProteger.join(', ')}`);
  });
}
