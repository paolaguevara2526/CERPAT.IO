// El ReteICA bimestral de Bogotá estaba en el calendario y aun así no se
// generaba: el calendario oficial escribe "Bogotá, D.C." y el catálogo de
// municipios podía tener "Bogotá" a secas. Normalizados quedan "bogota d c" y
// "bogota" — dos claves distintas —, así que el cruce no encontraba nada y no
// se rompía nada: simplemente no salía el vencimiento.
//
// Es el peor tipo de error: silencioso y con toda la pinta de "falta cargar el
// calendario". Estas pruebas fijan que las dos formas de escribir la capital
// lleven a las mismas fechas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variantesMunicipio, vencimientosIca } from './generador.js';

test('la capital se indexa con y sin el "D.C."', () => {
  assert.deepEqual(variantesMunicipio('Bogotá, D.C.'), ['bogota d c', 'bogota']);
  assert.deepEqual(variantesMunicipio('Bogotá D.C.'), ['bogota d c', 'bogota']);
});

test('un municipio normal tiene una sola forma', () => {
  assert.deepEqual(variantesMunicipio('Villavicencio'), ['villavicencio']);
  assert.deepEqual(variantesMunicipio('Acacías'), ['acacias']);
  assert.deepEqual(variantesMunicipio('Cartagena De Indias'), ['cartagena de indias']);
});

const bogota = (municipio: string, departamento: string) => vencimientosIca(
  [{ municipioId: 'm-bog', municipio, departamento, icaPeriodicidad: null, reteica: true, reteicaPeriodicidad: 'bimestral', autoica: false, autoicaPeriodicidad: null }],
  '9001234567',
);

test('el ReteICA de Bogotá sale escriba como escriba el catálogo el municipio', () => {
  for (const [muni, depto] of [['Bogotá, D.C.', 'Bogotá, D.C.'], ['Bogotá', 'Bogotá D.C.'], ['Bogotá', 'Bogotá, D.C.']] as const) {
    const r = bogota(muni, depto);
    assert.deepEqual(r.sinCalendario, [], `"${muni}" / "${depto}" quedó sin calendario`);
    const fechas = r.vencimientos
      .filter((v) => v.obligacion === 'ReteICA')
      .map((v) => v.fechaVencimiento.toISOString().slice(0, 10))
      .sort();
    assert.deepEqual(fechas, ['2026-09-18', '2026-11-20', '2027-01-15'], `fechas incompletas para "${muni}"`);
  }
});

test('los tres bimestres pendientes de 2026 están cargados con su período', () => {
  // 4º (jul-ago), 5º (sep-oct) y 6º (nov-dic). El último vence en ENERO DE 2027:
  // por eso el calendario tiene que buscar por fecha y no por el año del período.
  const porPeriodo = new Map(
    bogota('Bogotá, D.C.', 'Bogotá, D.C.').vencimientos
      .filter((v) => v.obligacion === 'ReteICA')
      .map((v) => [v.periodo, v.fechaVencimiento.toISOString().slice(0, 10)]),
  );
  assert.equal(porPeriodo.get('jul-ago'), '2026-09-18');
  assert.equal(porPeriodo.get('sep-oct'), '2026-11-20');
  assert.equal(porPeriodo.get('nov-dic'), '2027-01-15');
});

test('un municipio que no está en el calendario se REPORTA, no se inventa', () => {
  // La otra mitad de la regla: si no hay fechas, hay que avisar. Un vencimiento
  // inventado es peor que uno que falta.
  const r = vencimientosIca(
    [{ municipioId: 'm-x', municipio: 'Municipio Inexistente', departamento: 'Meta', icaPeriodicidad: null, reteica: true, reteicaPeriodicidad: 'bimestral', autoica: false, autoicaPeriodicidad: null }],
    '9001234567',
  );
  assert.deepEqual(r.vencimientos, []);
  assert.deepEqual(r.sinCalendario, [{ municipio: 'Municipio Inexistente', departamento: 'Meta', obligaciones: ['ReteICA'] }]);
});
