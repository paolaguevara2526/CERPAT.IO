// Cada norma con números concretos. Un umbral mal escrito aquí no se nota
// probando la aplicación —el resultado sigue "pareciendo razonable"— y termina
// en una declaración mal presentada. Por eso se fijan con casos exactos, y con
// los valores justo por encima y por debajo del tope.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obligacionesPorCifras, naturalezaDe, type ParametrosAnio } from './reglas.js';

// Valores de ejemplo, redondos para que las cuentas se puedan verificar a mano.
const P: ParametrosAnio = { anio: 2025, uvt: 50_000, smmlv: 1_400_000 };
const de = (clave: string, cifras: { activosBrutos?: number | null; ingresosBrutos?: number | null }, nat: 'juridica' | 'natural' | 'otra' = 'juridica') =>
  obligacionesPorCifras({ anio: 2025, activosBrutos: cifras.activosBrutos ?? null, ingresosBrutos: cifras.ingresosBrutos ?? null }, P, nat)
    .find((o) => o.clave === clave)!;

test('Art. 606 — firma de contador sobre 100.000 UVT, por activos o por ingresos', () => {
  const tope = 100_000 * P.uvt; // $5.000.000.000
  assert.equal(de('firma_contador', { ingresosBrutos: tope + 1 }).aplica, true);
  assert.equal(de('firma_contador', { activosBrutos: tope + 1 }).aplica, true);
  // El tope exacto NO supera: la norma dice "superiores a".
  assert.equal(de('firma_contador', { ingresosBrutos: tope }).aplica, false);
});

test('Ley 43/90 — revisor fiscal por activos (5.000) o ingresos (3.000) SMMLV', () => {
  assert.equal(de('revisor_fiscal', { activosBrutos: 5_000 * P.smmlv }).aplica, true, 'el tope exacto SÍ obliga ("iguales o superiores")');
  assert.equal(de('revisor_fiscal', { ingresosBrutos: 3_000 * P.smmlv }).aplica, true);
  assert.equal(de('revisor_fiscal', { activosBrutos: 5_000 * P.smmlv - 1, ingresosBrutos: 3_000 * P.smmlv - 1 }).aplica, false);
});

test('Ley 43/90 — no aplica a personas naturales', () => {
  const o = de('revisor_fiscal', { activosBrutos: 999_999_999_999 }, 'natural');
  assert.equal(o.aplica, false);
  assert.match(o.detalle, /sociedades comerciales/);
});

test('Art. 368-2 — solo personas naturales, sobre 30.000 UVT', () => {
  const tope = 30_000 * P.uvt;
  assert.equal(de('pn_agente_retencion', { ingresosBrutos: tope + 1 }, 'natural').aplica, true);
  assert.equal(de('pn_agente_retencion', { ingresosBrutos: tope }, 'natural').aplica, false);
  // Una sociedad no se evalúa por esta norma.
  assert.equal(de('pn_agente_retencion', { ingresosBrutos: tope + 1 }, 'juridica').aplica, false);
});

test('Art. 600 — IVA bimestral desde 92.000 UVT, cuatrimestral por debajo', () => {
  const tope = 92_000 * P.uvt;
  assert.equal(de('iva_periodicidad', { ingresosBrutos: tope }).sugerido, 'bimestral', '"iguales o superiores"');
  assert.equal(de('iva_periodicidad', { ingresosBrutos: tope - 1 }).sugerido, 'cuatrimestral');
});

test('Dto. 1998/2017 — conciliación fiscal desde 45.000 UVT', () => {
  const tope = 45_000 * P.uvt;
  assert.equal(de('conciliacion_fiscal', { ingresosBrutos: tope }).aplica, true);
  assert.equal(de('conciliacion_fiscal', { ingresosBrutos: tope - 1 }).aplica, false, 'exentos por debajo de 45.000 UVT');
});

test('Art. 905 — puede estar en RST por debajo de 100.000 UVT', () => {
  const tope = 100_000 * P.uvt;
  assert.equal(de('rst', { ingresosBrutos: tope - 1 }).aplica, true);
  assert.equal(de('rst', { ingresosBrutos: tope }).aplica, false, '"inferiores a"');
});

test('sin parámetros del año no se calcula: se dice que falta, no se inventa', () => {
  const os = obligacionesPorCifras({ anio: 2025, activosBrutos: 1e12, ingresosBrutos: 1e12 }, null, 'juridica');
  for (const o of os) {
    if (o.clave === 'revisor_fiscal' || o.clave === 'pn_agente_retencion') continue; // se descartan por naturaleza
    assert.equal(o.aplica, null, `${o.clave} no debería afirmar nada sin UVT/SMMLV`);
    assert.match(o.detalle, /falta/i);
  }
});

test('sin cifras tampoco se inventa', () => {
  const os = obligacionesPorCifras(null, P, 'juridica');
  assert.equal(os.find((o) => o.clave === 'firma_contador')!.aplica, null);
});

test('la naturaleza sale del tipo de empresa', () => {
  assert.equal(naturalezaDe('Persona Jurídica'), 'juridica');
  assert.equal(naturalezaDe('Consorcio o Unión Temporal'), 'juridica');
  assert.equal(naturalezaDe('Persona Natural'), 'natural');
  assert.equal(naturalezaDe(null), 'otra');
});
