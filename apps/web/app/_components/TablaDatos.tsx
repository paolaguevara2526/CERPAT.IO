'use client';
// Tabla de datos estándar: encabezado fijo, ordenar por columna y filtro de
// embudo tipo Excel, con el contador de "N de M" arriba.
//
// Nace de unificar los filtros: el embudo estaba copiado en seis vistas con
// pequeñas diferencias, y otras dos tablas —Clientes y Lista— no tenían filtro
// del todo. En vez de copiarlo una séptima vez, el patrón vive aquí. Una tabla
// nueva se declara con sus columnas y ya trae orden, filtro y contador.
//
// Recibe FILAS PLANAS: una vista de servidor puede pasarle sus datos sin
// convertirse en componente de cliente.

import { Fragment, useMemo, useState } from 'react';
import { descargarXlsx, hoyISO } from './exportar';
import FiltroColumna from './FiltroColumna';
import FiltrosActivos from './FiltrosActivos';
import { useOrden, ThOrden } from './orden';

export type Columna<T> = {
  clave: string;
  label: string;
  /** Texto de la celda; es también por lo que se filtra. */
  valor: (fila: T) => string;
  /** Solo si se ordena por algo distinto de lo que se muestra (p. ej. la fecha
   *  por su ISO, para que no ordene alfabéticamente). */
  orden?: (fila: T) => string | number;
  /** Celda a medida (chips, botones, enlaces). Si falta, se pinta `valor`. */
  render?: (fila: T) => React.ReactNode;
  /** Caja de búsqueda dentro del embudo: útil con muchos valores distintos. */
  buscar?: boolean;
  filtrable?: boolean;   // por defecto sí
  ordenable?: boolean;   // por defecto sí
  estilo?: React.CSSProperties;
  estiloCelda?: React.CSSProperties;
};

