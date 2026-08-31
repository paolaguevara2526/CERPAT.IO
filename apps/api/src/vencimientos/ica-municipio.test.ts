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
import { variantesMunicipio, vencimientosIca, mismaPeriodicidad } from './generador.js';

// Un municipio marcado en la configuración del cliente. Por defecto, nada.
const muni = (p: Partial<Parameters<typeof vencimientosIca>[0][number]> = {}) => ({
  municipioId: 'm-bog', municipio: 'Bogotá, D.C.', departamento: 'Bogotá, D.C.',
  icaPeriodicidad: null, reteica: false, reteicaPeriodicidad: null,
  autoica: false, autoicaPeriodicidad: null, ...p,
});
const fechasDe = (r: ReturnType<typeof vencimientosIca>, ob: string) =>
  r.vencimientos.filter((v) => v.obligacion === ob).map((v) => v.fechaVencimiento.toISOString().slice(0, 10)).sort();

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

// ---- ICA bimestral de Bogotá ----
// Faltaba en el calendario: el municipio solo tenía ReteICA. Son los cuatro
// bimestres que quedaban del año cuando se cargó (3º a 6º).

test('el ICA bimestral de Bogotá tiene sus cuatro vencimientos', () => {
  const r = vencimientosIca([muni({ icaPeriodicidad: 'bimestral' })], '9001234567');
  assert.deepEqual(r.sinCalendario, []);
  const porPeriodo = new Map(
    r.vencimientos.filter((v) => v.obligacion === 'ICA')
      .map((v) => [v.periodo, v.fechaVencimiento.toISOString().slice(0, 10)]),
  );
  assert.equal(porPeriodo.get('may-jun'), '2026-08-21', '3º bimestre');
  assert.equal(porPeriodo.get('jul-ago'), '2026-10-09', '4º bimestre');
  assert.equal(porPeriodo.get('sep-oct'), '2026-12-11', '5º bimestre');
  assert.equal(porPeriodo.get('nov-dic'), '2027-02-12', '6º bimestre');
  assert.equal(porPeriodo.size, 4, 'no debería haber más bimestres que esos cuatro');
});

test('el ICA no se cruza con el ReteICA: son fechas distintas', () => {
  // Comparten municipio y periodicidad; lo único que los separa es la
  // obligación. Confundirlos daría fechas equivocadas en las dos.
  const r = vencimientosIca([muni({ icaPeriodicidad: 'bimestral', reteica: true, reteicaPeriodicidad: 'bimestral' })], '9001234567');
  assert.deepEqual(fechasDe(r, 'ICA'), ['2026-08-21', '2026-10-09', '2026-12-11', '2027-02-12']);
  assert.deepEqual(fechasDe(r, 'ReteICA'), ['2026-09-18', '2026-11-20', '2027-01-15']);
});

// ---- Periodicidad ----
// En Bogotá el ICA es bimestral en el régimen común y anual en el preferencial.
// Antes la periodicidad no se cruzaba y no se notaba porque cada municipio tenía
// una sola; al cargar Bogotá, un cliente marcado "anual" habría recibido los
// cuatro vencimientos bimestrales.

test('la periodicidad cruza sin importar mayúsculas', () => {
  assert.equal(mismaPeriodicidad('Bimestral', 'bimestral'), true);
  assert.equal(mismaPeriodicidad('Bimestral', 'anual'), false);
  assert.equal(mismaPeriodicidad('Mensual', 'bimestral'), false);
});

test('sin periodicidad marcada, no se exige ninguna', () => {
  // ReteICA y AutoICA son casillas: pueden quedar sin periodicidad y tienen que
  // seguir generando como siempre.
  assert.equal(mismaPeriodicidad('Bimestral', null), true);
  assert.equal(mismaPeriodicidad('Bimestral', ''), true);
  const r = vencimientosIca([muni({ reteica: true })], '9001234567');
  assert.deepEqual(fechasDe(r, 'ReteICA'), ['2026-09-18', '2026-11-20', '2027-01-15']);
});

test('un cliente de ICA ANUAL en Bogotá no recibe los bimestrales', () => {
  // Se reporta que falta, que es lo correcto: la fecha anual todavía no está
  // cargada. Un vencimiento de más se trabaja, se presenta y se paga; uno que
  // falta se ve en el aviso al regenerar.
  const r = vencimientosIca([muni({ icaPeriodicidad: 'anual' })], '9001234567');
  assert.deepEqual(r.vencimientos, []);
  assert.deepEqual(r.sinCalendario, [{ municipio: 'Bogotá, D.C.', departamento: 'Bogotá, D.C.', obligaciones: ['ICA'] }]);
});
