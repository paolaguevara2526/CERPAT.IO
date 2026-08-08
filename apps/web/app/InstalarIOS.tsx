'use client';
// Aviso para instalar la app en iPhone. iOS/Safari no ofrece el botón "Instalar"
// (no soporta beforeinstallprompt), así que hay que indicar el gesto manual.
// Solo se muestra en iOS, fuera del modo instalado, y se puede descartar.

import { useEffect, useState } from 'react';

const CLAVE = 'cerpat_ios_instalar_oculto';

export default function InstalarIOS() {
  const [ver, setVer] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE) === '1') return;
      const ua = window.navigator.userAgent;
      const esIOS = /iPad|iPhone|iPod/.test(ua)
        // iPadOS 13+ se identifica como Mac con pantalla táctil
        || (/Macintosh/.test(ua) && 'ontouchend' in document);
      // Si ya está instalada (pantalla completa), no hay nada que sugerir.
      const instalada = (window.navigator as any).standalone === true
        || window.matchMedia('(display-mode: standalone)').matches;
      if (esIOS && !instalada) setVer(true);
    } catch { /* sin aviso */ }
  }, []);

  if (!ver) return null;

  function cerrar() {
    try { localStorage.setItem(CLAVE, '1'); } catch { /* ignore */ }
    setVer(false);
  }

  return (
    <div
      role="note"
      style={{
        position: 'fixed', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))',
        zIndex: 80, background: 'var(--panel)', color: 'var(--ink)',
        border: '1px solid var(--edge-strong)', borderRadius: 12,
        boxShadow: '0 10px 30px rgba(10,18,34,.28)', padding: '11px 12px',
        display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--ui)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/apple-icon.png" alt="" width={34} height={34} style={{ borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>
        <b>Instala CERPAT en tu iPhone</b>
        <div style={{ color: 'var(--muted)' }}>
          Toca <b>Compartir</b>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-2px', margin: '0 3px' }}>
            <path d="M12 16V4M12 4L8 8M12 4l4 4M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5" />
          </svg>
          y luego <b>Añadir a pantalla de inicio</b>.
        </div>
      </div>
      <button
        onClick={cerrar}
        aria-label="Cerrar aviso"
        style={{ border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}
