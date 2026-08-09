'use client';
// Registra el service worker y avisa cuando hay una versión nueva.
//
// La app NO se recarga sola: cuando hay una versión lista, aparece un banner y
// la persona decide cuándo actualizar. Una recarga por sorpresa en medio de un
// formulario cancela el trabajo — fue justo lo que impedía iniciar sesión (ver
// ADR-0006 en docs/arquitectura.md).
//
// Flujo: se busca versión nueva al abrir, al volver a la pestaña, al recuperar
// conexión y cada 30 min. Si hay una instalada y esperando, se muestra el aviso;
// al pulsar "Actualizar" se le ordena tomar el control y la página se recarga.

import { useEffect, useState } from 'react';

const CADA_30_MIN = 30 * 60 * 1000;

export default function PwaRegister() {
  const [espera, setEspera] = useState<ServiceWorker | null>(null);
  const [oculto, setOculto] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // App instalada (iOS antiguo no resuelve display-mode en CSS): se marca el
    // documento para que desktop.css abra el marco a pantalla completa.
    try {
      const iOSInstalada = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const instalada = iOSInstalada || window.matchMedia('(display-mode: standalone)').matches;
      if (instalada) document.documentElement.setAttribute('data-pwa', '1');
    } catch { /* navegador sin matchMedia: se ignora */ }

    // ¿Ya había un service worker controlando la página al cargar? Si no, esta es
    // la primera instalación: no es una actualización y no hay nada que avisar.
    const habiaControlador = !!navigator.serviceWorker.controller;

    let recargando = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    // Solo se recarga cuando el service worker nuevo toma el control, y eso solo
    // pasa después de que la persona pulse "Actualizar".
    const alCambiarControlador = () => {
      if (!habiaControlador || recargando) return;
      recargando = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', alCambiarControlador);

    let buscar = () => {};
    const buscarAlVolver = () => { if (!document.hidden) buscar(); };

    const registrar = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

        const anunciar = (sw: ServiceWorker | null) => {
          if (!sw || !habiaControlador) return;
          setEspera(sw);
          setOculto(false); // una versión aún más nueva vuelve a mostrar el aviso
        };

        if (reg.waiting) anunciar(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          if (!nuevo) return;
          nuevo.addEventListener('statechange', () => {
            // Instalada y con una versión previa activa = actualización lista.
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) anunciar(nuevo);
          });
        });

        buscar = () => { reg.update().catch(() => { /* sin conexión */ }); };
        timer = setInterval(buscar, CADA_30_MIN);
        document.addEventListener('visibilitychange', buscarAlVolver);
        window.addEventListener('online', buscar);
      } catch { /* el navegador no soporta PWA: la app funciona igual */ }
    };

    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });

    return () => {
      if (timer) clearInterval(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiarControlador);
      document.removeEventListener('visibilitychange', buscarAlVolver);
      window.removeEventListener('online', buscar);
    };
  }, []);

  if (!espera || oculto) return null;

  const actualizar = () => {
    setActualizando(true);
    espera.postMessage('saltar-espera'); // al tomar el control, se recarga sola
    // Red de seguridad: si el service worker no responde, se recarga igual.
    setTimeout(() => window.location.reload(), 3000);
  };

  return (
    <div className="upd-banner" role="status" aria-live="polite">
      <span className="upd-punto" />
      <span className="upd-texto">
        <b>Hay una versión nueva de la app</b>
        <span>Actualiza para tenerla. Tu trabajo sin guardar no se pierde.</span>
      </span>
      <button className="dbtn green" onClick={actualizar} disabled={actualizando}>
        {actualizando ? 'Actualizando…' : 'Actualizar'}
      </button>
      <button className="upd-cerrar" onClick={() => setOculto(true)} aria-label="Ahora no" title="Ahora no">×</button>
    </div>
  );
}
