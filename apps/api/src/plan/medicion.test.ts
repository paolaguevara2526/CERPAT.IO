// El punto de "no aplica" es la medición. Si estas cuentas se equivocan, el
// estado no sirve de nada: el equipo seguiría cargando con trabajo que nunca
// existió, que es exactamente lo que se quiere quitar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cumplimiento, cuenta, NO_CUENTA } from './medicion.js';

const AYER = new Date(Date.now() - 86400000);
const MANANA = new Date(Date.now() + 86400000);

test('"no aplica" sale del denominador', () => {
  // Dos hechas de tres, con la tercera sin aplicar: es 100%, no 67%.
  const r = cumplimiento([
    { estado: 'terminado', fechaVencimiento: MANANA },
    { estado: 'auditado', fechaVencimiento: MANANA },
    { estado: 'no_aplica', fechaVencimiento: AYER },
  ]);
  assert.equal(r.total, 2, 'la que no aplica no se cuenta');
  assert.equal(r.ejecutadas, 2);
  assert.equal(r.pct, 100);
});

test('"no aplica" tampoco cuenta como ejecutada', () => {
  // El error contrario: si contara como hecha, inflaría el cumplimiento con
  // trabajo que nadie hizo.
  const r = cumplimiento([
    { estado: 'no_aplica', fechaVencimiento: AYER },
    { estado: 'por_iniciar', fechaVencimiento: MANANA },
  ]);
  assert.equal(r.total, 1);
  assert.equal(r.ejecutadas, 0);
  assert.equal(r.pct, 0);
});

test('"no aplica" nunca sale vencida, por vieja que sea la fecha', () => {
  const r = cumplimiento([{ estado: 'no_aplica', fechaVencimiento: AYER }]);
  assert.equal(r.vencidas, 0);
});

test('"no realizado" SÍ cuenta en contra: no es lo mismo', () => {
  // Esta es la distinción entera. Si las dos se comportaran igual, sobraría una.
  const noRealizado = cumplimiento([
    { estado: 'terminado', fechaVencimiento: MANANA },
    { estado: 'no_realizado', fechaVencimiento: AYER },
  ]);
  const noAplica = cumplimiento([
    { estado: 'terminado', fechaVencimiento: MANANA },
    { estado: 'no_aplica', fechaVencimiento: AYER },
  ]);
  assert.equal(noRealizado.pct, 50, 'no realizado baja el cumplimiento');
  assert.equal(noAplica.pct, 100, 'no aplica no lo baja');
  assert.notEqual(noRealizado.pct, noAplica.pct);
});

test('un mes en el que nada aplicaba es 100%, no 0%', () => {
  // Dividir por cero daría 0% y le mostraría un incumplimiento total a un
  // cliente que no tenía nada pendiente.
  const r = cumplimiento([{ estado: 'no_aplica', fechaVencimiento: AYER }]);
  assert.equal(r.total, 0);
  assert.equal(r.pct, 100);
});

test('cuenta() solo excluye no_aplica', () => {
  for (const e of ['por_iniciar', 'en_curso', 'en_revision', 'terminado', 'auditado', 'no_realizado']) {
    assert.equal(cuenta(e), true, `${e} debe contar`);
  }
  assert.equal(cuenta(NO_CUENTA), false);
});
