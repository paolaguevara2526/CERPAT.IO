// Página no encontrada. Antes salía la pantalla por defecto de Next.js, en
// inglés y sin salida hacia la plataforma.

export const metadata = { title: 'Página no encontrada' };

export default function NoEncontrada() {
  return (
    <main className="pantalla-aviso">
      <div className="win aviso-caja">
        <div className="win-bar"><span className="win-title">Página no encontrada</span></div>
        <div className="win-body">
          <p className="aviso-texto">
            La dirección que abriste no existe o cambió de lugar.
          </p>
          <div className="aviso-acciones">
            <a className="dbtn green" href="/planeador">Ir al planeador</a>
            <a className="dbtn" href="/">Ir al sitio de CERPAT</a>
          </div>
        </div>
      </div>
    </main>
  );
}
