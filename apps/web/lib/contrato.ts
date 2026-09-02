// apps/web/lib/contrato.ts
// Vigencia del contrato de un cliente: desde cuándo, cuántos meses y hasta
// cuándo.
//
// Los tres datos NO son independientes: la fecha de terminación sale de la
// inicial más los meses. Guardar los tres sin más los deja contradecirse —y el
// día que discrepen, nadie sabe cuál creer—, así que aquí vive la cuenta que
// los relaciona: se propone la terminación a partir de los meses, y si la que
// está guardada dice otra cosa, se AVISA en vez de pisarla.
//
// Se avisa y no se corrige sola porque un contrato puede terminar en una fecha
// que no cuadra con la aritmética —una prórroga hasta fin de año, por ejemplo—
// y ahí la que manda es la del papel, no la del sistema.

/** Meses del contrato. null si no es un entero positivo razonable. */
export function mesesContrato(v: number | string | null | undefined): number | null {
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (n == null || !isFinite(n as number) || (n as number) <= 0) return null;
  // 600 meses son cincuenta años: más que eso es un dedazo, no un contrato.
  return Math.min(Math.floor(n as number), 600);
}

const partesDia = (iso: string | null | undefined): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const pad = (n: number) => String(n).padStart(2, '0');
const aISO = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** Último día de un mes (1-12). */
const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Fecha de terminación que corresponde a `desde` + `meses`.
 *
 * Convención: un contrato de 12 meses que empieza el 1 de febrero de 2026
 * termina el **31 de enero de 2027** — el día ANTES de cumplirse el plazo, que
 * es como se leen los contratos.
 *
 * Si el día no existe en el mes destino se ajusta al último (31 de enero + 1 mes
 * es el 28 de febrero, no el 3 de marzo): inventar un día del mes siguiente
 * alargaría el contrato en silencio.
 */
export function finDeContrato(desde: string | null | undefined, meses: number | string | null | undefined): string | null {
  const p = partesDia(desde);
  const n = mesesContrato(meses);
  if (!p || n == null) return null;
  const [y, m, d] = p;
  // Mes destino, contando desde 0 para que el desbordamiento de año salga solo.
  const total = (y * 12 + (m - 1)) + n;
  const ay = Math.floor(total / 12);
  const am = (total % 12) + 1;
  const ad = Math.min(d, ultimoDia(ay, am));
  // Un día antes: el plazo se cumple ese día, así que el contrato cubre hasta
  // el anterior.
  const previo = new Date(Date.UTC(ay, am - 1, ad));
  previo.setUTCDate(previo.getUTCDate() - 1);
  return aISO(previo.getUTCFullYear(), previo.getUTCMonth() + 1, previo.getUTCDate());
}

/**
 * ¿La terminación guardada coincide con la que sale de los meses?
 *
 * true cuando no hay con qué comparar: sin datos no hay contradicción que
 * denunciar.
 */
export function fechasCoherentes(
  desde: string | null | undefined,
  meses: number | string | null | undefined,
  hasta: string | null | undefined,
): boolean {
  const calculada = finDeContrato(desde, meses);
  const guardada = partesDia(hasta);
  if (!calculada || !guardada) return true;
  return calculada === aISO(...guardada);
}

/** Días que faltan para la terminación. Negativo si ya pasó. null sin fecha. */
export function diasParaVencer(hasta: string | null | undefined, hoy: string | null | undefined): number | null {
  const a = partesDia(hasta);
  const b = partesDia(hoy);
  if (!a || !b) return null;
  const ms = Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2]);
  return Math.round(ms / 86400000);
}

export type EstadoContrato = 'vigente' | 'por_vencer' | 'vencido' | 'sin_fecha';

/**
 * Estado del contrato. "Por vencer" es la ventana en la que todavía se puede
 * renovar; después ya se está prestando el servicio sin papel vigente, que es
 * justo lo que esta fecha existe para evitar.
 */
export function estadoContrato(hasta: string | null | undefined, hoy: string | null | undefined, avisoDias = 60): EstadoContrato {
  const d = diasParaVencer(hasta, hoy);
  if (d == null) return 'sin_fecha';
  if (d < 0) return 'vencido';
  return d <= avisoDias ? 'por_vencer' : 'vigente';
}
