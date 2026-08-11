// El día hábil de entrega lo digita una persona en el catálogo y de él sale el
// plazo de miles de tareas. Un error aquí no rompe nada: mueve fechas, y eso
// solo se descubre cuando alguien reclama que algo aparecía vencido.
//
// Las fechas de abajo están verificadas a mano contra el calendario colombiano,
// incluidos los festivos que la ley Emiliani corre al lunes siguiente.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nthDiaHabil } from './generador.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);

test('salta el fin de semana', () => {
  // Agosto de 2026 empieza en sábado, así que el primer hábil es el lunes 3.
  assert.equal(iso(nthDiaHabil(2026, 8, 1)), '2026-08-03');
  assert.equal(iso(nthDiaHabil(2026, 8, 2)), '2026-08-04');
});

test('salta los festivos de fecha fija', () => {
  // El viernes 7 es la Batalla de Boyacá: el 5º hábil pasa al lunes 10 y el 6º
  // al martes 11.
  assert.equal(iso(nthDiaHabil(2026, 8, 5)), '2026-08-10');
  assert.equal(iso(nthDiaHabil(2026, 8, 6)), '2026-08-11');
});

test('salta los festivos que la ley Emiliani corre al lunes', () => {
  // La Asunción cae el sábado 15, así que se traslada al lunes 17. El 10º hábil
  // queda en el martes 18.
  assert.equal(iso(nthDiaHabil(2026, 8, 10)), '2026-08-18');
  // Reyes cae el martes 6 de enero y se traslada al lunes 12; el 10º hábil de
  // enero queda en el viernes 16.
  assert.equal(iso(nthDiaHabil(2026, 1, 10)), '2026-01-16');
});

test('el cierre de mes del equipo cae donde debe', () => {
  // "Cierre de mes y elaboración de informes" va al 12º hábil.
  assert.equal(iso(nthDiaHabil(2026, 8, 12)), '2026-08-20');
});

test('si el mes no tiene tantos hábiles, usa el último', () => {
  // Agosto de 2026 tiene 19 hábiles (dos festivos). Pedir el 20 o el 23 no
  // puede devolver el día 1 del mes, que es lo que hacía antes: un plazo
  // adelantado haría aparecer todo vencido sin motivo. Se falla hacia el final.
  assert.equal(iso(nthDiaHabil(2026, 8, 19)), '2026-08-31');
  assert.equal(iso(nthDiaHabil(2026, 8, 20)), '2026-08-31');
  assert.equal(iso(nthDiaHabil(2026, 8, 23)), '2026-08-31');
});

test('el resultado siempre cae dentro del mes pedido', () => {
  for (let mes = 1; mes <= 12; mes++) {
    for (const n of [1, 5, 12, 23]) {
      const d = nthDiaHabil(2026, mes, n);
      assert.equal(d.getUTCMonth(), mes - 1, `mes ${mes}, hábil ${n} se salió del mes`);
      const dow = d.getUTCDay();
      assert.ok(dow !== 0 && dow !== 6, `mes ${mes}, hábil ${n} cayó en fin de semana`);
    }
  }
});
