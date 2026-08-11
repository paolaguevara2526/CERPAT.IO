// El día de un lote de captura es un DÍA DEL CALENDARIO, no un instante.
//
// "El 11 de agosto" no cambia porque el servidor esté en UTC y quien captura
// esté en Colombia (UTC−5). Guardarlo como un instante trae dos errores que ya
// se vieron en producción:
//
//  - `new Date()` guardaba la hora del servidor: un lote capturado a las 8 p. m.
//    en Colombia son las 01:00 UTC del día siguiente, y quedaba corrido un día.
//  - Al mostrarlo, el navegador pasaba la medianoche UTC a hora local y restaba
//    cinco horas: lo registrado hoy aparecía con la fecha de ayer.
//
// La regla, de las dos puntas: se guarda a medianoche UTC y se muestra en UTC.
// Así el día que se escribe es el día que se ve, esté quien esté mirando.

/** Medianoche UTC del día indicado ("YYYY-MM-DD"). Hoy si no viene o no sirve. */
export function diaDeCaptura(v: unknown): Date {
  if (typeof v === 'string') {
    // Se lee el día TAL COMO VIENE ESCRITO, sin dejar que Date lo interprete.
    // Si el texto trae hora y huso ("…T20:30:00-05:00"), el día que vale es el
    // del calendario de quien escribió —el 11 a las 8:30 p. m. sigue siendo el
    // 11—, no el que resulte de pasarlo a UTC.
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/.exec(v.trim());
    if (m) {
      const [, a, mes, dia] = m;
      const d = new Date(`${a}-${mes}-${dia}T00:00:00.000Z`);
      // Un día que no existe ("2026-02-31") no se corrige al 3 de marzo: se
      // descarta. Date lo corre en silencio, y guardaría un día que nadie
      // escribió — peor que rechazarlo, porque nadie se entera.
      if (!isNaN(d.getTime()) && d.toISOString().slice(0, 10) === `${a}-${mes}-${dia}`) return d;
    }
  }
  if (v instanceof Date && !isNaN(v.getTime())) return aMedianocheUTC(v);
  return aMedianocheUTC(new Date());
}

const aMedianocheUTC = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
