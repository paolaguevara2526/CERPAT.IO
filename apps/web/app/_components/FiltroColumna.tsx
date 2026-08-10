'use client';
// Filtro estilo Excel para el encabezado de una columna: un embudo que abre una
// lista con casillas para elegir qué valores mostrar. `seleccion === null`
// significa "todos" (sin filtro); un Set significa "solo estos".
//
// El desplegable se renderiza en un portal (document.body) con posición fija:
// así no lo recorta el contenedor de la tabla, que usa overflow para el scroll
// horizontal. La altura se adapta al espacio disponible y, si no cabe abajo, se
// abre hacia arriba.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Pos = { left: number; top?: number; bottom?: number; maxH: number };

export default function FiltroColumna({
  valores, seleccion, onCambio, buscar = false, ancho = 200,
}: {
  valores: string[];                 // valores distintos de la columna (ordenados)
  seleccion: Set<string> | null;     // null = todos; Set = solo estos
  onCambio: (s: Set<string> | null) => void;
  buscar?: boolean;                  // mostrar caja de búsqueda (listas largas)
  ancho?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busq, setBusq] = useState('');
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Calcula la posición del desplegable a partir del botón, eligiendo si abre
  // hacia abajo o hacia arriba y cuánta altura tiene según el espacio libre.
  function calcular() {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = r.left;
    if (left + ancho > vw - 8) left = Math.max(8, vw - 8 - ancho);
    const abajo = vh - r.bottom - 12;
    const arriba = r.top - 12;
    const haciaArriba = abajo < 220 && arriba > abajo;
    const maxH = Math.max(160, Math.min(360, haciaArriba ? arriba : abajo));
    setPos(haciaArriba ? { left, bottom: vh - r.top + 4, maxH } : { left, top: r.bottom + 4, maxH });
  }

  // Posiciona antes de pintar para evitar el "salto" al abrir.
  useLayoutEffect(() => { if (abierto) calcular(); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setAbierto(false);
    };
    const recalc = () => calcular();
    document.addEventListener('mousedown', fuera);
    // Reposiciona (o cierra) si la página se desplaza o cambia de tamaño.
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      document.removeEventListener('mousedown', fuera);
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cualquier selección explícita cuenta como filtro activo, incluso la vacía
  // (que no deja pasar nada) y la que hoy cubre todos los valores: esa última
  // sigue filtrando en cuanto aparezca un valor nuevo en los datos.
  const activo = seleccion != null;
  const estaSel = (v: string) => seleccion == null || seleccion.has(v);
  const filtrados = valores.filter((v) => !busq.trim() || (v || '(vacío)').toLowerCase().includes(busq.trim().toLowerCase()));

  function toggle(v: string) {
    const base = seleccion == null ? new Set(valores) : new Set(seleccion);
    if (base.has(v)) base.delete(v); else base.add(v);
    onCambio(base.size === valores.length ? null : base);
  }
  function todos(on: boolean) { onCambio(on ? null : new Set<string>()); }

  const fila: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', fontSize: 12, fontWeight: 400, cursor: 'pointer', color: 'var(--ink)', textTransform: 'none', letterSpacing: 0, whiteSpace: 'nowrap' };
  const inputMini: React.CSSProperties = { padding: '5px 7px', borderRadius: 4, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12, fontFamily: 'var(--ui)', width: '100%' };

  const popup = abierto && pos && typeof document !== 'undefined' && createPortal(
    <div
      ref={popRef} className="panel"
      style={{
        position: 'fixed', zIndex: 200, left: pos.left, top: pos.top, bottom: pos.bottom,
        minWidth: ancho, maxHeight: pos.maxH, padding: 6, boxShadow: '0 8px 24px rgba(10,18,34,.18)',
        display: 'flex', flexDirection: 'column', textAlign: 'left',
      }}
    >
      {buscar && <input autoFocus value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar…" style={{ ...inputMini, marginBottom: 6, flexShrink: 0 }} />}
      <label style={{ ...fila, fontWeight: 700, borderBottom: '1px solid var(--line)', marginBottom: 3, paddingBottom: 5, flexShrink: 0 }}>
        <input type="checkbox" checked={seleccion == null} onChange={(e) => todos(e.target.checked)} /> (Seleccionar todo)
      </label>
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        {filtrados.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: 4 }}>Sin coincidencias.</div>
        ) : filtrados.map((v) => (
          <label key={v} style={fila}>
            <input type="checkbox" checked={estaSel(v)} onChange={() => toggle(v)} /> {v || '(vacío)'}
          </label>
        ))}
      </div>
    </div>,
    document.body,
  );

  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
      <button
        ref={btnRef} type="button" onClick={() => setAbierto((o) => !o)} title="Filtrar"
        style={{ border: activo ? '1px solid var(--navy)' : '1px solid transparent', background: activo ? 'rgba(46,80,144,.10)' : 'transparent', borderRadius: 4, cursor: 'pointer', color: activo ? 'var(--navy)' : 'var(--muted)', fontSize: 10, lineHeight: 1, padding: '2px 4px' }}
      >▼</button>
      {popup}
    </span>
  );
}
