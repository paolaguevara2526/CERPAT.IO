'use client';
// Registra el service worker de la PWA (solo en producción / navegador compatible).
import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registrar = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* sin PWA */ });
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });
  }, []);
  return null;
}
