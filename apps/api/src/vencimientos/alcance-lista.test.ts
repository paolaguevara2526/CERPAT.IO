// Un vencimiento (FOPAT) aparecía en el calendario de la dirección y no en el de
// los asesores. Estas pruebas fijan las dos reglas de la lista que alimenta el
// calendario: a quién se le muestra, y qué cae dentro del mes que se está viendo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtroAlcance, filtroMes } from './alcance-lista.js';

// ---- Alcance ----

test('quien ve toda la firma no lleva filtro de empresa', () => {
  assert.deepEqual(filtroAlcance(null, 'u1'), {});
});

test('quien ve toda la firma sí respeta el filtro por empresa que pidió', () => {
  assert.deepEqual(filtroAlcance(null, 'u1', 'emp-7'), { empresaId: 'emp-7' });
});

test('el staff acotado ve sus empresas asignadas', () => {
  const f = filtroAlcance(['emp-1', 'emp-2'], 'u1') as any;
  assert.deepEqual(f.OR[0], { empresaId: { in: ['emp-1', 'emp-2'] } });
});

test('y también lo que está a su nombre aunque la empresa no esté asignada', () => {
  // Era el error reportado: el vencimiento guarda su propio responsable y ese
  // responsable sobrevive a que la asignación cliente × área cambie o falte.
  const f = filtroAlcance([], 'edison') as any;
  assert.deepEqual(f.OR, [{ empresaId: { in: [] } }, { asesorId: 'edison' }, { auxiliarId: 'edison' }]);
});

test('el staff acotado no puede ampliar su alcance pidiendo otra empresa', () => {
  // El parámetro empresaId es un filtro de conveniencia, nunca una llave: si
  // colase, cualquiera vería la cartera ajena escribiendo un id en la URL.
  const f = filtroAlcance(['emp-1'], 'u1', 'emp-999') as any;
  assert.equal(f.empresaId, undefined);
  assert.deepEqual(f.OR[0], { empresaId: { in: ['emp-1'] } });
});

// ---- Mes ----

test('sin mes se pide el año completo por la columna anio', () => {
  assert.deepEqual(filtroMes(2026, NaN), { anio: 2026 });
  assert.deepEqual(filtroMes(2026, 0), { anio: 2026 });
  assert.deepEqual(filtroMes(2026, 13), { anio: 2026 });
});

test('con mes se pide la ventana de fechas de ese mes', () => {
  const f = filtroMes(2026, 8) as any;
  assert.equal(f.anio, undefined, 'la columna anio es el año del PERÍODO, no sirve para el mes');
  assert.equal(f.fechaVencimiento.gte.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(f.fechaVencimiento.lt.toISOString(), '2026-09-01T00:00:00.000Z');
});

test('diciembre cierra en el 1 de enero siguiente', () => {
  const f = filtroMes(2026, 12) as any;
  assert.equal(f.fechaVencimiento.lt.toISOString(), '2027-01-01T00:00:00.000Z');
});

test('el FOPAT de diciembre cae en enero del año siguiente, no en enero del mismo año', () => {
  // FOPAT/nómina electrónica/PILA del período de diciembre vencen al año
  // siguiente. Antes se comparaba solo el número del mes y aparecían un año
  // antes de su fecha real.
  const fopatDic = new Date('2027-01-15T00:00:00.000Z'); // 10º día hábil de enero
  const dentro = (f: any) => fopatDic >= f.fechaVencimiento.gte && fopatDic < f.fechaVencimiento.lt;
  assert.equal(dentro(filtroMes(2026, 1)), false, 'no en enero de 2026');
  assert.equal(dentro(filtroMes(2027, 1)), true, 'sí en enero de 2027');
});
