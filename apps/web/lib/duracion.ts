// apps/web/lib/duracion.ts
// Cuánto duró una visita: de la hora de entrada a la de salida.
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

/**
 * Minutos entre entrada y salida. null si falta alguna o no se puede calcular.
 *
 * Si la salida es MENOR que la entrada se devuelve null, no un número negativo
 * ni una vuelta al día siguiente: una visita que empieza a las 3 p. m. y
 * "termina" a las 9 a. m. es un dato mal escrito, y presentarlo como 18 horas
 * de trabajo sería peor que no mostrar nada. Quien lo vea en blanco corrige la
 * hora; quien vea 18 horas puede facturarlas.
 */
export function duracionEnMinutos(entrada: string | null | undefined, salida: string | null | undefined): number | null {
  const a = minutosDeHora(entrada);
  const b = minutosDeHora(salida);
  if (a == null || b == null) return null;
  const d = b - a;
  return d >= 0 ? d : null;
}

/** "2 h 30 min" · "45 min" · "3 h". Vacío si no hay duración. */
export function duracionTexto(entrada: string | null | undefined, salida: string | null | undefined): string {
  const total = duracionEnMinutos(entrada, salida);
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
export function duracionEnHoras(entrada: string | null | undefined, salida: string | null | undefined): number | null {
  const total = duracionEnMinutos(entrada, salida);
  return total == null ? null : Math.round((total / 60) * 100) / 100;
}
