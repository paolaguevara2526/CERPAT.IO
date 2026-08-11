// Circuito de revisión de un impuesto dentro de la firma.
//
//   sin_iniciar ──iniciar──> en_proceso ──enviar──> en_revision
//                                 ^                    │
//                                 │                    ├──aprobar──> aprobado
//                                 └────iniciar/enviar──┴──devolver─> devuelto
//                                                                      │
//                                        (vuelve a Mi Día del asesor) ─┘
//
// Y desde `aprobado`, la coordinación puede reabrir si hay que corregir algo.
//
// Está aparte de las rutas y sin tocar la base a propósito: es la única parte de
// todo esto que se puede probar sin levantar nada, y es donde un error se paga
// caro — un salto de estado mal permitido deja presentar un impuesto que nadie
// revisó, que es justo lo que estas dos personas existen para evitar.

export type EstadoRevision = 'sin_iniciar' | 'en_proceso' | 'en_revision' | 'devuelto' | 'aprobado';
export type AccionRevision = 'iniciar' | 'enviar' | 'devolver' | 'aprobar' | 'reabrir';
/** Quién actúa. 'coordinacion' incluye Administrador y root. */
export type ActorRevision = 'asesor' | 'revisor' | 'coordinacion';

type Regla = { desde: EstadoRevision[]; hasta: EstadoRevision; actores: ActorRevision[] };

const REGLAS: Record<AccionRevision, Regla> = {
  // El asesor abre el impuesto y empieza a liquidarlo.
  iniciar: { desde: ['sin_iniciar', 'devuelto'], hasta: 'en_proceso', actores: ['asesor', 'coordinacion'] },
  // Lo manda a la cola de los revisores. Desde 'devuelto' también, para el caso
  // normal de corregir y reenviar sin pasos intermedios.
  enviar: { desde: ['en_proceso', 'devuelto'], hasta: 'en_revision', actores: ['asesor', 'coordinacion'] },
  // El revisor encontró algo: vuelve al asesor con la observación.
  devolver: { desde: ['en_revision'], hasta: 'devuelto', actores: ['revisor', 'coordinacion'] },
  aprobar: { desde: ['en_revision'], hasta: 'aprobado', actores: ['revisor', 'coordinacion'] },
  // Algo aprobado que hay que corregir. Solo coordinación: si el asesor pudiera
  // reabrir lo suyo, la aprobación no sería un control sino una formalidad.
  reabrir: { desde: ['aprobado'], hasta: 'en_proceso', actores: ['coordinacion'] },
};

const NOMBRE: Record<EstadoRevision, string> = {
  sin_iniciar: 'sin iniciar',
  en_proceso: 'en proceso',
  en_revision: 'en revisión',
  devuelto: 'devuelto',
  aprobado: 'aprobado',
};

export type ResultadoTransicion =
  | { ok: true; hasta: EstadoRevision }
  | { ok: false; motivo: string };

/**
 * ¿Se puede hacer esa acción, desde ese estado, por ese actor?
 *
 * El mensaje de error va en español y explica la razón: sale tal cual en
 * pantalla, y "transición inválida" no le dice nada a quien está trabajando.
 */
export function transicion(desde: EstadoRevision, accion: AccionRevision, actor: ActorRevision): ResultadoTransicion {
  const regla = REGLAS[accion];
  if (!regla) return { ok: false, motivo: 'Acción desconocida.' };
  if (!regla.actores.includes(actor)) {
    return { ok: false, motivo: accion === 'reabrir'
      ? 'Solo la coordinación puede reabrir un impuesto ya aprobado.'
      : `No te corresponde ${accion} este impuesto.` };
  }
  if (!regla.desde.includes(desde)) {
    return { ok: false, motivo: `No se puede ${accion} un impuesto que está ${NOMBRE[desde]}.` };
  }
  return { ok: true, hasta: regla.hasta };
}

/**
 * Con qué sombrero actúa alguien SOBRE ESTE vencimiento.
 *
 * El caso que importa: una misma persona puede ser asesora de unos clientes y
 * revisora de otros. Si el vencimiento es suyo, actúa como asesora aunque
 * cargue el rol de Revisor — y por eso no puede aprobarlo. Sin esta regla, un
 * revisor se aprobaría su propio trabajo y el control no existiría.
 */
export function actorDe(opts: { esCoordinacion: boolean; esAsesorDelVencimiento: boolean; tieneRolRevisor: boolean }): ActorRevision | null {
  if (opts.esCoordinacion) return 'coordinacion';
  if (opts.esAsesorDelVencimiento) return 'asesor';
  if (opts.tieneRolRevisor) return 'revisor';
  return null;
}

/** Tipo de evento que queda en el rastro para cada acción. */
export const EVENTO_DE: Record<AccionRevision, string> = {
  iniciar: 'inicio',
  enviar: 'envio_revision',
  devolver: 'devolucion',
  aprobar: 'aprobacion',
  reabrir: 'reapertura',
};

/**
 * ¿Puede este actor marcar el impuesto como presentado ante la DIAN?
 *
 * Para el asesor exige la aprobación del revisor: sin esta regla la revisión
 * sería decorativa, porque nada impediría presentar sin pasar por ella.
 *
 * La coordinación sí puede saltársela — un revisor enfermo el día del
 * vencimiento no puede ser motivo para no presentar. Queda registrado con su
 * nombre, que es la diferencia entre una excepción y un agujero.
 */
export function puedePresentar(estadoRevision: EstadoRevision, actor: ActorRevision): { ok: boolean; motivo?: string } {
  if (actor === 'coordinacion') return { ok: true };
  if (estadoRevision === 'aprobado') return { ok: true };
  return { ok: false, motivo: 'El impuesto todavía no está aprobado por el revisor. Envíalo a revisión primero.' };
}
