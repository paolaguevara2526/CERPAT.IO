// El calendario del asesor tiene que mostrar el cliente COMPLETO.
//
// El caso real: a Nicolás, asesor de NG Business Group, le salían los trece
// vencimientos del cliente en septiembre pero solo las visitas que él mismo
// tenía a su nombre. Con ese calendario no se le puede hacer seguimiento al
// cliente ni mandárselo: le falta la mitad del mes y no se nota que falta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtroAlcanceVisitas } from './alcance-lista.js';

test('quien ve toda la firma no lleva filtro', () => {
  // Administrador, Coordinador, Auditor, root: idsAsignadas en null.
  assert.deepEqual(filtroAlcanceVisitas(null, 'u1'), {});
});

test('el asesor ve las visitas de SUS clientes, no solo las suyas', () => {
  // Es el arreglo: antes esto era `{ responsableId: uid }` a secas y una visita
  // de un compañero al mismo cliente no aparecía.
  const f = filtroAlcanceVisitas(['ng', 'otra'], 'nico') as any;
  assert.deepEqual(f.OR[0], { empresaId: { in: ['ng', 'otra'] } });
});

test('y sigue viendo lo que está a su nombre aunque el cliente no sea suyo', () => {
  // Un reemplazo o un apoyo puntual: dejarlo fuera le escondería trabajo propio.
  const f = filtroAlcanceVisitas(['ng'], 'nico') as any;
  assert.deepEqual(f.OR[1], { responsableId: 'nico' });
});

test('sin clientes asignados solo ve lo suyo, no la firma entera', () => {
  // Falla cerrado: un asesor recién creado no destapa la cartera completa.
  const f = filtroAlcanceVisitas([], 'nuevo') as any;
  assert.deepEqual(f.OR, [{ empresaId: { in: [] } }, { responsableId: 'nuevo' }]);
});
