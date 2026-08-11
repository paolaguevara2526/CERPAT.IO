// Formato de los minutos de una novedad: "1 h 30 min".
//
// Solo formato: los minutos los calcula y guarda el backend
// (apps/api/src/plan/tiempo-novedad.ts), que es la fuente de verdad de la
// cuenta. Aquí no se recalcula nada — dos cuentas darían dos números.

export function formatoMinutos(minutos: number | null): string {
  if (minutos == null) return '—';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
