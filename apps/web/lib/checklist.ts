// Progreso de un checklist con "no aplica".
//
// El porqué es de medición, no de pantalla: una empresa sin movimiento en el mes
// puede tener que hacer 2 de 13 puntos, y otra con operación los 13. Si las 11
// que no aplican cuentan en el total, la primera aparece siempre en 2/13 —
// incumpliendo— cuando en realidad terminó su trabajo.
//
// Por eso "no aplica" NO es un estado más: sale del denominador.
//
// Vive en un solo archivo porque lo usan el calendario, Mi Día y la cola de
// revisión. Tres copias de esta cuenta terminarían dando tres números distintos
// para el mismo checklist.

export type EstadoSubtarea = 'pendiente' | 'realizada' | 'no_aplica' | 'no_realizada';

export type Progreso = {
  /** Puntos marcados como realizados. */
  hechas: number;
  /** Puntos que sí había que hacer (total menos los que no aplican). */
  aplicables: number;
  noAplica: number;
  total: number;
  /** 0..100 sobre lo aplicable. Un checklist entero "no aplica" está completo. */
  pct: number;
  completo: boolean;
};

export function progresoChecklist(subs: { estado: string }[]): Progreso {
  const total = subs.length;
  const noAplica = subs.filter((s) => s.estado === 'no_aplica').length;
  const hechas = subs.filter((s) => s.estado === 'realizada').length;
  const aplicables = total - noAplica;
  // Si TODO no aplica, el trabajo está hecho: no hay nada que hacer. Devolver 0 %
  // lo mostraría como incumplido, que es justo el error que esto viene a corregir.
  const pct = aplicables === 0 ? (total > 0 ? 100 : 0) : Math.round((hechas / aplicables) * 100);
  return { hechas, aplicables, noAplica, total, pct, completo: hechas >= aplicables };
}

/** Etiqueta corta para mostrar: "10/11 · 2 n/a". */
export function etiquetaProgreso(p: Progreso): string {
  return etiquetaDeConteos(p.hechas, p.aplicables, p.total);
}

/** Igual, pero desde conteos sueltos (las tablas los reciben ya sumados). */
export function etiquetaDeConteos(hechas: number, aplicables: number, total: number): string {
  const noAplica = total - aplicables;
  return noAplica > 0 ? `${hechas}/${aplicables} · ${noAplica} n/a` : `${hechas}/${total}`;
}

// Ciclo de un clic: pendiente → realizada → no aplica → pendiente.
//
// Se prefirió un solo control que gira, y no tres botones por línea: el checklist
// tiene trece puntos y treinta y nueve controles en un modal no se leen. El caso
// de todos los días es marcar hecho, y ese sigue siendo un clic.
const CICLO: Record<string, EstadoSubtarea> = {
  pendiente: 'realizada',
  realizada: 'no_aplica',
  no_aplica: 'pendiente',
  no_realizada: 'pendiente',
};
export const siguienteEstado = (actual: string): EstadoSubtarea => CICLO[actual] ?? 'realizada';

/** Cómo se pinta cada estado en el checklist. */
export const ASPECTO: Record<string, { marca: string; color: string; borde: string; fondo: string; tacha: boolean; titulo: string }> = {
  pendiente: { marca: '', color: 'var(--ink)', borde: 'var(--edge-strong)', fondo: 'transparent', tacha: false, titulo: 'Pendiente — clic para marcar como realizada' },
  realizada: { marca: '✓', color: 'var(--muted)', borde: 'var(--exito)', fondo: 'var(--exito)', tacha: true, titulo: 'Realizada — clic para marcar como "no aplica"' },
  no_aplica: { marca: '–', color: 'var(--muted)', borde: 'var(--neutro)', fondo: 'var(--neutro)', tacha: false, titulo: 'No aplica — no cuenta para la medición. Clic para volver a pendiente' },
  no_realizada: { marca: '✕', color: 'var(--peligro-fuerte)', borde: 'var(--peligro)', fondo: 'var(--peligro)', tacha: false, titulo: 'No realizada — clic para volver a pendiente' },
};
