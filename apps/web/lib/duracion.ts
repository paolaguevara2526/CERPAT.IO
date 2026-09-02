// apps/web/lib/duracion.ts
// Cuánto se TRABAJÓ en una visita: de la hora de entrada a la de salida, menos
// el almuerzo. En una visita de todo el día son 8 horas de presencia contra 7 de
// trabajo, y esa hora se factura: por eso el descuento no es un detalle.
//
// El acta registraba solo la hora de ingreso, así que no había forma de saber
// cuánto tiempo se le dedica a cada cliente en sitio — que es justo lo que la
// firma necesita para cobrar y para repartir la agenda.
//
// Las horas se guardan como texto "HH:MM" (lo que entrega un <input type="time">)
// y no como instantes: una visita ocurre en un día y a una hora locales, y
// convertirlas a UTC solo abre la puerta al corrimiento que ya nos costó
// correcciones en fechas y en el Excel.

/** Minutos desde medianoche de un "HH:MM". null si no es una hora válida. */
export function minutosDeHora(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos de descanso que se descuentan. Un valor raro o negativo vale 0. */
export function minutosDeAlmuerzo(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (n == null || !isFinite(n as number) || (n as number) <= 0) return 0;
  return Math.floor(n as number);
}

/**
 * Minutos TRABAJADOS entre entrada y salida, descontando el almuerzo.
 *
 * null si falta alguna hora o si el dato no cuadra:
 *
 * - Salida MENOR que la entrada → null, no un número negativo ni una vuelta al
 *   día siguiente. Una visita que empieza a las 3 p. m. y "termina" a las 9 a. m.
 *   es un dato mal escrito, y presentarlo como 18 horas sería peor que no
 *   mostrar nada. Quien lo vea en blanco corrige la hora; quien vea 18 horas
 *   puede facturarlas.
 * - Almuerzo MAYOR que la visita entera → null por lo mismo: 8 horas de
 *   descanso en una visita de 2 no es un cero, es un error de digitación, y
 *   mostrarlo como cero lo escondería.
 *
 * Que el almuerzo se descuente es la diferencia entre horas de presencia y
 * horas de trabajo. En una visita de todo el día son 8 h contra 7, y esa hora
 * se factura.
 */
export function duracionEnMinutos(
  entrada: string | null | undefined,
  salida: string | null | undefined,
  almuerzo: number | string | null | undefined = 0,
): number | null {
  const a = minutosDeHora(entrada);
  const b = minutosDeHora(salida);
  if (a == null || b == null) return null;
  const bruto = b - a;
  if (bruto < 0) return null;
  const pausa = minutosDeAlmuerzo(almuerzo);
  if (pausa > bruto) return null;
  return bruto - pausa;
}

/** Minutos de presencia, SIN descontar el almuerzo (de entrada a salida). */
export function duracionBrutaEnMinutos(entrada: string | null | undefined, salida: string | null | undefined): number | null {
  return duracionEnMinutos(entrada, salida, 0);
}

/** "2 h 30 min" · "45 min" · "3 h". Vacío si no hay duración. */
export function duracionTexto(entrada: string | null | undefined, salida: string | null | undefined, almuerzo: number | string | null | undefined = 0): string {
  const total = duracionEnMinutos(entrada, salida, almuerzo);
  if (total == null) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h && !m) return '0 min';
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

/**
 * Duración en HORAS decimales, para sumar y facturar: 2,5 = dos horas y media.
 *
 * Redondeada a dos decimales; sin eso, sumar muchas visitas de 20 minutos
 * arrastra el error de 0,333… y el total deja de cuadrar con lo que muestra
 * cada acta.
 */
export function duracionEnHoras(entrada: string | null | undefined, salida: string | null | undefined, almuerzo: number | string | null | undefined = 0): number | null {
  const total = duracionEnMinutos(entrada, salida, almuerzo);
  return total == null ? null : Math.round((total / 60) * 100) / 100;
}

/** "1 h" · "45 min" para mostrar el descanso descontado. Vacío si no hubo. */
export function almuerzoTexto(almuerzo: number | string | null | undefined): string {
  const m = minutosDeAlmuerzo(almuerzo);
  if (!m) return '';
  const h = Math.floor(m / 60), r = m % 60;
  return [h ? `${h} h` : '', r ? `${r} min` : ''].filter(Boolean).join(' ');
}
