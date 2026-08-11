// Tiempo perdido por una novedad, a partir de la hora de inicio y de fin.
//
// Se piden dos horas concretas y no "¿cuánto tiempo perdiste?" porque una hora
// es un hecho y una estimación es una opinión: cuando esto se sume para
// responder "¿cuánto nos cuesta el internet al mes?", esa diferencia importa.
//
// Las horas se guardan como "HH:MM" y la cuenta se hace en minutos. Guardarlas
// como fecha completa arrastraría zona horaria y cambios de hora a un dato que
// solo describe un rato de un día.

/** Minutos entre dos horas "HH:MM" del mismo día. `null` si no se puede calcular. */
export function minutosNovedad(desde: string | null | undefined, hasta: string | null | undefined): number | null {
  const a = aMinutos(desde);
  const b = aMinutos(hasta);
  if (a == null || b == null) return null;
  // Fin antes que inicio: no se asume que cruzó la medianoche —esta gente
  // trabaja de día— sino que está mal escrito. Devolver un número inventado
  // ensuciaría el total que después se usa para decidir.
  if (b < a) return null;
  return b - a;
}

function aMinutos(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** "1 h 30 min" — para mostrar. Vacío si no hay cuenta posible. */
export function formatoMinutos(minutos: number | null): string {
  if (minutos == null) return '—';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
