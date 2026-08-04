// apps/api/src/vencimientos/vinculos.ts
// Catálogo de vínculos entre un VENCIMIENTO tributario y la ACTIVIDAD del plan
// cuyo checklist (subtareas) hereda. La clave (key) se guarda en
// ActividadPlan.obligacionVencimiento desde Administración → Actividades; al
// generar el vencimiento se copian las SubtareaPlantilla de la actividad
// vinculada. Independiente del código de la actividad (sobrevive a
// re-codificaciones del catálogo).
//
// ⚠ Las claves deben coincidir con la lista VINCULOS del editor
//   (apps/web/app/administracion/ActividadesEditor.tsx).

export type VinculoVencimiento = { key: string; label: string; obligaciones: string[] };

// `obligaciones` son los nombres exactos que emite el generador
// (apps/api/src/vencimientos/generador.ts).
export const VINCULOS_VENCIMIENTO: VinculoVencimiento[] = [
  { key: 'retencion_fuente', label: 'Retención en la fuente', obligaciones: ['Retención en la fuente'] },
  { key: 'iva', label: 'IVA', obligaciones: ['IVA', 'IVA consolidado RST'] },
  { key: 'consumo', label: 'Impuesto al consumo', obligaciones: ['Impuesto al consumo'] },
  { key: 'anticipo_rst', label: 'Anticipo RST', obligaciones: ['Anticipo RST'] },
  { key: 'renta', label: 'Declaración de renta', obligaciones: ['Renta Persona Jurídica', 'Renta Grandes Contribuyentes', 'Renta Persona Natural'] },
  { key: 'consolidada_rst', label: 'Consolidada RST (Renta)', obligaciones: ['RST consolidada Renta'] },
  { key: 'fopat', label: 'FOPAT', obligaciones: ['FOPAT'] },
  { key: 'nomina_electronica', label: 'Nómina electrónica', obligaciones: ['Envío de nómina electrónica'] },
  { key: 'pila', label: 'Seguridad social (PILA)', obligaciones: ['Seguridad social (PILA)'] },
  { key: 'rub', label: 'RUB (Registro Único de Beneficiarios)', obligaciones: ['RUB (Registro Único de Beneficiarios)'] },
  { key: 'ica', label: 'ICA', obligaciones: ['ICA'] },
  { key: 'reteica', label: 'ReteICA', obligaciones: ['ReteICA'] },
  { key: 'autoica', label: 'AutoICA', obligaciones: ['AutoICA'] },
];

// obligación (string del generador) -> clave del vínculo (o null si no aplica).
const OBLIG_A_KEY = new Map<string, string>();
for (const v of VINCULOS_VENCIMIENTO) for (const o of v.obligaciones) OBLIG_A_KEY.set(o, v.key);

export const vinculoDeObligacion = (obligacion: string): string | null =>
  OBLIG_A_KEY.get(obligacion) ?? null;