export default function TablaDatos<T>({
  filas, columnas, idDe, vacio = 'No hay datos.', sinCoincidencias = 'Ninguno cumple los filtros.', nota, acciones, exportar, detalle,
}: {
  filas: T[];
  columnas: Columna<T>[];
  idDe: (fila: T) => string;
  vacio?: React.ReactNode;
  sinCoincidencias?: React.ReactNode;
  /** Texto corto a la derecha del contador. */
  nota?: React.ReactNode;
  /** Columna final sin encabezado, para botones por fila. */
  acciones?: (fila: T) => React.ReactNode;
  /** Nombre base del Excel. Si se pasa, aparece el botón de descarga. */
  exportar?: string;
  /** Fila desplegable: si se pasa, cada fila se puede abrir y muestra esto
   *  debajo, a todo el ancho. Permite tablas con filtros Y detalle, que antes
   *  obligaba a escribir la tabla a mano y perder el embudo. */
  detalle?: (fila: T, cerrar: () => void) => React.ReactNode;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [filtros, setFiltros] = useState<Record<string, Set<string> | null>>({});
  const { orden, alternar, ordenar } = useOrden<string>();

  // Valores distintos por columna, para poblar cada embudo.
  const valores = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of columnas) {
      if (c.filtrable === false) continue;
      out[c.clave] = [...new Set(filas.map(c.valor))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    }
    return out;
  }, [filas, columnas]);

  const visibles = useMemo(() => {
    const filtradas = filas.filter((f) => columnas.every((c) => {
      const sel = filtros[c.clave];
      return sel == null || sel.has(c.valor(f));
    }));
    const claveOrden = (f: T, clave: string) => {
      const c = columnas.find((x) => x.clave === clave);
      if (!c) return '';
      return c.orden ? c.orden(f) : c.valor(f);
    };
    return ordenar(filtradas, claveOrden);
  }, [filas, columnas, filtros, ordenar]);

  const hayFiltro = Object.values(filtros).some((s) => s != null);
  const total = columnas.length + (acciones ? 1 : 0) + (detalle ? 1 : 0);

  // Baja lo que se está viendo: con los filtros puestos y en el orden actual.
  // Exportar siempre la tabla completa sería una trampa — quien acaba de filtrar
  // por un asesor espera ese recorte, no las 90 filas, y la diferencia no se ve
  // hasta que alguien trabaja sobre el archivo equivocado.
  async function bajar() {
    if (!exportar) return;
    setExportando(true);
    try {
      const encabezado = columnas.map((c) => c.label);
      const cuerpo = visibles.map((f) => columnas.map((c) => c.valor(f)));
      await descargarXlsx(`${exportar}-${hoyISO()}.xlsx`, [{ nombre: exportar.slice(0, 31), filas: [encabezado, ...cuerpo] }]);
    } finally { setExportando(false); }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {visibles.length}{hayFiltro ? ` de ${filas.length}` : ''} registro(s)
        </span>
        {hayFiltro && (
          <button className="dbtn" style={{ fontSize: 12 }} onClick={() => setFiltros({})}>Limpiar filtros</button>
        )}
        {exportar && (
          <button className="dbtn" style={{ fontSize: 12 }} onClick={bajar} disabled={exportando || visibles.length === 0}
            title={hayFiltro ? 'Descarga las filas que estás viendo, con los filtros puestos' : 'Descarga la tabla completa en Excel'}>
            {exportando ? 'Generando…' : `⬇ Descargar Excel${hayFiltro ? ` (${visibles.length})` : ''}`}
          </button>
        )}
        <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 'auto' }}>
          {nota ?? 'Clic en el título de la columna para ordenar · embudo ▼ para filtrar.'}
        </span>
      </div>

      {/* Qué embudos están puestos. Sin esto, desmarcar el último valor de una
          columna deja la tabla vacía sin ninguna pista de cuál fue. */}
      <FiltrosActivos
        filtros={columnas.filter((c) => c.filtrable !== false).map((c) => ({
          clave: c.clave, etiqueta: c.label,
          seleccion: filtros[c.clave] ?? null, total: (valores[c.clave] ?? []).length,
        }))}
        onQuitar={(clave) => setFiltros((f) => ({ ...f, [clave]: null }))}
        onQuitarTodos={() => setFiltros({})}
      />

      <div className="panel">
        <div className="dt-wrap dt-alta">
          <table className="dt">
            <thead>
              <tr>
                {columnas.map((c) => {
                  const embudo = c.filtrable === false ? undefined : (
                    <FiltroColumna
                      valores={valores[c.clave] ?? []}
                      seleccion={filtros[c.clave] ?? null}
                      onCambio={(s) => setFiltros((f) => ({ ...f, [c.clave]: s }))}
                      buscar={c.buscar}
                    />
                  );
                  if (c.ordenable === false) {
                    return <th key={c.clave} style={c.estilo}><span className="th-contenido">{c.label}{embudo}</span></th>;
                  }
                  return (
                    <ThOrden key={c.clave} col={c.clave} orden={orden} alternar={alternar} style={c.estilo} extra={embudo}>
                      {c.label}
                    </ThOrden>
                  );
                })}
                {acciones && <th style={{ width: 44 }} />}
                {detalle && <th style={{ width: 44 }} />}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={total} style={{ padding: 34, textAlign: 'center', color: 'var(--muted)' }}>{vacio}</td></tr>
              ) : visibles.length === 0 ? (
                <tr><td colSpan={total} style={{ padding: 34, textAlign: 'center', color: 'var(--muted)' }}>{sinCoincidencias}</td></tr>
              ) : visibles.map((f) => {
                const id = idDe(f);
                const activa = detalle != null && abierta === id;
                return (
                  <Fragment key={id}>
                    <tr style={activa ? { background: 'var(--panel-2)' } : undefined}>
                      {columnas.map((c) => (
                        <td key={c.clave} style={c.estiloCelda}>{c.render ? c.render(f) : c.valor(f)}</td>
                      ))}
                      {acciones && <td>{acciones(f)}</td>}
                      {detalle && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="dbtn" onClick={() => setAbierta(activa ? null : id)} style={{ fontSize: 12, padding: '4px 10px' }}>
                            {activa ? 'Cerrar' : 'Abrir'}
                          </button>
                        </td>
                      )}
                    </tr>
                    {activa && (
                      <tr>
                        <td colSpan={total} style={{ background: 'var(--panel-2)', padding: '4px 14px 16px' }}>
                          {detalle!(f, () => setAbierta(null))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
