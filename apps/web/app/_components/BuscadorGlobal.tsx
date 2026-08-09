'use client';
// Buscador global (Ctrl+K / ⌘K). La plataforma tiene más de 30 destinos y va a
// crecer a cinco módulos: llegar a todo bajando por el menú deja de ser viable.
// Aquí se escribe el nombre —o algo parecido— y se salta directo.
//
// Los destinos llegan por props (la misma fuente que alimenta el menú), y si se
// pasan los roles se filtran igual que los guardas de ruta: nadie descubre
// pantallas por el buscador.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Ico from './iconos';
import { coincide, type Destino } from '@/app/(app)/planeador/navegacion';
import { puedeVerRuta } from '@/lib/acceso';

export default function BuscadorGlobal({ destinos, roles, esRoot = false }: {
  destinos: (Destino & { area: string })[];
  roles?: string[];
  esRoot?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  const permitidos = useMemo(
    () => (roles ? destinos.filter((d) => puedeVerRuta({ roles, esRoot }, d.href)) : destinos),
    [destinos, roles, esRoot],
  );
  const resultados = useMemo(
    () => permitidos.filter((d) => coincide(d, q)).slice(0, 8),
    [permitidos, q],
  );

  // Atajo global. Se ignora si el foco está en un campo, salvo el del buscador:
  // nadie quiere que Ctrl+K le interrumpa mientras escribe en un formulario.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierto((a) => !a);
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  useEffect(() => {
    if (abierto) { setQ(''); setSel(0); setTimeout(() => campo.current?.focus(), 0); }
  }, [abierto]);

  useEffect(() => { setSel(0); }, [q]);

  const ir = (href: string) => { setAbierto(false); router.push(href); };

  const enCampo = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setAbierto(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, resultados.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); return; }
    if (e.key === 'Enter' && resultados[sel]) { e.preventDefault(); ir(resultados[sel].href); }
  };

  return (
    <>
      {/* Disparador en la barra de la app */}
      <button className="buscador-abrir" onClick={() => setAbierto(true)} title="Buscar (Ctrl + K)" aria-label="Buscar">
        <Ico name="hallazgos" size={15} />
        <span className="buscador-abrir-texto">Buscar…</span>
        <kbd>Ctrl K</kbd>
      </button>

      {abierto && (
        <div className="buscador-velo" onMouseDown={(e) => { if (e.target === e.currentTarget) setAbierto(false); }}>
          <div className="buscador-caja" role="dialog" aria-modal="true" aria-label="Buscar en la plataforma">
            <div className="buscador-campo">
              <Ico name="hallazgos" size={17} />
              <input
                ref={campo} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={enCampo}
                placeholder="¿A dónde quieres ir?" aria-label="Buscar" autoComplete="off"
              />
              <kbd>Esc</kbd>
            </div>
            {resultados.length === 0 ? (
              <div className="buscador-vacio">Nada coincide con «{q}».</div>
            ) : (
              <ul className="buscador-lista">
                {resultados.map((d, i) => (
                  <li key={d.href}>
                    <button
                      className={i === sel ? 'sel' : undefined}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => ir(d.href)}
                    >
                      <Ico name={d.icon} size={17} />
                      <span className="buscador-label">{d.label}</span>
                      {d.area && <span className="buscador-area">{d.area}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="buscador-pie">
              <span><kbd>↑</kbd><kbd>↓</kbd> moverse</span>
              <span><kbd>↵</kbd> abrir</span>
              <span><kbd>Esc</kbd> cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
