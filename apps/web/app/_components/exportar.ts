// Exportar datos a un archivo Excel (.xlsx) desde el navegador.
// Usa SheetJS (xlsx), cargado dinámicamente para no engordar el bundle inicial.
// Cada "hoja" es una matriz de filas (la primera fila son los encabezados).
//
// Vive en _components porque lo usan tanto las pantallas de Administración como
// TablaDatos, que es de uso general: una tabla que se puede filtrar y ordenar
// pero no bajar obliga a copiar a mano lo que ya está en pantalla.

export type Hoja = { nombre: string; filas: (string | number)[][] };

// Limita el nombre de la hoja a lo que admite Excel (31 chars, sin : \ / ? * [ ]).
function nombreHojaValido(nombre: string): string {
  return (nombre || 'Hoja').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Hoja';
}

export async function descargarXlsx(archivo: string, hojas: Hoja[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(h.filas);
    XLSX.utils.book_append_sheet(wb, ws, nombreHojaValido(h.nombre));
  }
  XLSX.writeFile(wb, archivo);
}

// Fecha corta para nombrar los archivos (YYYY-MM-DD).
export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
