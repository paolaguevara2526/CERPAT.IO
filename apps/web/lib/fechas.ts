// Cómo se muestran las fechas. Hay dos clases y confundirlas corre un día.
//
// DÍA DE CALENDARIO — un vencimiento, el día en que llegó el insumo, el plazo
// de un hallazgo. "El 13 de agosto" es el 13 para todo el mundo: no depende de
// la hora ni del huso de quien mira. Se guardan a medianoche UTC.
//
// INSTANTE — cuándo se creó un registro, cuándo se cerró una novedad. Ahí sí
// importa la hora local de quien lo mira.
//
// El error que esto viene a cerrar: los días de calendario se mostraban con
// `new Date(iso).toLocaleDateString(...)`, que pasa la medianoche UTC a hora de
// Colombia (UTC−5) y la deja en las 7 p. m. del día ANTERIOR. Un ReteICA que
// vence el 13 aparecía "12 de ago" en Mi Día, mientras el calendario —que sí lo
// hacía bien— lo mostraba el 13. Dos pantallas, dos fechas, el mismo dato.
//
// La forma segura es no dejar que Date interprete la cadena: se toma la parte
// del día tal como viene escrita y se arma la fecha con esos números.

const OPCIONES_CORTAS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };

/**
 * Un día del calendario, tal como fue escrito. Acepta "2026-08-13" y
 * "2026-08-13T00:00:00.000Z" por igual y muestra el mismo día en los dos casos.
 */
export function fmtDia(iso: string | null | undefined, opciones?: Intl.DateTimeFormatOptions): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '—';
  // Se construye con los números, no con la cadena: así ninguna conversión de
  // huso puede correr el día.
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', opciones ?? OPCIONES_CORTAS);
}

/** Un instante (creación, cierre): sí se muestra en la hora de quien mira. */
export function fmtInstante(iso: string | null | undefined, opciones?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', opciones ?? OPCIONES_CORTAS);
}

/** "YYYY-MM-DD" de un valor guardado, para un <input type="date">. */
export const diaISO = (iso: string | null | undefined): string => String(iso ?? '').slice(0, 10);
