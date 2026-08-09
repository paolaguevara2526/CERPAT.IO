'use client';
// Ordenar tablas por columna. Las tablas son el corazón de la operación
// (vencimientos, pagos, tareas) y no se podían ordenar: para saber "qué vence
// primero" o "quién debe más" tocaba leer fila por fila.
//
// Uso en una tabla:
//   const { orden, alternar, ordenar } = useOrden<Col>({ col: 'vence', asc: true });
//   <ThOrden col="vence" orden={orden} alternar={alternar}>Vence</ThOrden>
//   const filas = ordenar(filtradas, claveDe);   // claveDe(fila, col) => string | number
//
// El ciclo del clic es ascendente → descendente → sin orden, para poder volver
// al orden natural que trae el servidor sin recargar.

import { useCallback, useMemo, useState } from 'react';

export type Orden<C extends string> = { col: C; asc: boolean } | null;

// Compara respetando el tipo: los números como números y el texto en español
// (para que "Ñ" y los acentos queden donde un contador espera verlos).
function comparar(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const vacioA = a === null || a === undefined || a === '';
  const vacioB = b === null || b === undefined || b === '';
  if (vacioA && vacioB) return 0;
  if (vacioA) return 1;   // los vacíos siempre al final, sin importar la dirección
  if (vacioB) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

export function useOrden<C extends string>(inicial: Orden<C> = null) {
  const [orden, setOrden] = useState<Orden<C>>(inicial);

  const alternar = useCallback((col: C) => {
    setOrden((o) => (o?.col !== col ? { col, asc: true } : o.asc ? { col, asc: false } : null));
  }, []);

  // Ordena una copia: nunca muta la lista original.
  const ordenar = useCallback(
    <T,>(filas: T[], claveDe: (fila: T, col: C) => string | number | null | undefined): T[] => {
      if (!orden) return filas;
      const signo = orden.asc ? 1 : -1;
      return [...filas].sort((x, y) => signo * comparar(claveDe(x, orden.col), claveDe(y, orden.col)));
    },
    [orden],
  );

  return useMemo(() => ({ orden, alternar, ordenar }), [orden, alternar, ordenar]);
}

export function ThOrden<C extends string>({
  col, orden, alternar, children, style, extra,
}: {
  col: C;
  orden: Orden<C>;
  alternar: (col: C) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  extra?: React.ReactNode; // p. ej. el embudo de filtro, que va fuera del botón
}) {
  const activa = orden?.col === col;
  const dir = !activa ? 'none' : orden.asc ? 'ascending' : 'descending';
  return (
    <th style={style} aria-sort={dir}>
      <span className="th-contenido">
        <button
          type="button"
          className={activa ? 'th-orden activa' : 'th-orden'}
          onClick={() => alternar(col)}
          title={!activa ? 'Ordenar' : orden.asc ? 'Ordenar al revés' : 'Quitar el orden'}
        >
          {children}
          <span className="th-flecha" aria-hidden="true">{!activa ? '↕' : orden.asc ? '↑' : '↓'}</span>
        </button>
        {extra}
      </span>
    </th>
  );
}
