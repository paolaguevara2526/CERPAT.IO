// Utilidades de exportación de Administración.
//
// `descargarXlsx` y `hoyISO` viven ahora en _components/exportar, porque también
// los usa TablaDatos. Se reexportan para no tocar las pantallas que ya los
// importaban desde aquí.

export { descargarXlsx, hoyISO, type Hoja } from '@/app/_components/exportar';

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
