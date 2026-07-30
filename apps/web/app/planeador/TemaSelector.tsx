'use client';
// Selector de tema (Apariencia). Cambia la paleta del planeador y la recuerda
// por usuario en el navegador (localStorage). El verde CERPAT es constante.

import { useEffect, useRef, useState } from 'react';

const CLAVE = 'cerpat_tema';
type Tema = { id: string; nombre: string; sw: [string, string, string] };
const TEMAS: Tema[] = [
  { id: 'claro', nombre: 'Claro', sw: ['#e7ebf2', '#2e5090', '#34c98b'] },
  { id: 'escritorio', nombre: 'Escritorio', sw: ['#ffffff', '#274b9e', '#34c98b'] },
  { id: 'navy', nombre: 'Azul profundo', sw: ['#0a1424', '#4a72c0', '#34c98b'] },
  { id: 'oscuro', nombre: 'Oscuro', sw: ['#10121a', '#3a5ea6', '#34c98b'] },
];

export default function TemaSelector() {
  const [tema, setTema] = useState('claro');
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setTema(localStorage.getItem(CLAVE) || 'claro'); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    function fuera(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  function elegir(id: string) {
    setTema(id);
    try { localStorage.setItem(CLAVE, id); } catch { /* ignore */ }
    document.documentElement.setAttribute('data-cerpat-theme', id);
    setAbierto(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setAbierto((a) => !a)} title="Apariencia (tema)" aria-label="Apariencia"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, border: '1px solid var(--edge-strong)', borderRadius: 6, background: 'var(--panel)', color: 'var(--ink)', cursor: 'pointer', fontSize: 14, lineHeight: 1, boxShadow: '0 1px 2px var(--lo)' }}
      >🎨</button>
      {abierto && (
        <div style={{ position: 'absolute', top: 34, right: 0, zIndex: 60, background: 'var(--panel)', border: '1px solid var(--edge-strong)', borderRadius: 8, boxShadow: '0 10px 30px var(--lo)', padding: 6, minWidth: 190 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', padding: '6px 8px 4px' }}>Apariencia</div>
          {TEMAS.map((t) => (
            <button key={t.id} onClick={() => elegir(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: t.id === tema ? 'rgba(46,80,144,0.12)' : 'transparent', borderRadius: 6, padding: '7px 8px', cursor: 'pointer', fontFamily: 'var(--ui)', color: 'var(--ink)' }}>
              <span style={{ display: 'inline-flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--edge)', flexShrink: 0 }}>
                {t.sw.map((c, i) => <span key={i} style={{ width: 14, height: 18, background: c }} />)}
              </span>
              <span style={{ fontSize: 13, fontWeight: t.id === tema ? 800 : 600, flex: 1 }}>{t.nombre}</span>
              {t.id === tema && <span style={{ color: '#22a670', fontWeight: 800 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
