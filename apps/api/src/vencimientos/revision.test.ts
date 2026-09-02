// El valor de estas pruebas no es que el circuito avance, sino que NO avance
// donde no debe: la razón de ser de los dos revisores es que ningún impuesto se
// presente sin que alguien distinto del que lo liquidó lo haya mirado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transicion, puedePresentar, actorDe, EVENTO_DE, type EstadoRevision, type AccionRevision, type ActorRevision } from './revision.js';

const ESTADOS: EstadoRevision[] = ['sin_iniciar', 'en_proceso', 'en_revision', 'devuelto', 'aprobado'];
const ACCIONES: AccionRevision[] = ['iniciar', 'enviar', 'devolver', 'aprobar', 'reabrir'];
const ok = (d: EstadoRevision, a: AccionRevision, q: ActorRevision) => transicion(d, a, q).ok;

test('el camino normal llega hasta aprobado', () => {
  let e: EstadoRevision = 'sin_iniciar';
  for (const [accion, actor] of [['iniciar', 'asesor'], ['enviar', 'asesor'], ['aprobar', 'revisor']] as const) {
    const r = transicion(e, accion, actor);
    assert.ok(r.ok, `${accion} falló desde ${e}: ${r.ok ? '' : r.motivo}`);
    e = r.hasta;
  }
  assert.equal(e, 'aprobado');
});

test('devolver regresa al asesor y se puede reenviar sin pasos de más', () => {
  const dev = transicion('en_revision', 'devolver', 'revisor');
  assert.ok(dev.ok && dev.hasta === 'devuelto');
  // Corrige y reenvía directo: obligarlo a "iniciar" otra vez sería un clic
  // inútil en la mitad de un trabajo que ya venía hecho.
  assert.ok(ok('devuelto', 'enviar', 'asesor'));
});

test('el asesor no se aprueba a sí mismo', () => {
  // Es la regla que justifica todo el circuito.
  assert.equal(ok('en_revision', 'aprobar', 'asesor'), false);
  assert.equal(ok('en_revision', 'devolver', 'asesor'), false);
});

test('el revisor no liquida ni reabre', () => {
  assert.equal(ok('sin_iniciar', 'iniciar', 'revisor'), false);
  assert.equal(ok('en_proceso', 'enviar', 'revisor'), false);
  // Reabrir lo aprobado es de coordinación: si el revisor pudiera deshacer su
  // propia aprobación sin dejar rastro de nivel superior, el control se diluye.
  assert.equal(ok('aprobado', 'reabrir', 'revisor'), false);
  assert.ok(ok('aprobado', 'reabrir', 'coordinacion'));
});

test('no se aprueba lo que nadie mandó a revisión', () => {
  for (const e of ESTADOS.filter((x) => x !== 'en_revision')) {
    assert.equal(ok(e, 'aprobar', 'revisor'), false, `se aprobó desde ${e}`);
    assert.equal(ok(e, 'devolver', 'revisor'), false, `se devolvió desde ${e}`);
  }
});

test('lo aprobado no se reenvía ni se vuelve a trabajar sin reabrirlo', () => {
  assert.equal(ok('aprobado', 'enviar', 'asesor'), false);
  assert.equal(ok('aprobado', 'iniciar', 'asesor'), false);
});

test('nada avanza dos veces al mismo estado', () => {
  assert.equal(ok('en_revision', 'enviar', 'asesor'), false);
  assert.equal(ok('en_proceso', 'iniciar', 'asesor'), false);
});

test('presentar exige la aprobación del revisor', () => {
  for (const e of ESTADOS.filter((x) => x !== 'aprobado')) {
    assert.equal(puedePresentar(e, 'asesor').ok, false, `el asesor presentó estando ${e}`);
    assert.equal(puedePresentar(e, 'revisor').ok, false, `el revisor presentó estando ${e}`);
  }
  assert.ok(puedePresentar('aprobado', 'asesor').ok);
});

test('la coordinación puede presentar sin aprobación previa', () => {
  // Un revisor enfermo el día del vencimiento no puede ser motivo para no
  // presentar. Queda con su nombre, que es lo que separa una excepción de un
  // agujero.
  for (const e of ESTADOS) assert.ok(puedePresentar(e, 'coordinacion').ok, `coordinación bloqueada en ${e}`);
});

test('un revisor NO se aprueba su propio trabajo', () => {
  // Caso real: la misma persona es asesora de unos clientes y revisora de
  // otros. Sobre lo suyo actúa como asesora, aunque cargue el rol de Revisor.
  const suyo = actorDe({ esCoordinacion: false, esAsesorDelVencimiento: true, tieneRolRevisor: true });
  assert.equal(suyo, 'asesor');
  assert.equal(ok('en_revision', 'aprobar', suyo!), false);

  // Sobre lo ajeno sí revisa.
  const ajeno = actorDe({ esCoordinacion: false, esAsesorDelVencimiento: false, tieneRolRevisor: true });
  assert.equal(ajeno, 'revisor');
  assert.ok(ok('en_revision', 'aprobar', ajeno!));
});

test('quien no tiene nada que ver con el impuesto no es actor', () => {
  assert.equal(actorDe({ esCoordinacion: false, esAsesorDelVencimiento: false, tieneRolRevisor: false }), null);
});

test('cada acción tiene su tipo de evento para el rastro', () => {
  // Sin esto un paso del circuito no quedaría registrado, y el rastro es la
  // razón por la que se guarda todo: sin él no hay KPIs.
  for (const a of ACCIONES) assert.ok(EVENTO_DE[a], `falta el evento de ${a}`);
  assert.equal(new Set(Object.values(EVENTO_DE)).size, ACCIONES.length, 'dos acciones comparten tipo de evento');
});

test('los mensajes de error se entienden sin saber de programación', () => {
  const r = transicion('aprobado', 'enviar', 'asesor');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.motivo, /aprobado/);
    assert.doesNotMatch(r.motivo, /transici[oó]n|inv[aá]lid|state|null|undefined/i);
  }
});

// ---- Obligaciones de SOLO PRESENTACIÓN ----
// El asesor de nómina no podía marcar una PILA como presentada: le salía "El
// impuesto todavía no está aprobado por el revisor". Pero PILA no lleva valor a
// pagar — la propia ventana lo dice— así que no hay liquidación que revisar. El
// revisor existe para verificar una cifra antes de presentarla; sin cifra, el
// paso solo estorba y bloquea un vencimiento el día que hay que cumplirlo.

test('una obligación de solo presentación no espera al revisor', () => {
  for (const e of ESTADOS) {
    assert.ok(puedePresentar(e, 'asesor', true).ok, `el asesor quedó bloqueado en ${e}`);
  }
});

test('las que SÍ liquidan siguen exigiendo la aprobación', () => {
  // La excepción es por el tipo de obligación, no una puerta abierta: si esto
  // cediera, la revisión de IVA o retención dejaría de ser un control.
  for (const e of ESTADOS.filter((x) => x !== 'aprobado')) {
    assert.equal(puedePresentar(e, 'asesor', false).ok, false, `presentó un impuesto ${e} sin aprobar`);
    assert.equal(puedePresentar(e, 'asesor').ok, false, `por defecto (sin el parámetro) tampoco debe dejar: ${e}`);
  }
  assert.ok(puedePresentar('aprobado', 'asesor', false).ok);
});

test('el revisor tampoco necesita aprobarse las de solo presentación', () => {
  assert.ok(puedePresentar('sin_iniciar', 'revisor', true).ok);
});
