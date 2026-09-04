import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mesDe, mesesEntre, nombreDeMes, vigenciaDeTasa } from './vigencia-tasa.js';

const DIA = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

test('el mes sale con dos dígitos', () => {
  // '2026-9' rompería toda comparación de cadenas contra '2026-10'.
  assert.equal(mesDe(DIA('2026-09-04')), '2026-09');
  assert.equal(mesDe(DIA('2026-12-31')), '2026-12');
});

test('la cuenta de meses cruza el año', () => {
  assert.equal(mesesEntre('2026-08', '2026-09'), 1);
  assert.equal(mesesEntre('2025-11', '2026-02'), 3);
  assert.equal(mesesEntre('2026-09', '2026-09'), 0);
});

test('la tasa del mes en curso no molesta a nadie', () => {
  const v = vigenciaDeTasa('2026-09', DIA('2026-09-04'));
  assert.equal(v.alDia, true);
  assert.equal(v.aviso, null);
});

test('la tasa del mes pasado avisa, y dice qué está pasando mientras tanto', () => {
  // El caso real: se entra a septiembre con la tasa de agosto. El número sigue
  // ahí y Pagos sigue calculando — con la tasa vieja.
  const v = vigenciaDeTasa('2026-08', DIA('2026-09-04'));
  assert.equal(v.alDia, false);
  assert.equal(v.atraso, 1);
  assert.match(v.aviso!, /agosto de 2026/);
  assert.match(v.aviso!, /septiembre de 2026/);
  assert.match(v.aviso!, /se están liquidando/);
});

test('sin registro del mes no se supone que esté bien', () => {
  // Es el estado de las tasas cargadas antes de que existiera esta marca.
  const v = vigenciaDeTasa(null, DIA('2026-09-04'));
  assert.equal(v.alDia, false);
  assert.equal(v.mes, null);
  assert.match(v.aviso!, /No hay registro/);
});

test('una marca corrupta se trata como si no estuviera', () => {
  for (const malo of ['2026-13', 'septiembre', '2026-9', '', '2026-00']) {
    assert.equal(vigenciaDeTasa(malo, DIA('2026-09-04')).alDia, false, `"${malo}" no debería pasar por válido`);
  }
});

test('haber adelantado la tasa del mes que entra no es un error', () => {
  const v = vigenciaDeTasa('2026-10', DIA('2026-09-30'));
  assert.equal(v.alDia, true);
  assert.equal(v.aviso, null);
});

test('el mes se escribe como lo diría una persona', () => {
  assert.equal(nombreDeMes('2026-09'), 'septiembre de 2026');
  assert.equal(nombreDeMes('2026-01'), 'enero de 2026');
});
