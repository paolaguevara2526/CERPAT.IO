'use client';
// Contenedor del planeador: barra lateral + contenido. La barra tiene tres modos:
//   completo (210px) · solo íconos (56px) · oculto (0)
// Se adapta sola al ancho de la pantalla: en escritorio arranca completa, en
// tablet pasa a solo íconos y en móvil queda oculta (se abre como cajón sobre el
// contenido). La preferencia manual del usuario se recuerda por tamaño.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import PlaneadorSidebar from './PlaneadorSidebar';
import TemaSelector from './TemaSelector';

const CLAVE = 'cerpat_sidebar_modo';
type Modo = 'completo' | 'iconos' | 'oculto';

// ¿La app corre instalada (PWA) y no en una pestaña del navegador?
function esAppInstalada(): boolean {
  try {
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches;
  } catch { return false; }
}

// Modo sugerido según el ancho de la ventana. Instalada, la app es más ahorrativa
// con el espacio: el menú arranca en solo íconos y se despliega cuando hace falta.
function modoPorAncho(w: number, instalada: boolean): Modo {
  if (w < 760) return 'oculto';                    // móvil: cajón
  if (instalada) return w < 1500 ? 'iconos' : 'completo';
  if (w < 1180) return 'iconos';                   // tablet / pantalla angosta
  return 'completo';
}

export default function PlaneadorShell({ roles, esRoot, children }: {
  roles: string[]; esRoot: boolean; children: React.ReactNode;
}) {
  const [modo, setModo] = useState<Modo>('completo');
  const [movil, setMovil] = useState(false);
  const [listo, setListo] = useState(false);
  const ruta = usePathname();

  // Al montar y al cambiar el tamaño, ajusta el modo automáticamente. Si el
  // usuario eligió uno a mano, se respeta mientras el ancho lo permita.
  useEffect(() => {
    let manual = false;
    try { manual = localStorage.getItem(CLAVE) === 'manual'; } catch { /* ignore */ }
    const aplicar = () => {
      const w = window.innerWidth;
      const esMovil = w < 760;
      setMovil(esMovil);
      const auto = modoPorAncho(w, esAppInstalada());
      // En móvil siempre se oculta; en el resto, el automático manda salvo que el
      // usuario haya tocado el botón en esta sesión.
      setModo((prev) => (esMovil ? 'oculto' : manual && prev !== 'oculto' ? prev : auto));
    };
    aplicar();
    setListo(true);
    window.addEventListener('resize', aplicar);
    return () => window.removeEventListener('resize', aplicar);
  }, []);

  // El menú que se abre SOBRE el contenido (cajón en móvil) se cierra solo al
  // elegir una opción: ya cumplió su función y taparía lo que se va a leer. El
  // menú fijo de escritorio no se toca.
  useEffect(() => {
    if (movil) setModo('oculto');
  // Debe reaccionar al cambio de ruta, no a cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  // Botón: en móvil abre/cierra el cajón; en escritorio cicla completo → íconos → oculto.
  function toggle() {
    try { localStorage.setItem(CLAVE, 'manual'); } catch { /* ignore */ }
    setModo((m) => (movil ? (m === 'oculto' ? 'completo' : 'oculto')
      : m === 'completo' ? 'iconos' : m === 'iconos' ? 'oculto' : 'completo'));
  }

  const ancho = modo === 'completo' ? 210 : modo === 'iconos' ? 56 : 0;
  const abiertoEnMovil = movil && modo !== 'oculto';

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>
      {/* Barra única de la app: marca + control del menú + tema. Antes había dos
          bandas apiladas (el marco arriba y una barra de herramientas debajo);
          se fundieron en una sola para no gastar alto de pantalla. */}
      <div className="win-bar app-bar">
        {/* Dos versiones del logo: el blanco no se vería sobre el cromo claro
            del tema "Escritorio". desktop.css muestra la que corresponda. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="win-logo win-logo-blanco" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="win-logo win-logo-color" src="/logo-cerpat.svg" alt="CERPAT" />
        <button
          onClick={toggle}
          title={modo === 'oculto' ? 'Mostrar menú' : modo === 'completo' ? 'Solo íconos' : 'Ocultar menú'}
          aria-label="Cambiar el menú"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 26,
            border: '1px solid rgba(128,128,128,0.35)', borderRadius: 6, background: 'rgba(128,128,128,0.14)',
            color: 'inherit', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0,
          }}
        >
          {modo === 'oculto' ? '☰' : '‹'}
        </button>
        <span className="win-title">Planeador</span>
        <span className="win-path">cerpat.io/planeador</span>
        <TemaSelector />
        <div className="win-ctl">
          <button aria-label="Minimizar"><svg viewBox="0 0 12 12"><rect x="1.5" y="6" width="9" height="1.4" fill="currentColor" /></svg></button>
          <button aria-label="Maximizar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x="1.8" y="1.8" width="8.4" height="8.4" /></svg></button>
          <button className="close" aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button>
        </div>
      </div>

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
        <div className="app-content" style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '18px 20px' }}>{children}</div>
      </div>
    </div>
  );
}
