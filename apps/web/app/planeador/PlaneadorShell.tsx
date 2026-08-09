'use client';
// Contenedor del planeador: barra de la app + barra lateral + contenido.
// La barra lateral tiene tres modos: completo (210px) · solo íconos (56px) ·
// oculto (0). Arranca RECOGIDA a íconos para dejarle la pantalla al trabajo y,
// estando recogida, se despliega sola al pasar el mouse por encima —flotando
// sobre el contenido, sin moverlo— para no perder navegabilidad. En móvil queda
// oculta y se abre como cajón, que se cierra solo al elegir una opción.
// La elección manual del usuario se recuerda en el navegador.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import PlaneadorSidebar from './PlaneadorSidebar';
import TemaSelector from './TemaSelector';

const CLAVE = 'cerpat_sidebar_modo';
type Modo = 'completo' | 'iconos' | 'oculto';

// Modo sugerido según el ancho de la ventana.
// El menú arranca SIEMPRE recogido a íconos: la pantalla es para el trabajo, no
// para la navegación. No se pierde nada porque basta pasar el mouse por encima
// para que se despliegue sobre el contenido (ver `asomado` más abajo). Quien
// prefiera tenerlo fijo lo abre con el botón y se le recuerda.
function modoPorAncho(w: number): Modo {
  if (w < 760) return 'oculto';   // móvil: cajón
  return 'iconos';
}

export default function PlaneadorShell({ roles, esRoot, children }: {
  roles: string[]; esRoot: boolean; children: React.ReactNode;
}) {
  const [modo, setModo] = useState<Modo>('completo');
  const [movil, setMovil] = useState(false);
  const [listo, setListo] = useState(false);
  const [asomo, setAsomo] = useState(false);
  const ruta = usePathname();

  // Al montar y al cambiar el tamaño, ajusta el modo automáticamente. Si el
  // usuario eligió uno a mano, se respeta mientras el ancho lo permita.
  useEffect(() => {
    let guardado: Modo | null = null;
    try {
      const v = localStorage.getItem(CLAVE);
      if (v === 'completo' || v === 'iconos' || v === 'oculto') guardado = v;
    } catch { /* ignore */ }
    const aplicar = () => {
      const w = window.innerWidth;
      const esMovil = w < 760;
      setMovil(esMovil);
      // En móvil siempre se oculta; en el resto manda la preferencia guardada y,
      // si no hay, el recogido por defecto.
      setModo(esMovil ? 'oculto' : guardado ?? modoPorAncho(w));
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
    setAsomo(false);
    if (movil) setModo('oculto');
  // Debe reaccionar al cambio de ruta, no a cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  // Botón: en móvil abre/cierra el cajón; en escritorio cicla completo → íconos → oculto.
  function toggle() {
    setModo((m) => {
      const n: Modo = movil ? (m === 'oculto' ? 'completo' : 'oculto')
        : m === 'completo' ? 'iconos' : m === 'iconos' ? 'oculto' : 'completo';
      // Se recuerda la elección concreta, no solo "el usuario tocó el botón":
      // así la preferencia sobrevive al recargar.
      if (!movil) { try { localStorage.setItem(CLAVE, n); } catch { /* ignore */ } }
      return n;
    });
  }

  const ancho = modo === 'completo' ? 210 : modo === 'iconos' ? 56 : 0;
  const abiertoEnMovil = movil && modo !== 'oculto';
  // Recogido a íconos, el menú se "asoma" al pasar el mouse (o al llegar con el
  // teclado): se despliega ENCIMA del contenido, sin moverlo, y se recoge al
  // salir. Es lo que hace que tener el menú recogido no cueste navegabilidad.
  const compacto = modo === 'iconos' && !movil;
  const asomado = compacto && asomo;
  // Ancho que ocupa la columna en el flujo (el asomo no empuja el contenido).
  const anchoFlujo = abiertoEnMovil ? 210 : ancho;
  const flotante = abiertoEnMovil || asomado;

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
        {/* Hueco fijo que reserva la columna: mantiene el contenido quieto
            cuando el menú se asoma por encima. */}
        <div style={{ width: anchoFlujo, flexShrink: 0, transition: listo ? 'width .2s ease' : 'none' }} />

        {/* Barra lateral. Se sale del flujo cuando flota (cajón móvil o asomo). */}
        <div
          onMouseEnter={() => { if (compacto) setAsomo(true); }}
          onMouseLeave={() => setAsomo(false)}
          onFocus={() => { if (compacto) setAsomo(true); }}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAsomo(false); }}
          style={{
            position: 'absolute', top: 0, bottom: 0, left: 0,
            width: flotante ? 210 : ancho,
            transition: listo ? 'width .18s ease' : 'none',
            overflow: 'hidden', zIndex: 40,
            boxShadow: flotante ? '0 10px 30px rgba(10,18,34,.35)' : 'none',
          }}
        >
          <div style={{ width: compacto && !asomado ? 56 : 210, height: '100%', display: 'flex' }}>
            <PlaneadorSidebar roles={roles} esRoot={esRoot} soloIconos={compacto && !asomado} />
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
