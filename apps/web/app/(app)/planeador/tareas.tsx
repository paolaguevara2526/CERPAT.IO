// Utilidades de servidor de las vistas de tareas (Lista, Mi Día, Tablero).
// Los tipos y catálogos viven en ./tareas-datos, que no depende del servidor y
// por eso lo pueden importar también los componentes de cliente.

import { apiFetch } from '@/lib/session';
import TareasTablaCliente from './TareasTablaCliente';
import type { Tarea, TareasResp } from './tareas-datos';

export { ESTADO_META, AREAS, nombrePeriodo } from './tareas-datos';
export type { Tarea, TareasResp } from './tareas-datos';

export async function fetchTareas(qs: string): Promise<{ data: TareasResp | null; error: string | null }> {
  try {
    const res = await apiFetch(`/plan/tareas${qs ? `?${qs}` : ''}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as TareasResp, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

export function TareasTabla({ tareas, mostrarAsesor = true, gestionable = false }: {
  tareas: Tarea[]; mostrarAsesor?: boolean; gestionable?: boolean;
}) {
  return <TareasTablaCliente tareas={tareas} mostrarAsesor={mostrarAsesor} gestionable={gestionable} />;
}
