'use client';
// Panel que se pliega, con memoria de si el usuario lo dejó abierto o cerrado.
//
// Mi Día apila varios bloques —lo propio, lo que ya se puede arrancar, lo de los
// auxiliares, la lista del período— y para el asesor eso son pantallas enteras
// de desplazamiento antes de llegar a su trabajo. Lo que solo consulta arranca
// plegado; lo que ejecuta, abierto.
//
// El encabezado sigue mostrando el resumen aunque esté cerrado: plegar no puede
// costar la información de un vistazo, o la persona acabaría abriéndolo siempre.

import { useEffect, useState } from 'react';

export default function PanelPlegable({ id, titulo, nota, resumen, abiertoPorDefecto = true, children }: {
  /** Identifica el panel para recordar su estado entre visitas. */
  id: string;
  titulo: React.ReactNode;
  /** Aclaración corta junto al título. */
  nota?: React.ReactNode;
  /** Contadores o chips; se ven también con el panel cerrado. */
  resumen?: React.ReactNode;
  abiertoPorDefecto?: boolean;
  children: React.ReactNode;
}) {
  const clave = `cerpat:panel:${id}`;
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  // Se lee después de montar, no durante el render: leer localStorage al pintar
  // hace que el servidor y el navegador rindan cosas distintas.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(clave);
      if (guardado === 'abierto' || guardado === 'cerrado') setAbierto(guardado === 'abierto');
    } catch { /* modo privado o almacenamiento bloqueado: se queda con el defecto */ }
  }, [clave]);

  function alternar() {
    setAbierto((v) => {
      try { window.localStorage.setItem(clave, v ? 'cerrado' : 'abierto'); } catch { /* ignorar */ }
      return !v;
    });
  }

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: abierto ? '1px solid var(--border)' : 'none' }}>
        <button
          type="button" onClick={alternar} aria-expanded={abierto}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'none',
            cursor: 'pointer', padding: 0, font: 'inherit', color: 'var(--ink)', textAlign: 'left',
          }}
        >
          <span aria-hidden style={{ color: 'var(--muted)', fontSize: 11, width: 12, display: 'inline-block', transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }}>▶</span>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</span>
        </button>
        {nota && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{nota}</span>}
        {resumen && <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>{resumen}</span>}
      </div>
      {abierto && children}
    </div>
  );
}
