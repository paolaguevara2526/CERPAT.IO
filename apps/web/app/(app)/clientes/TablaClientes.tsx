'use client';
// Listado de clientes con el filtro y el orden estándar de la plataforma.
// Antes era la única tabla larga sin ninguna forma de filtrar: con ~90 empresas,
// encontrar una era bajar con la rueda del mouse.

import TablaDatos, { type Columna } from '@/app/_components/TablaDatos';

export type Empresa = {
  id: string; nombre: string; nit: string | null; tipo: string | null;
  servicio: string | null; asesorNombre: string | null; regimen: string | null;
};

const guion = (v: string | null) => (v && v.trim() ? v : '—');

const COLUMNAS: Columna<Empresa>[] = [
  { clave: 'nombre', label: 'Razón social', valor: (e) => e.nombre, buscar: true, estiloCelda: { fontWeight: 600 } },
  { clave: 'nit', label: 'NIT', valor: (e) => guion(e.nit), buscar: true, estiloCelda: { color: 'var(--muted)', fontFamily: 'var(--mono)' } },
  { clave: 'tipo', label: 'Tipo', valor: (e) => guion(e.tipo), estiloCelda: { color: 'var(--muted)' } },
  { clave: 'servicio', label: 'Servicio', valor: (e) => guion(e.servicio), estiloCelda: { color: 'var(--muted)' } },
  { clave: 'asesor', label: 'Asesor', valor: (e) => guion(e.asesorNombre), buscar: true, estiloCelda: { color: 'var(--muted)' } },
  { clave: 'regimen', label: 'Régimen', valor: (e) => guion(e.regimen), estiloCelda: { color: 'var(--muted)' } },
];

export default function TablaClientes({ empresas }: { empresas: Empresa[] }) {
  return (
    <TablaDatos
      filas={empresas}
      columnas={COLUMNAS}
      idDe={(e) => e.id}
      vacio="No hay empresas cargadas todavía."
      sinCoincidencias="Ninguna empresa cumple los filtros."
    />
  );
}
