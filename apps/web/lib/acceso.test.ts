// Tests de la matriz de acceso por rol al Planeador (menú + guardas de URL). Si un
// cambio deja ver a un rol algo que no le corresponde, estos tests fallan.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeVerRuta } from './acceso';

const rol = (r: string) => ({ esRoot: false, roles: [r] });
const admin = { esRoot: false, roles: ['Administrador'] };
const root = { esRoot: true, roles: [] };

// Rutas que cada rol DEBE ver y las que NO.
//
// Sobre /clientes (hoja de vida): la ven Administración, Coordinación y Asesores.
// El Auxiliar NO — es deliberado: la ficha incluye datos de identificación y, más
// adelante, cifras financieras del cliente.
const CASOS: { rol: string; ve: string[]; noVe: string[] }[] = [
  {
    rol: 'Auxiliar',
    ve: ['/planeador', '/planeador/mi-dia', '/planeador/calendario', '/planeador/tablero', '/planeador/lista', '/planeador/asignaciones', '/servicios/retenciones', '/servicios/punto-equilibrio', '/herramientas'],
    noVe: ['/planeador/visitas', '/planeador/pagos', '/vencimientos', '/planeador/auditoria', '/planeador/cronograma', '/planeador/flujo', '/coordinacion', '/clientes', '/usuarios', '/administracion', '/hallazgos'],
  },
  {
    rol: 'Asesor',
    // /clientes: consulta la hoja de vida de sus clientes (la edición la
    // restringe el backend a Administración y Coordinación).
    ve: ['/planeador/visitas', '/planeador/pagos', '/planeador/tablero', '/clientes'],
    noVe: ['/vencimientos', '/planeador/auditoria', '/planeador/cronograma', '/planeador/flujo', '/coordinacion', '/usuarios', '/hallazgos'],
  },
  {
    rol: 'Coordinador',
    // /usuarios en modo acotado: reparte roles (quién revisa impuestos, por
    // ejemplo) sin esperar al Administrador. Crear, eliminar, desactivar y
    // restablecer claves siguen siendo del Administrador — lo bloquean la
    // pantalla y el backend, no esta matriz.
    ve: ['/planeador/visitas', '/planeador/pagos', '/vencimientos', '/planeador/auditoria', '/planeador/cronograma', '/planeador/flujo', '/coordinacion', '/administracion', '/clientes', '/usuarios', '/planeador/revision'],
    noVe: ['/hallazgos'],
  },
  {
    rol: 'Auditor',
    ve: ['/planeador/visitas', '/vencimientos', '/planeador/auditoria', '/planeador/cronograma', '/coordinacion', '/hallazgos'],
    noVe: ['/clientes', '/usuarios', '/administracion', '/planeador/revision'],
  },
  {
    // Revisa los impuestos que el asesor liquida, antes de presentarlos. No es
    // Auditor: no entra al Portal de Hallazgos ni a la auditoría del plan.
    rol: 'Revisor',
    ve: ['/planeador/mi-dia', '/planeador/revision', '/planeador/calendario', '/planeador/tablero'],
    noVe: ['/hallazgos', '/planeador/auditoria', '/vencimientos', '/administracion', '/usuarios', '/coordinacion'],
  },
];

for (const c of CASOS) {
  test(`${c.rol} ve lo permitido`, () => {
    for (const ruta of c.ve) assert.equal(puedeVerRuta(rol(c.rol), ruta), true, `${c.rol} debería ver ${ruta}`);
  });
  test(`${c.rol} NO ve lo restringido`, () => {
    for (const ruta of c.noVe) assert.equal(puedeVerRuta(rol(c.rol), ruta), false, `${c.rol} NO debería ver ${ruta}`);
  });
}

test('Administrador y root ven todo (incluye Gestión)', () => {
  for (const u of [admin, root]) {
    for (const ruta of ['/clientes', '/usuarios', '/administracion', '/hallazgos', '/vencimientos', '/planeador/cronograma']) {
      assert.equal(puedeVerRuta(u, ruta), true, `admin/root debería ver ${ruta}`);
    }
  }
});

test('la cola de revisión no la ve el Asesor ni el Auxiliar', () => {
  // Un asesor ahí vería el trabajo de sus compañeros esperando visto bueno.
  // Y ningún rol operativo puede aprobar: para eso está el Revisor.
  assert.equal(puedeVerRuta(rol('Asesor'), '/planeador/revision'), false);
  assert.equal(puedeVerRuta(rol('Auxiliar'), '/planeador/revision'), false);
  assert.equal(puedeVerRuta(rol('Revisor'), '/planeador/revision'), true);
  assert.equal(puedeVerRuta(rol('Coordinador'), '/planeador/revision'), true);
});

test('Revisor y Auditor no se heredan permisos entre sí', () => {
  // Son dos trabajos distintos; el día que alguien los junte, esto falla.
  assert.equal(puedeVerRuta(rol('Revisor'), '/hallazgos'), false);
  assert.equal(puedeVerRuta(rol('Auditor'), '/planeador/revision'), false);
});

test('Portal de Hallazgos: solo Auditor (y admin), no Coordinador', () => {
  assert.equal(puedeVerRuta(rol('Auditor'), '/hallazgos'), true);
  assert.equal(puedeVerRuta(rol('Coordinador'), '/hallazgos'), false);
  assert.equal(puedeVerRuta(rol('Asesor'), '/hallazgos'), false);
});
