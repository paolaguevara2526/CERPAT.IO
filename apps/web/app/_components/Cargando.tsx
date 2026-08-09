// Esqueleto de carga. Las vistas se arman en el servidor: entre el clic y el
// contenido no pasaba NADA visible, y la plataforma se sentía lenta aunque no lo
// fuera. Esto ocupa el hueco con la forma aproximada de lo que va a llegar
// (título, tarjetas, tabla), que se percibe más rápido que un giro genérico.

export default function Cargando({ filas = 6 }: { filas?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="esq esq-titulo" />
      <div className="esq esq-sub" />
      <div className="esq-tarjetas">
        {[0, 1, 2].map((i) => <div key={i} className="esq esq-tarjeta" />)}
      </div>
      <div className="esq-tabla">
        {Array.from({ length: filas }, (_, i) => <div key={i} className="esq esq-fila" />)}
      </div>
    </div>
  );
}
