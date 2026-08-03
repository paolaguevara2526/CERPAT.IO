// apps/api/src/vencimientos/reglas-pago.ts
// Reglas de "fecha límite de PAGO" por obligación.
//
// Las fechas que carga el sistema son la fecha límite de PRESENTACIÓN. Desde el
// día siguiente corren intereses de mora en TODAS las obligaciones. Además,
// algunas tienen una fecha límite de PAGO (= presentación + N meses calendario)
// tras la cual la consecuencia NO es solo intereses:
//   - Retención en la fuente, Autorretención y ReteICA: +2 meses → INEFICAZ
//     (para la DIAN es como no haber presentado; Art. 580-1 E.T.).
//   - Anticipo bimestral del RST: +1 mes → riesgo de EXCLUSIÓN del RST
//     (es una alarma, no una sanción).
// El resto solo causa intereses hasta que se pague.
//
// El match es por nombre de la obligación (insensible a mayúsculas/tildes),
// para servir tanto a las tareas del plan (tipoObligacion.nombre) como a los
// VencimientoEmpresa (campo obligacion, string).

export type Consecuencia = 'intereses' | 'ineficaz' | 'exclusion_rst';
export type ReglaPago = { plazoMeses: number | null; consecuencia: Consecuencia };

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function reglaPago(obligacion: string | null | undefined): ReglaPago {
  const o = norm(obligacion ?? '');
  if (o.includes('autorret')) return { plazoMeses: 2, consecuencia: 'ineficaz' };
  if (o.includes('reten') && o.includes('fuente')) return { plazoMeses: 2, consecuencia: 'ineficaz' };
  if (o.includes('reteica') || (o.includes('reten') && o.includes('ica'))) return { plazoMeses: 2, consecuencia: 'ineficaz' };
  if (o.includes('anticipo')) return { plazoMeses: 1, consecuencia: 'exclusion_rst' };
  return { plazoMeses: null, consecuencia: 'intereses' };
}

// Suma meses calendario cayendo el mismo día del mes (o el último si no existe,
// p. ej. 31 ene + 1 mes → 28/29 feb).
export function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimoDelMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDelMes));
  return d;
}

// Fecha límite de pago (null si la obligación solo causa intereses) y su
// consecuencia si se incumple.
export function limitePago(
  fechaVencimiento: Date,
  obligacion: string | null | undefined,
): { fechaLimitePago: Date | null; consecuencia: Consecuencia } {
  const r = reglaPago(obligacion);
  return {
    fechaLimitePago: r.plazoMeses != null ? sumarMeses(fechaVencimiento, r.plazoMeses) : null,
    consecuencia: r.consecuencia,
  };
}
