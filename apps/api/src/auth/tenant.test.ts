// Blindaje del aislamiento entre firmas (regla de seguridad #0, ADR-0001).
//
// Hasta agosto de 2026 los endpoints resolvían la organización con el texto fijo
// `slug: 'cerpat'`. Con una sola firma funcionaba, pero era el bloqueo para
// vender la plataforma (ADR-0002): un segundo tenant habría visto los datos de
// CERPAT. Estos tests fijan las dos garantías del cambio.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { orgDeSesion } from './tenant.js';
import type { AuthedRequest } from './middleware.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUTAS = join(AQUI, '..', 'routes');

const sesion = (user: AuthedRequest['user']) => ({ user }) as AuthedRequest;

test('la organización sale del token de la sesión', async () => {
  const req = sesion({ sub: 'u1', org: 'org-de-la-firma', roles: ['Asesor'], esRoot: false });
  assert.deepEqual(await orgDeSesion(req), { id: 'org-de-la-firma' });
});

test('sin organización y sin ser root, no hay tenant (no se adivina uno)', async () => {
  const req = sesion({ sub: 'u2', org: null, roles: ['Asesor'], esRoot: false });
  assert.equal(await orgDeSesion(req), null);
});

test('sin sesión no hay tenant', async () => {
  assert.equal(await orgDeSesion({} as AuthedRequest), null);
});

// Guarda contra la regresión: si alguien vuelve a cablear la firma en un
// endpoint, el aislamiento se rompe en silencio y nadie se entera hasta que hay
// un segundo cliente. El único lugar donde puede aparecer el slug es este
// módulo, y hoy ni siquiera lo usa.
test('ningún endpoint resuelve la organización por slug', () => {
  const culpables: string[] = [];
  for (const archivo of readdirSync(RUTAS).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const src = readFileSync(join(RUTAS, archivo), 'utf8');
    if (/slug:\s*['"`]/.test(src)) culpables.push(archivo);
  }
  assert.deepEqual(culpables, [], `Resuelven la organización por slug (debe salir de la sesión): ${culpables.join(', ')}`);
});
