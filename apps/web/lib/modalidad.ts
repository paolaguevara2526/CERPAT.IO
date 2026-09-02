// apps/web/lib/modalidad.ts
// Visita presencial o reunión virtual. Es lo MISMO por dentro —se programa, se
// levanta un acta, deja compromisos y se les hace seguimiento— y por eso no se
// duplicó la entidad: una reunión virtual no es otra cosa, es una visita que no
// exige desplazarse.
//
// Lo que sí cambia es cómo se llama y qué se le pregunta:
//   - una visita tiene LUGAR (una dirección a la que hay que ir);
//   - una reunión tiene ENLACE (Meet, Teams, Zoom).
// Es el mismo campo `lugar`; lo que cambia es la etiqueta y qué se espera ahí.
//
// Separar los dos nombres no es cosmético: la dirección necesita saber cuánto
// del acompañamiento se hace en sitio y cuánto a distancia, y con un solo nombre
// esa cuenta no se puede hacer.

export type Modalidad = 'presencial' | 'virtual';

export const MODALIDADES: { k: Modalidad; label: string; icono: string; color: string }[] = [
  { k: 'presencial', label: 'Visita', icono: '🤝', color: 'var(--peligro)' },
  { k: 'virtual', label: 'Reunión', icono: '💻', color: '#2E5090' },
];

/** Cae en 'presencial' ante cualquier valor desconocido o vacío. */
export function modalidadValida(v: unknown): Modalidad {
  return v === 'virtual' ? 'virtual' : 'presencial';
}

export const metaModalidad = (v: unknown) =>
  MODALIDADES.find((m) => m.k === modalidadValida(v))!;

/** "Visita" · "Reunión" */
export const nombreModalidad = (v: unknown): string => metaModalidad(v).label;

/** Etiqueta del calendario: "Visitas" · "Reuniones" (en plural, como el filtro). */
export const etiquetaCalendario = (v: unknown): string =>
  modalidadValida(v) === 'virtual' ? 'Reuniones' : 'Visitas';

/** Cómo se le pide el sitio a cada una. */
export const etiquetaLugar = (v: unknown): string =>
  modalidadValida(v) === 'virtual' ? 'Enlace de la reunión' : 'Lugar';

export const ayudaLugar = (v: unknown): string =>
  modalidadValida(v) === 'virtual'
    ? 'Pega el enlace de Meet, Teams o Zoom'
    : 'Sede u oficina donde se realiza';

/** ¿El "lugar" es un enlace que se puede abrir? Solo así se pinta como link. */
export function esEnlace(lugar: string | null | undefined): boolean {
  return /^https?:\/\/\S+$/i.test((lugar ?? '').trim());
}
