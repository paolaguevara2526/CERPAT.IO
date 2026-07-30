'use client';
// Contenedor del planeador: barra lateral colapsable (se desliza a la izquierda)
// + contenido. La barra llega siempre hasta el fondo y recuerda si está
// colapsada (localStorage) entre vistas.

import { useEffect, useState } from 'react';
import PlaneadorSidebar from './PlaneadorSidebar';

const CLAVE = 'cerpat_sidebar_colapsado';

export default function PlaneadorShell({ esAdmin, esGestorHallazgos, children }: {
  esAdmin: boolean; esGestorHallazgos: boolean; children: React.ReactNode;
}) {
  const [colapsado, setColapsado] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setColapsado(localStorage.getItem(CLAVE) === '1');
    setListo(true);
  }, []);

  function toggle() {
    setColapsado((c) => {
      const n = !c;
      try { localStorage.setItem(CLAVE, n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Barra lateral deslizante */}
      <div style={{ width: colapsado ? 0 : 210, transition: listo ? 'width .2s ease' : 'none', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: 210, height: '100%', display: 'flex' }}>
          <PlaneadorSidebar esAdmin={esAdmin} esGestorHallazgos={esGestorHallazgos} />
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
          <button
            onClick={toggle}
            title={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
            aria-label={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28,
              border: '1px solid var(--edge-strong)', borderRadius: 6, background: 'var(--panel)', color: 'var(--ink)',
              cursor: 'pointer', fontSize: 15, lineHeight: 1, boxShadow: '0 1px 2px var(--lo)',
            }}
          >
            {colapsado ? '☰' : '‹'}
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>{children}</div>
      </div>
    </div>
  );
}
