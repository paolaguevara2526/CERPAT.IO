// Exportar datos a un archivo Excel (.xlsx) desde el navegador.
// Usa SheetJS (xlsx), cargado dinámicamente para no engordar el bundle inicial.
// Cada "hoja" es una matriz de filas (la primera fila son los encabezados).
//
// Vive en _components porque lo usan tanto las pantallas de Administración como
// TablaDatos, que es de uso general: una tabla que se puede filtrar y ordenar
// pero no bajar obliga a copiar a mano lo que ya está en pantalla.

// Una celda puede ser texto, número o FECHA. La fecha va como `Date` a propósito:
// si se manda ya formateada ("21 ago 2026") Excel la recibe como texto y deja de
// ordenar y de filtrar por rango, que es justo para lo que se baja un listado de
// vencimientos. `null` deja la celda vacía, que se lee mejor que un "—".
export type Celda = string | number | Date | null;
export type Hoja = { nombre: string; filas: Celda[][] };

// Limita el nombre de la hoja a lo que admite Excel (31 chars, sin : \ / ? * [ ]).
function nombreHojaValido(nombre: string): string {
  return (nombre || 'Hoja').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Hoja';
}

// Día "cero" del calendario de Excel: sus números de serie cuentan días desde el
// 30 de diciembre de 1899.
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);
/** Formato con el que Excel pinta las celdas de fecha del archivo. */
export const FORMATO_FECHA_XLSX = 'dd/mm/yyyy';

/**
 * Un día calendario como número de serie de Excel.
 *
 * Se toman las partes LOCALES de la fecha y se rearman en UTC. Así el resultado
 * es un entero exacto y no depende de la zona horaria de quien baja el archivo,
 * que es justo donde estaba el error: pasarle el `Date` a la librería la hacía
 * convertirlo con el huso del navegador y en Colombia (UTC-5) todas las fechas
 * salían **un día antes** — el 7 de septiembre se veía como el 6. En pantalla
 * estaba bien; solo el archivo mentía, que es la peor forma de fallar porque el
 * archivo es el que se manda al cliente.
 */
export function serialExcel(f: Date): number {
  const utc = Date.UTC(f.getFullYear(), f.getMonth(), f.getDate());
  return Math.round((utc - EPOCA_EXCEL) / 86400000);
}

export async function descargarXlsx(archivo: string, hojas: Hoja[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    // Las fechas NO viajan como Date: se convierten aquí a número de serie y se
    // les pone el formato de fecha. Dejar que la librería convierta el Date es
    // lo que corría el día (ver serialExcel).
    const esFecha: [number, number][] = [];
    const filas = h.filas.map((fila, r) => fila.map((celda, c) => {
      if (celda instanceof Date) { esFecha.push([r, c]); return serialExcel(celda); }
      return celda;
    }));
    const ws = XLSX.utils.aoa_to_sheet(filas);
    for (const [r, c] of esFecha) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref];
      if (cell) { cell.t = 'n'; cell.z = FORMATO_FECHA_XLSX; }
    }
    XLSX.utils.book_append_sheet(wb, ws, nombreHojaValido(h.nombre));
  }
  XLSX.writeFile(wb, archivo);
}

// Un día calendario ("2026-08-21") como Date, para una celda de fecha de Excel.
//
// Se arma desde las PARTES y no con `new Date(iso)`: esa forma lee la cadena
// como UTC y, en Colombia (UTC-5), el 21 de agosto se muestra como el 20 — el
// mismo corrimiento de un día que ya nos costó una corrección en el resto de la
// aplicación (ver lib/fechas.ts).
//
// Devuelve null si la fecha no se puede leer: una celda vacía es honesta, una
// fecha inventada no.
export function diaComoFecha(iso: string | null | undefined): Date | null {
  const [y, m, d] = (iso ?? '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const f = new Date(y, m - 1, d);
  // Round-trip: descarta un 31 de febrero, que JS convertiría en marzo.
  if (isNaN(f.getTime()) || f.getFullYear() !== y || f.getMonth() !== m - 1 || f.getDate() !== d) return null;
  return f;
}

// Fecha corta para nombrar los archivos (YYYY-MM-DD).
export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
