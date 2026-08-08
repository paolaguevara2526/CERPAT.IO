'use client';
// Contenedor del planeador: barra lateral + contenido. La barra tiene tres modos:
//   completo (210px) · solo íconos (56px) · oculto (0)
// Se adapta sola al ancho de la pantalla: en escritorio arranca completa, en
// tablet pasa a solo íconos y en móvil queda oculta (se abre como cajón sobre el
// contenido). La preferencia manual del usuario se recuerda por tamaño.

import { useEffect, useState } from 'react';
import PlaneadorSidebar from './PlaneadorSidebar';
import TemaSelector from './TemaSelector';

const CLAVE = 'cerpat_sidebar_modo';
type Modo = 'completo' | 'iconos' | 'oculto';

// Modo sugerido según el ancho de la ventana.
function modoPorAncho(w: number): Modo {
  if (w < 760) return 'oculto';      // móvil: cajón
  if (w < 1180) return 'iconos';     // tablet / pantalla angosta
  return 'completo';
}

export default function PlaneadorShell({ roles, esRoot, children }: {
  roles: string[]; esRoot: boolean; children: React.ReactNode;
}) {
  const [modo, setModo] = useState<Modo>('completo');
  const [movil, setMovil] = useState(false);
  const [listo, setListo] = useState(false);

  // Al montar y al cambiar el tamaño, ajusta el modo automáticamente. Si el
  // usuario eligió uno a mano, se respeta mientras el ancho lo permita.
  useEffect(() => {
    let manual = false;
    try { manual = localStorage.getItem(CLAVE) === 'manual'; } catch { /* ignore */ }
    const aplicar = () => {
      const w = window.innerWidth;
      const esMovil = w < 760;
      setMovil(esMovil);
      const auto = modoPorAncho(w);
      // En móvil siempre se oculta; en el resto, el automático manda salvo que el
      // usuario haya tocado el botón en esta sesión.
      setModo((prev) => (esMovil ? 'oculto' : manual && prev !== 'oculto' ? prev : auto));
    };
    aplicar();
    setListo(true);
    window.addEventListener('resize', aplicar);
    return () => window.removeEventListener('resize', aplicar);
  }, []);

  // Botón: en móvil abre/cierra el cajón; en escritorio cicla completo → íconos → oculto.
  function toggle() {
    try { localStorage.setItem(CLAVE, 'manual'); } catch { /* ignore */ }
    setModo((m) => (movil ? (m === 'oculto' ? 'completo' : 'oculto')
      : m === 'completo' ? 'iconos' : m === 'iconos' ? 'oculto' : 'completo'));
  }

  const ancho = modo === 'completo' ? 210 : modo === 'iconos' ? 56 : 0;
  const abiertoEnMovil = movil && modo !== 'oculto';

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
      {/* Barra lateral. En móvil flota sobre el contenido (cajón). */}
      <div
        style={{
          width: abiertoEnMovil ? 210 : ancho,
          transition: listo ? 'width .2s ease' : 'none',
          overflow: 'hidden', flexShrink: 0,
          ...(abiertoEnMovil
            ? { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 40, boxShadow: '0 10px 30px rgba(10,18,34,.35)' }
            : {}),
        }}
      >
        <div style={{ width: modo === 'iconos' && !abiertoEnMovil ? 56 : 210, height: '100%', display: 'flex' }}>
          <PlaneadorSidebar roles={roles} esRoot={esRoot} soloIconos={modo === 'iconos' && !abiertoEnMovil} />
        </div>
      </div>

      {/* Velo para cerrar el cajón en móvil */}
      {abiertoEnMovil && (
        <div onClick={() => setModo('oculto')} style={{ position: 'absolute', inset: 0, background: 'rgba(10,18,34,.45)', zIndex: 30 }} />
      )}

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
          <button
            onClick={toggle}
            title={modo === 'oculto' ? 'Mostrar menú' : modo === 'completo' ? 'Solo íconos' : 'Ocultar menú'}
            aria-label="Cambiar el menú"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28,
              border: '1px solid var(--edge-strong)', borderRadius: 6, background: 'var(--panel)', color: 'var(--ink)',
              cursor: 'pointer', fontSize: 15, lineHeight: 1, boxShadow: '0 1px 2px var(--lo)', flexShrink: 0,
            }}
          >
            {modo === 'oculto' ? '☰' : '‹'}
          </button>
          <span style={{ flex: 1 }} />
          <TemaSelector />
        </div>
        <div className="app-content" style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>{children}</div>
      </div>
    </div>
  );
}
