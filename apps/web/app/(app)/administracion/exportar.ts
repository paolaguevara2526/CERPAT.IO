// Utilidad para exportar datos a un archivo Excel (.xlsx) desde el navegador.
// Usa SheetJS (xlsx), cargado dinámicamente para no engordar el bundle inicial.
// Cada "hoja" es una matriz de filas (la primera fila son los encabezados).

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

// Ejecuta tareas asíncronas con concurrencia limitada (para no saturar la API
// al pedir el plan de muchos clientes a la vez). Devuelve los resultados en orden.
export async function enLotes<T, R>(
  items: T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;
  async function trabajador(): Promise<void> {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(limite, items.length));
  await Promise.all(Array.from({ length: n }, () => trabajador()));
  return resultados;
}
