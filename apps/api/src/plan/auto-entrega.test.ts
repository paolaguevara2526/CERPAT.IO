// La captura de Informes no puede dejar esperando a Impuestos y Tesorería:
// cada área se libera sola, y el auxiliar puede soltarle el insumo a cada
// asesor según su área. Estas pruebas fijan esa regla antes de tocarla en
// evaluarAutoEntrega — si se vuelve a esperar "toda la captura del cliente",
// el recorrido de Karen vuelve a fallar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capturaLista, decidirAutoEntrega, auxiliarPuedeLiberarArea } from './auto-entrega.js';

const INF = 'area-informes';
const NOM = 'area-nomina';
const IMP = 'area-impuestos';
const TES = 'area-tesoreria';

test('capturaLista acepta terminado, auditado y no_aplica', () => {
  assert.equal(capturaLista('terminado'), true);
  assert.equal(capturaLista('auditado'), true);
  assert.equal(capturaLista('no_aplica'), true);
  assert.equal(capturaLista('por_iniciar'), false);
  assert.equal(capturaLista('en_curso'), false);
});

test('sin captura interna no hay nada que auto-entregar', () => {
  const d = decidirAutoEntrega({
    capturas: [],
    areasObjetivo: [IMP, INF, TES],
  });
  assert.deepEqual(d, { crear: [], revertir: [] });
});

test('terminar la captura de Informes libera Informes, no espera a Nómina', () => {
  const d = decidirAutoEntrega({
    capturas: [
      { areaId: INF, estado: 'terminado' },
      { areaId: NOM, estado: 'por_iniciar' },
    ],
    areasObjetivo: [INF, NOM, IMP, TES],
  });
  assert.deepEqual(d.crear.sort(), [INF].sort());
  assert.ok(d.revertir.includes(NOM));
  assert.ok(!d.crear.includes(IMP), 'Impuestos no tiene captura: no se libera hasta que toda la captura esté lista o el auxiliar la suelte a mano');
  assert.ok(!d.crear.includes(TES));
});

test('al terminar TODA la captura también se liberan Impuestos y Tesorería (sin captura propia)', () => {
  const d = decidirAutoEntrega({
    capturas: [
      { areaId: INF, estado: 'terminado' },
      { areaId: NOM, estado: 'no_aplica' },
    ],
    areasObjetivo: [INF, NOM, IMP, TES],
  });
  assert.deepEqual(d.crear.sort(), [INF, NOM, IMP, TES].sort());
  assert.deepEqual(d.revertir, []);
});

test('reabrir Informes NO le quita el insumo al asesor de Impuestos', () => {
  // Antes se borraban TODAS las auto-entregas si una captura se reabría.
  // El asesor de Impuestos no depende de que Informes siga abierta.
  const d = decidirAutoEntrega({
    capturas: [
      { areaId: INF, estado: 'en_curso' },
      { areaId: NOM, estado: 'terminado' },
    ],
    areasObjetivo: [INF, NOM, IMP, TES],
  });
  assert.ok(d.revertir.includes(INF));
  assert.ok(d.crear.includes(NOM));
  assert.ok(!d.revertir.includes(IMP));
  assert.ok(!d.revertir.includes(TES));
  assert.ok(!d.crear.includes(IMP));
});

test('captura sin área no bloquea ni libera un área concreta', () => {
  const d = decidirAutoEntrega({
    capturas: [
      { areaId: null, estado: 'terminado' },
      { areaId: INF, estado: 'terminado' },
    ],
    areasObjetivo: [INF, IMP],
  });
  assert.ok(d.crear.includes(INF));
  assert.ok(d.crear.includes(IMP), 'la captura huérfana ya está lista, cuenta para el "todas listas"');
});

test('el auxiliar no adelanta un área cuya captura propia sigue pendiente', () => {
  const r = auxiliarPuedeLiberarArea([{ estado: 'en_curso' }]);
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? '', /captura/i);
});

test('el auxiliar SÍ libera un área sin captura propia (Impuestos, Tesorería)', () => {
  const r = auxiliarPuedeLiberarArea([]);
  assert.equal(r.ok, true);
});

test('el auxiliar SÍ libera un área cuya captura ya está lista', () => {
  const r = auxiliarPuedeLiberarArea([{ estado: 'terminado' }, { estado: 'auditado' }]);
  assert.equal(r.ok, true);
});
