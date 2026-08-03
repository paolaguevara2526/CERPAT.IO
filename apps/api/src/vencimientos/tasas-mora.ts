// apps/api/src/vencimientos/tasas-mora.ts
// Liquidación de intereses de mora de la DIAN (Art. 635 E.T.).
//
// Método (replicado del liquidador oficial del equipo):
//   días de mora = fecha de pago − fecha de vencimiento   (días calendario)
//   tasa anual   = tasa de mora del MES en que se paga     (tabla mensual)
//   interés      = valor × (tasa anual / 365) × días de mora
//                  redondeado HACIA ARRIBA al múltiplo de 1.000
// La tasa vigente al momento del pago se aplica a TODO el período (interés
// simple, no compuesto).
//
// Las tasas las publica la Superfinanciera/DIAN cada mes; actualízalas aquí
// cuando salga la nueva (o desde el panel de Parámetros tributarios cuando exista).

// UVT por año (Res. DIAN). 10 UVT = base de la sanción mínima y de varios topes.
export const UVT: Record<number, number> = {
  2026: 52374,
};
export function uvt(anio: number): number {
  return UVT[anio] ?? UVT[Math.max(...Object.keys(UVT).map(Number))];
}

// Tasa de interés moratorio (% efectivo anual) por mes 'YYYY-MM'.
const TASA_MORA: Record<string, number> = {
  '2026-01': 0.2236, '2026-02': 0.2323, '2026-03': 0.2352, '2026-04': 0.2476,
  '2026-05': 0.2617, '2026-06': 0.2679, '2026-07': 0.2679, '2026-08': 0.2766,
};

// Tasa del mes de la fecha dada; si aún no está cargada, usa la más reciente.
export function tasaMoraDelMes(fecha: Date): number {
  const k = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  if (TASA_MORA[k] != null) return TASA_MORA[k];
  const keys = Object.keys(TASA_MORA).sort();
  const menores = keys.filter((x) => x <= k);
  return TASA_MORA[menores.length ? menores[menores.length - 1] : keys[keys.length - 1]];
}

const MS_DIA = 86400000;

// Interés de mora a la fecha de corte (por defecto hoy). Devuelve días de mora,
// tasa aplicada e interés (0 si no hay mora o no hay base).
export function interesMora(
  valor: number | null | undefined,
  fechaVencimiento: Date,
  fechaCorte: Date = new Date(),
): { dias: number; tasaAnual: number; interes: number } {
  const venc = new Date(fechaVencimiento); venc.setHours(0, 0, 0, 0);
  const corte = new Date(fechaCorte); corte.setHours(0, 0, 0, 0);
  const dias = Math.round((corte.getTime() - venc.getTime()) / MS_DIA);
  const tasaAnual = tasaMoraDelMes(corte);
  if (dias <= 0 || !valor || valor <= 0) return { dias: Math.max(0, dias), tasaAnual, interes: 0 };
  const bruto = valor * (tasaAnual / 365) * dias;
  const interes = Math.ceil(bruto / 1000) * 1000; // ROUNDUP a múltiplo de 1.000
  return { dias, tasaAnual, interes };
}
