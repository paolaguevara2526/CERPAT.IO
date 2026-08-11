'use client';
// Listado de clientes con el filtro y el orden estándar de la plataforma.
// Antes era la única tabla larga sin ninguna forma de filtrar: con ~90 empresas,
// encontrar una era bajar con la rueda del mouse.

import TablaDatos, { type Columna } from '@/app/_components/TablaDatos';

export type Empresa = {
  id: string; nombre: string; nit: string | null; tipo: string | null;
  servicio: string | null; asesorNombre: string | null; regimen: string | null;
  /** Asesor por área, desde Asignaciones. Puede haber más de uno. */
  asignaciones: { area: string; asesor: string }[];
};

const guion = (v: string | null) => (v && v.trim() ? v : '—');

// El asesor sale de ASIGNACIONES, que es donde la coordinación reparte el trabajo.
// `asesorNombre` es un texto suelto de la importación que nadie mantiene: se deja
// como respaldo, pero marcado, para no dar por asignado a quien no lo está.
const asesoresDe = (e: Empresa) => [...new Set(e.asignaciones.map((a) => a.asesor))].sort((a, b) => a.localeCompare(b, 'es'));

function CeldaAsesor({ e }: { e: Empresa }) {
  const asesores = asesoresDe(e);
  if (asesores.length > 0) {
    const detalle = e.asignaciones.map((a) => `${a.area}: ${a.asesor}`).join('\n');
    return (
      <span title={detalle} style={{ color: 'var(--ink)' }}>
        {asesores[0]}
        {asesores.length > 1 && <span style={{ color: 'var(--muted)', fontWeight: 600 }}> +{asesores.length - 1}</span>}
      </span>
    );
  }
  if (e.asesorNombre?.trim()) {
    return (
      <span title="Del registro del cliente, no de Asignaciones. Asígnalo por área para que quede trazable." style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
        {e.asesorNombre}
      </span>
    );
  }
  return <span style={{ color: 'var(--alerta-fuerte)', fontWeight: 700 }}>sin asignar</span>;
}

const COLUMNAS: Columna<Empresa>[] = [
  {
    clave: 'nombre', label: 'Razón social', valor: (e) => e.nombre, buscar: true, estiloCelda: { fontWeight: 600 },
    // El nombre lleva a la hoja de vida del cliente.
    render: (e) => <a href={`/clientes/${e.id}`} style={{ color: 'var(--navy)', textDecoration: 'none' }}>{e.nombre}</a>,
  },
  { clave: 'nit', label: 'NIT', valor: (e) => guion(e.nit), buscar: true, estiloCelda: { color: 'var(--muted)', fontFamily: 'var(--mono)' } },
  {
    // Sin tipo no se puede saber la naturaleza jurídica, y de ella dependen el
    // RUB, el revisor fiscal y el 368-2. No es un guion más: se marca, y el
    // nombre del cliente lleva a su ficha, que es donde se arregla.
    clave: 'tipo', label: 'Tipo', valor: (e) => (e.tipo?.trim() ? e.tipo : 'sin tipo'),
    estiloCelda: { color: 'var(--muted)' },
    render: (e) => (e.tipo?.trim()
      ? <span style={{ color: 'var(--muted)' }}>{e.tipo}</span>
      : <span style={{ color: 'var(--peligro)', fontWeight: 700 }}>sin tipo</span>),
  },
  { clave: 'servicio', label: 'Servicio', valor: (e) => guion(e.servicio), estiloCelda: { color: 'var(--muted)' } },
  {
    clave: 'asesor', label: 'Asesor', buscar: true,
    // El valor que se busca, ordena y filtra es el mismo que se ve: si el embudo
    // ofreciera el texto viejo y la celda mostrara el de Asignaciones, filtrar
    // por un asesor dejaría fuera clientes que sí son suyos.
    valor: (e) => {
      const a = asesoresDe(e);
      return a.length > 0 ? a.join(', ') : (e.asesorNombre?.trim() || 'sin asignar');
    },
    render: (e) => <CeldaAsesor e={e} />,
  },
  { clave: 'regimen', label: 'Régimen', valor: (e) => guion(e.regimen), estiloCelda: { color: 'var(--muted)' } },
];

// `puedeExportar` lo decide el servidor por rol: la descarga del listado se
// lleva la cartera entera en un archivo, y eso es información de la dirección.
// Un asesor consulta sus clientes en pantalla; no se lleva la base.
export default function TablaClientes({ empresas, puedeExportar = false }: { empresas: Empresa[]; puedeExportar?: boolean }) {
  return (
    <TablaDatos
      filas={empresas}
      columnas={COLUMNAS}
      idDe={(e) => e.id}
      vacio="No hay empresas cargadas todavía."
      sinCoincidencias="Ninguna empresa cumple los filtros."
      exportar={puedeExportar ? 'clientes-cerpat' : undefined}
    />
  );
}
