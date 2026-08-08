'use client';
// Registra el service worker y mantiene la app SIEMPRE al día:
//  - busca versiones nuevas al abrir, al volver a la pestaña y cada 30 min;
//  - cuando una versión nueva toma el control, recarga sola;
//  - si el usuario está escribiendo, espera a que termine (no se pierde nada).

import { useEffect } from 'react';

const CADA_30_MIN = 30 * 60 * 1000;

export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let recargando = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    // ¿El usuario está escribiendo? No lo interrumpimos con una recarga.
    const escribiendo = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const recargar = () => {
      if (recargando) return;
      if (escribiendo()) return; // se reintenta al salir del campo o cambiar de pestaña
      recargando = true;
      window.location.reload();
    };

    // Cuando la versión nueva toma el control, la página se actualiza sola.
    navigator.serviceWorker.addEventListener('controllerchange', recargar);
    // Reintentos cuando el momento sea oportuno.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) recargar(); });
    window.addEventListener('focusout', () => setTimeout(recargar, 0));

    const registrar = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

        // Si ya hay una versión esperando, actívala de una.
        if (reg.waiting) reg.waiting.postMessage('saltar-espera');
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          if (!nuevo) return;
          nuevo.addEventListener('statechange', () => {
            // Instalada y con una versión previa activa = hay actualización lista.
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              nuevo.postMessage('saltar-espera');
            }
          });
        });

        const buscar = () => reg.update().catch(() => { /* sin conexión */ });
        timer = setInterval(buscar, CADA_30_MIN);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) buscar(); });
        window.addEventListener('online', buscar);
      } catch { /* el navegador no soporta PWA: la app funciona igual */ }
    };

    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });

    return () => { if (timer) clearInterval(timer); };
  }, []);

  return null;
}
