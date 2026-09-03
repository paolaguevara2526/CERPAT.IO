// Política de liberación del insumo: por ÁREA, no "todo el cliente o nada".
//
// El auxiliar captura (Informes, Nómina, …) y le suelta el insumo a cada
// asesor según su área. Impuestos y Tesorería casi nunca tienen captura
// propia: se liberan a mano, o solas cuando ya no queda captura pendiente
// en el cliente. Reabrir Informes no le quita el insumo al asesor de Impuestos.

export const CAPTURA_LISTA = ['terminado', 'auditado', 'no_aplica'] as const;

export function capturaLista(estado: string): boolean {
  return (CAPTURA_LISTA as readonly string[]).includes(estado);
}

export type CapturaArea = { areaId: string | null; estado: string };

export function decidirAutoEntrega(input: {
  capturas: CapturaArea[];
  areasObjetivo: string[];
}): { crear: string[]; revertir: string[] } {
  const { capturas, areasObjetivo } = input;
  if (capturas.length === 0) return { crear: [], revertir: [] };

  const porArea = new Map<string, CapturaArea[]>();
  for (const c of capturas) {
    if (!c.areaId) continue;
    const arr = porArea.get(c.areaId) ?? [];
    arr.push(c);
    porArea.set(c.areaId, arr);
  }

  const todasListas = capturas.every((c) => capturaLista(c.estado));
  const crear: string[] = [];
  const revertir: string[] = [];

  for (const areaId of areasObjetivo) {
    const caps = porArea.get(areaId);
    if (caps && caps.length > 0) {
      if (caps.every((c) => capturaLista(c.estado))) crear.push(areaId);
      else revertir.push(areaId);
      continue;
    }
    // Sin captura propia (Impuestos, Tesorería, …): se auto-libera cuando
    // toda la captura del cliente está lista. No se revierte si otra área
    // se reabre — cada asesor recibe solo lo suyo.
    if (todasListas) crear.push(areaId);
  }
  return { crear, revertir };
}

export function auxiliarPuedeLiberarArea(capturasDelArea: { estado: string }[]): { ok: true; motivo?: undefined } | { ok: false; motivo: string } {
  if (capturasDelArea.some((c) => !capturaLista(c.estado))) {
    return { ok: false, motivo: 'Termina la captura de esta área para liberarla.' };
  }
  return { ok: true };
}
