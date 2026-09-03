// apps/web/lib/eventos.ts
// Aviso entre paneles de la misma pantalla cuando cambia el estado de una tarea.
//
// El caso que lo motivó: en la Lista conviven la bandeja "Liberar insumo a
// asesores" (arriba) y las tareas (abajo). El auxiliar marca la captura de
// Nómina como Terminado abajo, mira arriba y la bandeja sigue diciendo "falta
// captura" — porque cargó sus datos al abrir la página y nadie le avisó.
//
// `router.refresh()` no alcanza: vuelve a pedir los componentes de SERVIDOR, y
// la bandeja es de cliente con su propio fetch. No se remonta, así que su efecto
// no se vuelve a ejecutar.
//
// El precio de no arreglarlo es alto: la pantalla se contradice a sí misma, y
// quien la mira concluye que el sistema no registró lo que acaba de marcar.

/** Una tarea cambió de estado. Lo emite quien lo cambia; lo oye quien depende. */
export const TAREA_CAMBIADA = 'cerpat:tarea-cambiada';

export function avisarTareaCambiada(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TAREA_CAMBIADA));
}

/**
 * Escucha los cambios de estado. Devuelve la función para dejar de escuchar,
 * que es justo lo que un `useEffect` necesita retornar.
 */
export function alCambiarTarea(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(TAREA_CAMBIADA, cb);
  return () => window.removeEventListener(TAREA_CAMBIADA, cb);
}
