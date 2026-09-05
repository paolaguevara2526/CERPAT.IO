'use client';
// Selector de cliente con búsqueda.
//
// El desplegable de siempre está bien para escoger: se abre, se ve la lista
// completa y se elige. Lo que no sirve con noventa clientes es BUSCAR — teclear
// una letra solo salta a la primera opción que empieza así, y el nombre que uno
// recuerda suele ser una palabra del medio ("taneja" por "Grupo Empresarial
// Dajitaneja SAS").
//
// Así que no se reemplaza el desplegable: se le agrega la búsqueda. Se abre y
// muestra TODA la lista igual que antes; si además se escribe, la lista se va
// filtrando por cualquier parte del nombre.
//
// El valor viaja en un input oculto con name="cliente", así que el formulario de
// filtros (GET, con su botón "Filtrar") sigue funcionando igual.

import { useEffect, useMemo, useRef, useState } from 'react';
import { coincide } from '@/lib/buscar';

const TODOS = 'Todos los clientes';

export default function SelectorCliente({ clientes, valor, estilo }: {
  clientes: string[]; valor: string; estilo?: React.CSSProperties;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const oculto = useRef<HTMLInputElement>(null);

  // Opciones visibles: con el campo vacío, TODAS — abrir el selector tiene que
  // mostrar la lista completa, como el desplegable de siempre.
  const opciones = useMemo(
    () => [TODOS, ...clientes.filter((c) => coincide(c, texto))],
    [clientes, texto],
  );

  // Cerrar al hacer clic afuera. Sin esto, el panel queda abierto encima de la
  // tabla y tapa justo lo que se acaba de filtrar.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) { setAbierto(false); setTexto(''); }
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  // Elegir escribe el valor y envía el formulario, para que se sienta igual que
  // el desplegable de antes (que filtraba al cambiar).
  function elegir(v: string) {
    const limpio = v === TODOS ? '' : v;
    setAbierto(false); setTexto('');
    if (!oculto.current) return;
    oculto.current.value = limpio;
    // Se envía el formulario directamente en vez de simular un evento: React
    // ignora los cambios de `value` hechos por código (su rastreador de valor no
    // ve diferencia), así que el onChange del formulario no se dispararía y
    // elegir un cliente no filtraría nada.
    oculto.current.form?.requestSubmit();
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setMarcado((i) => Math.min(i + 1, opciones.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (opciones[marcado]) elegir(opciones[marcado]); }
    else if (e.key === 'Escape') { setAbierto(false); setTexto(''); }
  }

  return (
    <div ref={caja} style={{ position: 'relative', ...estilo }}>
      <input ref={oculto} type="hidden" name="cliente" defaultValue={valor} />

      {/* Se ve y se abre como el desplegable de siempre; la diferencia es que
          al escribir, filtra. */}
      <button type="button" onClick={() => { setAbierto((v) => !v); setTexto(''); setMarcado(0); setTimeout(() => campo.current?.focus(), 0); }}
        title="Elige de la lista o escribe cualquier parte del nombre"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%',
          padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)',
          background: 'var(--panel)', color: valor ? 'var(--ink)' : 'var(--muted)',
          fontSize: 13, fontFamily: 'var(--ui)', cursor: 'pointer', textAlign: 'left', lineHeight: 1.3,
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor || TODOS}</span>
        <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, minWidth: '100%', width: 'max-content', maxWidth: 380,
          background: 'var(--panel)', border: '1px solid var(--edge-strong)', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(15,29,51,0.16)', overflow: 'hidden',
        }}>
          <div style={{ padding: 7, borderBottom: '1px solid var(--line)' }}>
            <input ref={campo} value={texto} onChange={(e) => { setTexto(e.target.value); setMarcado(0); }} onKeyDown={teclas}
              placeholder="Escribe cualquier palabra…" autoComplete="off"
              style={{ width: '100%', padding: '6px 9px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' }} />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {opciones.length === 1 && texto ? (
              // Solo quedó "Todos los clientes": nada coincidió. Decir con qué
              // no coincidió ahorra el "¿está mal escrito o no existe?".
              <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--muted)' }}>
                Ningún cliente coincide con <b style={{ color: 'var(--ink)' }}>«{texto}»</b>.
              </div>
            ) : opciones.map((c, i) => (
              <button key={c} type="button" onClick={() => elegir(c)} onMouseEnter={() => setMarcado(i)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  padding: '7px 12px', fontSize: 13, fontFamily: 'var(--ui)',
                  background: i === marcado ? 'var(--panel-2)' : 'transparent',
                  color: c === TODOS ? 'var(--muted)' : 'var(--ink)',
                  fontWeight: (c === valor || (c === TODOS && !valor)) ? 800 : 400,
                }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
