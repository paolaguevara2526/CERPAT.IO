'use client';
// Selector de tema (Apariencia). Cambia la paleta del planeador y la recuerda
// por usuario en el navegador (localStorage). El verde CERPAT es constante.

import { useEffect, useRef, useState } from 'react';

const CLAVE = 'cerpat_tema';
type Tema = { id: string; nombre: string; sw: [string, string, string] };
// Las muestras reflejan el CROMO (barra superior + menú, que van del mismo color)
// y el acento: los tres tonos que realmente cambian al elegir un tema.
const TEMAS: Tema[] = [
  { id: 'claro', nombre: 'Claro (navy)', sw: ['#35589b', '#16294a', '#48D597'] },
  { id: 'escritorio', nombre: 'Escritorio (clara)', sw: ['#ffffff', '#e4eaf4', '#22a670'] },
  { id: 'navy', nombre: 'Azul profundo', sw: ['#1b3663', '#060d18', '#48D597'] },
  { id: 'oscuro', nombre: 'Oscuro', sw: ['#2f3648', '#12141c', '#48D597'] },
  { id: 'verde', nombre: 'Verde CERPAT', sw: ['#1ea56e', '#0c3f2e', '#0f1d33'] },
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
        // Vive dentro de la barra de la app: se funde con el cromo (hereda su
        // color) en vez de ser una pastilla blanca sobre el azul.
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 26, border: '1px solid rgba(128,128,128,0.35)', borderRadius: 6, background: 'rgba(128,128,128,0.14)', color: 'inherit', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
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
