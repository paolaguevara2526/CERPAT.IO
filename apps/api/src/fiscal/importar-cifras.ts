// Emparejar una fila de Excel con el cliente al que pertenece, y leer sus montos.
//
// Es la parte peligrosa de importar cifras: si una fila casa con el cliente
// equivocado, se le escriben activos e ingresos ajenos y de ahí salen mal sus
// obligaciones (revisor fiscal, IVA bimestral, RST) sin que nada falle.
//
// Módulo puro a propósito: no toca la base ni el request, así cada caso raro se
// puede fijar con una prueba.

export type EmpresaIdx = { id: string; nombre: string; nit: string | null };
export type Emparejado = { empresa: EmpresaIdx } | { error: string };

export const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
export const normNombre = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function indexar(empresas: EmpresaIdx[]) {
  const porNit = new Map<string, EmpresaIdx[]>();
  const porNitSinDv = new Map<string, EmpresaIdx[]>();
  const porNombre = new Map<string, EmpresaIdx[]>();
  const meter = (m: Map<string, EmpresaIdx[]>, k: string, e: EmpresaIdx) => {
    if (!k) return;
    const l = m.get(k) ?? []; l.push(e); m.set(k, l);
  };
  for (const e of empresas) {
    const d = soloDigitos(e.nit);
    meter(porNit, d, e);
    if (d.length >= 10) meter(porNitSinDv, d.slice(0, -1), e);
    meter(porNombre, normNombre(e.nombre), e);
  }
  return { porNit, porNitSinDv, porNombre };
}

/**
 * Empareja por NIT y, si no aparece, por nombre.
 *
 * El NIT viene escrito de mil formas —"900.950.136-1", "900950136"— y las
 * personas naturales traen cédula, donde el último dígito NO es de verificación.
 * Quitarlo a ciegas casaría la cédula 1006877717 con el NIT 100687771-7 y le
 * escribiría a un cliente las cifras de otro. Por eso primero se busca la
 * coincidencia exacta, y la variante sin dígito de verificación solo se acepta
 * cuando es ÚNICA. Ante cualquier ambigüedad se devuelve error: que la fila
 * quede sin importar es recuperable; que entre en el cliente equivocado, no.
 */
export function emparejar(idx: ReturnType<typeof indexar>, nit: unknown, cliente: unknown): Emparejado {
  const d = soloDigitos(nit);
  if (d) {
    const exacto = idx.porNit.get(d) ?? [];
    if (exacto.length === 1) return { empresa: exacto[0] };
    if (exacto.length > 1) return { error: `NIT ${d} está repetido en ${exacto.length} clientes` };

    const candidatos = new Map<string, EmpresaIdx>();
    for (const e of idx.porNitSinDv.get(d) ?? []) candidatos.set(e.id, e);
    if (d.length >= 10) for (const e of idx.porNit.get(d.slice(0, -1)) ?? []) candidatos.set(e.id, e);
    const unicos = [...candidatos.values()];
    if (unicos.length === 1) return { empresa: unicos[0] };
    if (unicos.length > 1) return { error: `NIT ${d} casa con ${unicos.length} clientes; corrígelo en el archivo` };
  }
  const n = normNombre(cliente);
  if (n) {
    const porNombre = idx.porNombre.get(n) ?? [];
    if (porNombre.length === 1) return { empresa: porNombre[0] };
    if (porNombre.length > 1) return { error: `El nombre "${cliente}" está repetido en ${porNombre.length} clientes` };
  }
  return { error: `No encontré el cliente${d ? ` con NIT ${d}` : ''}${cliente ? ` ("${cliente}")` : ''}` };
}

/**
 * Lee un monto de una celda: "1.234.567", "1234567,50", "$ 1.234.567" o número.
 *
 * Devuelve 'invalido' en vez de 0 ante cualquier texto que no sea un número.
 * Un 0 silencioso diría que el cliente no tiene activos ni ingresos, y eso lo
 * saca de obligaciones que sí le aplican.
 */
export function montoDe(v: unknown): number | null | 'invalido' {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : 'invalido';
  const s = String(v).trim().replace(/[$\s]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return 'invalido';
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 'invalido';
}

export const anioValido = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
};
