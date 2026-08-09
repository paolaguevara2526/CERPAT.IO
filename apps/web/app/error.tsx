'use client';
// Pantalla de error. Antes, si una vista fallaba, quedaba el error crudo de
// Next.js —inútil para quien está trabajando—. Aquí se explica qué pasó, se
// ofrece reintentar sin perder la sesión y se deja una salida.

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <main className="pantalla-aviso">
      <div className="win aviso-caja">
        <div className="win-bar"><span className="win-title">Algo falló</span></div>
        <div className="win-body">
          <p className="aviso-texto">
            No pudimos cargar esta pantalla. Tu sesión sigue abierta y no se perdió nada de lo guardado.
          </p>
          <div className="aviso-acciones">
            <button className="dbtn green" onClick={reset}>Reintentar</button>
            <a className="dbtn" href="/planeador">Ir al inicio</a>
          </div>
          {error.digest && (
            <p className="aviso-nota">
              Si vuelve a pasar, pásanos este código: <code>{error.digest}</code>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
