// apps/web/app/page.tsx
//
// Página provisional. Antes de construir esto de verdad:
//  1) Lee /CONTEXTO-PARA-CLAUDE-CODE.md
//  2) Abre /prototipo-referencia/planeador-cerpat.html en el navegador
//     para ver el diseño y comportamiento exacto de la vista "Inicio".
//
// TODO (Claude Code): reemplazar esto por el layout real con sidebar
// (Inicio, Calendario, Tablero, Lista, Mi Día, Pagos, Auditoría, Administración)
// una vez exista la autenticación y la conexión a la API.

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 40 }}>
      <h1>Planeador CERPAT — en construcción</h1>
      <p>
        Revisa <code>CONTEXTO-PARA-CLAUDE-CODE.md</code> y el prototipo de referencia antes de continuar.
      </p>
    </main>
  );
}
