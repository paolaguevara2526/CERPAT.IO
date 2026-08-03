'use client';
// Filtro estilo Excel para el encabezado de una columna: un embudo que abre una
// lista con casillas para elegir qué valores mostrar. `seleccion === null`
// significa "todos" (sin filtro); un Set significa "solo estos".

import { useEffect, useRef, useState } from 'react';

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
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [abierto]);

  const activo = seleccion != null && seleccion.size < valores.length;
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

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
      <button
        type="button" onClick={() => setAbierto((o) => !o)} title="Filtrar"
        style={{ border: activo ? '1px solid var(--navy)' : '1px solid transparent', background: activo ? 'rgba(46,80,144,.10)' : 'transparent', borderRadius: 4, cursor: 'pointer', color: activo ? 'var(--navy)' : 'var(--muted)', fontSize: 10, lineHeight: 1, padding: '2px 4px' }}
      >▼</button>
      {abierto && (
        <span className="panel" style={{ position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, minWidth: ancho, padding: 6, boxShadow: '0 8px 24px rgba(10,18,34,.18)', display: 'block', textAlign: 'left' }}>
          {buscar && <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar…" style={{ ...inputMini, marginBottom: 6 }} />}
          <label style={{ ...fila, fontWeight: 700, borderBottom: '1px solid var(--line)', marginBottom: 3, paddingBottom: 5 }}>
            <input type="checkbox" checked={seleccion == null} onChange={(e) => todos(e.target.checked)} /> (Seleccionar todo)
          </label>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {filtrados.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: 4 }}>Sin coincidencias.</div>
            ) : filtrados.map((v) => (
              <label key={v} style={fila}>
                <input type="checkbox" checked={estaSel(v)} onChange={() => toggle(v)} /> {v || '(vacío)'}
              </label>
            ))}
          </div>
        </span>
      )}
    </span>
  );
}
