// Qué cuenta y qué no cuenta al medir el cumplimiento de un período.
//
// La distinción que da sentido a todo esto: "no realizado" es trabajo que se
// debía hacer y no se hizo —cuenta en contra— y "no aplica" es trabajo que ese
// cliente no tenía ese mes: una empresa sin movimiento no tiene anticipos que
// verificar. Meterlos en el mismo saco castiga al equipo por una actividad que
// nunca existió.
//
// Es la misma regla que ya rige en los checklists de vencimientos: lo que no
// aplica sale del denominador.

import { estaVencido } from './dia-calendario.js';

/** Estados que cuentan como trabajo hecho. */
export const EJECUTADA = ['terminado', 'auditado'];

/** Estado que sale de la medición: ni numerador ni denominador. */
export const NO_CUENTA = 'no_aplica';

export type TareaMedible = { estado: string; fechaVencimiento: Date | string };

/** ¿Esta tarea entra en la medición del período? */
export const cuenta = (estado: string): boolean => estado !== NO_CUENTA;

/** Cumplimiento del período: ejecutadas sobre las que sí aplicaban. */
export function cumplimiento(tareas: TareaMedible[]): { total: number; ejecutadas: number; vencidas: number; pct: number } {
  let total = 0, ejecutadas = 0, vencidas = 0;
  for (const t of tareas) {
    if (!cuenta(t.estado)) continue;
    total++;
    const esEjec = EJECUTADA.includes(t.estado);
    if (esEjec) ejecutadas++;
    else if (estaVencido(t.fechaVencimiento)) vencidas++;
  }
  // Sin actividades aplicables no hay nada que reprochar: 100%, no 0%. Un
  // cliente al que este mes no le aplicaba nada no está incumpliendo.
  return { total, ejecutadas, vencidas, pct: total === 0 ? 100 : Math.round((ejecutadas / total) * 100) };
}
