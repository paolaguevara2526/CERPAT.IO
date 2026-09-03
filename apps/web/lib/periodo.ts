// apps/web/lib/periodo.ts
// Moverse entre los períodos del plan ("YYYY-MM").
//
// El backend siempre supo servir cualquier mes: casi todos los endpoints del
// plan aceptan ?periodo=. Lo que no existía era CÓMO PEDIRLO: ninguna pantalla
// tenía un control para cambiar de mes, salvo una casilla de texto donde había
// que escribir "2026-08" a mano. Generado septiembre, agosto quedaba fuera de
// alcance aunque estuviera completo en la base.
//
// Un plan de trabajo mensual del que solo se puede ver el mes en curso no
// permite lo que se hace al cerrar el mes: revisar qué pasó.

/** Formato de período del plan. Es el mismo del backend. */
export const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function periodoValido(v: string | null | undefined): boolean {
  return PERIODO_RE.test(String(v ?? ''));
}

/** Período de un momento dado, en día calendario local. */
export function periodoDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * El período de hoy.
 *
 * En local, nunca por UTC: en Colombia, después de las 7 p.m. del último día del
 * mes, `toISOString()` ya dice el mes siguiente, y el planeador saltaría de mes
 * una tarde antes de tiempo.
 */
export function periodoDeHoy(hoy: Date = new Date()): string {
  return periodoDe(hoy);
}

/** Desplaza un período `n` meses (negativo = hacia atrás). null si no es válido. */
export function moverPeriodo(periodo: string, n: number): string | null {
  if (!periodoValido(periodo)) return null;
  const [y, m] = periodo.split('-').map(Number);
  // Contando desde 0 el desbordamiento de año sale solo, hacia adelante y hacia
  // atrás (diciembre → enero del siguiente, enero → diciembre del anterior).
  const total = y * 12 + (m - 1) + n;
  if (total < 0) return null;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export const periodoAnterior = (p: string) => moverPeriodo(p, -1);
export const periodoSiguiente = (p: string) => moverPeriodo(p, 1);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-08" → "agosto 2026". Cadena vacía si no hay período. */
export function nombrePeriodo(periodo: string | null | undefined): string {
  if (!periodoValido(periodo)) return '';
  const [y, m] = periodo!.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

/** Distancia en meses respecto de hoy: 0 = mes en curso, -1 = el pasado. */
export function mesesDesdeHoy(periodo: string, hoy: string = periodoDeHoy()): number | null {
  if (!periodoValido(periodo) || !periodoValido(hoy)) return null;
  const [ay, am] = periodo.split('-').map(Number);
  const [by, bm] = hoy.split('-').map(Number);
  return (ay * 12 + am) - (by * 12 + bm);
}

/**
 * Cómo hay que advertir que NO se está viendo el mes en curso.
 *
 * Es lo que evita el error caro: creer que se está mirando el trabajo de hoy
 * cuando la pantalla muestra el de hace tres meses. En un mes futuro la
 * advertencia es más fuerte —ahí todavía no ha pasado nada— y en el mes en curso
 * no hay nada que advertir.
 */
export type AvisoPeriodo = { tipo: 'actual' | 'pasado' | 'futuro'; meses: number; texto: string };

export function avisoPeriodo(periodo: string, hoy: string = periodoDeHoy()): AvisoPeriodo | null {
  const d = mesesDesdeHoy(periodo, hoy);
  if (d == null) return null;
  if (d === 0) return { tipo: 'actual', meses: 0, texto: 'Mes en curso' };
  const n = Math.abs(d);
  const plural = n === 1 ? 'mes' : 'meses';
  if (d < 0) return { tipo: 'pasado', meses: n, texto: `Estás viendo un período cerrado: ${nombrePeriodo(periodo)}, hace ${n} ${plural}.` };
  return { tipo: 'futuro', meses: n, texto: `Estás viendo un período que aún no empieza: ${nombrePeriodo(periodo)}, dentro de ${n} ${plural}.` };
}

/**
 * El período que debe mostrar una pantalla: el pedido si sirve, si no el de hoy.
 *
 * Se ignora en silencio un período inválido en vez de fallar: llega de la URL, y
 * un enlace mal copiado no debería dejar la pantalla en blanco.
 */
export function periodoAMostrar(pedido: string | null | undefined, hoy: string = periodoDeHoy()): string {
  return periodoValido(pedido) ? pedido! : hoy;
}
