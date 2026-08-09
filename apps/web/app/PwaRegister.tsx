'use client';
// Registra el service worker y mantiene la app al día, SIN interrumpir el trabajo.
//
// Regla de oro: la página solo se recarga sola cuando hay una versión nueva
// realmente instalada y esperando. Nunca por perder el foco de un campo, ni al
// volver a la pestaña, ni en la primera visita (cuando el service worker toma el
// control por primera vez). Una recarga inesperada en medio de un formulario
// —por ejemplo al pulsar "Entrar" en el login— cancela el envío y deja al
// usuario fuera; por eso el disparo va detrás de una bandera explícita.

import { useEffect } from 'react';

const CADA_30_MIN = 30 * 60 * 1000;

export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // ¿Ya había un service worker controlando la página al cargar? Si no, esta es
    // la primera instalación: su "controllerchange" NO es una actualización.
    const habiaControlador = !!navigator.serviceWorker.controller;

    let hayVersionNueva = false; // solo se recarga cuando esto es true
    let recargando = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    // ¿El usuario está escribiendo o enviando algo? No lo interrumpimos.
    const ocupado = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
      // Formulario en curso (botón enviando): tampoco.
      return !!el.closest?.('form');
    };

    const recargarSiTocaba = () => {
      if (!hayVersionNueva || recargando) return;
      if (ocupado()) return; // se reintenta al volver a la pestaña
      recargando = true;
      window.location.reload();
    };

    // La versión nueva tomó el control: recargar (salvo en la primera instalación).
    const alCambiarControlador = () => {
      if (!habiaControlador) return; // primera visita: nada que actualizar
      hayVersionNueva = true;
      recargarSiTocaba();
    };
    // Único reintento oportuno: al volver a la pestaña. (Antes también se
    // reintentaba en cada "focusout", lo que recargaba la página al pulsar un
    // botón fuera de un campo — incluido el de iniciar sesión.)
    const alVolverALaPestana = () => { if (!document.hidden) recargarSiTocaba(); };

    navigator.serviceWorker.addEventListener('controllerchange', alCambiarControlador);
    document.addEventListener('visibilitychange', alVolverALaPestana);

    let buscar = () => {};
    const buscarAlVolver = () => { if (!document.hidden) buscar(); };

    const registrar = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

        // Si ya hay una versión esperando, actívala de una.
        if (reg.waiting && habiaControlador) { hayVersionNueva = true; reg.waiting.postMessage('saltar-espera'); }
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          if (!nuevo) return;
          nuevo.addEventListener('statechange', () => {
            // Instalada y con una versión previa activa = hay actualización lista.
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              hayVersionNueva = true;
              nuevo.postMessage('saltar-espera');
            }
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
      document.removeEventListener('visibilitychange', alVolverALaPestana);
      document.removeEventListener('visibilitychange', buscarAlVolver);
      window.removeEventListener('online', buscar);
    };
  }, []);

  return null;
}
