'use client';
// El marco de los modales: el fondo oscuro y la ventana.
//
// Existe por dos errores que se repetían en los ocho modales, cada uno con su
// propia copia del mismo `onClick={onClose}` en el fondo:
//
//  1. CERRAR AL SOLTAR EL MOUSE AFUERA. Para borrar el contenido de una casilla
//     uno arrastra para seleccionar el texto, y si el arrastre termina un
//     milímetro por fuera de la ventana, el clic "ocurre" en el fondo y el
//     modal se cerraba. El equipo lo reportó como "cuando borran información de
//     una casilla nos saca del acta", que suena a otra cosa y es esto.
//     Se arregla exigiendo que el clic HAYA EMPEZADO en el fondo: si empezó
//     dentro de la ventana, no cierra.
//
//  2. PERDER LO ESCRITO SIN PREGUNTAR. Un clic afuera o un Escape borraban un
//     acta a medio llenar sin decir nada. Con `haycambios`, primero se pregunta.
//
// Cerrar por accidente cuesta el trabajo de media hora; cerrar con una pregunta
// de más cuesta un clic. La asimetría decide el diseño.

import { useEffect, useRef } from 'react';

/**
 * Props del fondo oscuro para los modales que todavía lo dibujan a mano.
 *
 * Reemplaza `onClick={onClose}` por `{...useCierreDeFondo(onClose)}` y ya no
 * cierra cuando el clic empezó DENTRO de la ventana — el caso de arrastrar para
 * seleccionar el texto de una casilla y soltar un poco más allá del borde.
 */
export function useCierreDeFondo(onClose: () => void) {
  const empezoEnElFondo = useRef(false);
  return {
    onMouseDown: (e: React.MouseEvent) => { empezoEnElFondo.current = e.target === e.currentTarget; },
    onClick: (e: React.MouseEvent) => { if (e.target === e.currentTarget && empezoEnElFondo.current) onClose(); },
  };
}

export default function ModalMarco({
  onClose, children, zIndex = 50, className = 'win', style, haycambios = false,
  aviso = 'Hay cambios sin guardar. ¿Salir y perderlos?',
}: {
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Si hay algo escrito sin guardar, cerrar pregunta antes. */
  haycambios?: boolean;
  aviso?: string;
}) {
  // Dónde empezó el clic. Sin esto, soltar el mouse en el fondo tras arrastrar
  // desde adentro cuenta como "clic en el fondo".
  const empezoEnElFondo = useRef(false);

  // El aviso se lee de una referencia y no de la clausura: el listener se
  // registra una vez, y si leyera el valor de entonces, al rato estaría
  // decidiendo con un dato viejo — justo el caso en que ya hay algo escrito.
  const hayRef = useRef(haycambios);
  hayRef.current = haycambios;
  const cerrarRef = useRef(onClose);
  cerrarRef.current = onClose;

  function intentarCerrar() {
    if (hayRef.current && !confirm(aviso)) return;
    cerrarRef.current();
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (hayRef.current && !confirm(aviso)) return;
      cerrarRef.current();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [aviso]);

  return (
    <div
      onMouseDown={(e) => { empezoEnElFondo.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && empezoEnElFondo.current) intentarCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex, padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className={className} style={style}>
        {children}
      </div>
    </div>
  );
}
