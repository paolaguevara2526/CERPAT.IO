// Tipos y catálogos de las tareas del planeador, SIN dependencias de servidor.
//
// Vive aparte de tareas.tsx porque ese archivo importa lib/session (que lee la
// cookie con next/headers y solo funciona en el servidor). Un componente de
// cliente que necesite el tipo o los estados importa de aquí y no arrastra el
// módulo de servidor consigo.

export type Tarea = {
  id: string; titulo: string; estado: string; prioridad: string; auditoria: string;
  fechaVencimiento: string; periodo: string | null;
  empresa: string | null; area: string | null; asesor: string | null; auxiliar: string | null;
  fase?: string | null; bloqueada?: boolean;
};

export type TareasResp = {
  periodo: string | null; total: number;
  page?: number; pageSize?: number; totalPaginas?: number; tareas: Tarea[];
};

export const ESTADO_META: Record<string, { label: string; color: string }> = {
  por_iniciar: { label: 'Por iniciar', color: 'var(--muted)' },
  en_curso: { label: 'En curso', color: 'var(--info)' },
  en_revision: { label: 'En revisión', color: 'var(--alerta)' },
  terminado: { label: 'Terminado', color: 'var(--exito)' },
  auditado: { label: 'Auditado', color: 'var(--green-edge)' },
  no_realizado: { label: 'No realizado', color: 'var(--peligro)' },
};

export const AREAS = ['Impuestos', 'Informes', 'Cumplimiento', 'Nómina', 'Tesorería'];

export function nombrePeriodo(periodo: string | null): string {
  if (!periodo) return '';
  const [y, m] = periodo.split('-').map(Number);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${meses[(m - 1) % 12]} ${y}`;
}
