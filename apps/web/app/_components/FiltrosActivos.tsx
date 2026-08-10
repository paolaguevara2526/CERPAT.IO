'use client';
// Qué embudos de columna están puestos ahora mismo, y cómo quitarlos.
//
// El embudo vive en el encabezado de su columna, y eso funciona mientras haya
// tabla. Cuando el filtro no deja pasar nada —desmarcar el último valor deja la
// selección vacía— algunas vistas dejan de dibujar la tabla, y con ella
// desaparece el único control que permitía deshacer el filtro. El usuario ve
// «Nada cumple los filtros» con todos los desplegables de arriba en «Todas» y
// no hay forma de saber qué lo está tapando.
//
// Esta barra existe para que un filtro puesto sea siempre visible y siempre
// reversible, haya o no filas debajo.

export type FiltroActivo = {
  clave: string;
  etiqueta: string;
  seleccion: Set<string> | null;
  /** Cuántos valores distintos tiene la columna, para decir "3 de 12". */
  total: number;
};

const MAX_NOMBRES = 2;

function describir(f: FiltroActivo): { texto: string; vacio: boolean } {
  const sel = f.seleccion!;
  if (sel.size === 0) return { texto: 'sin ningún valor marcado', vacio: true };
  const nombres = [...sel].sort((a, b) => a.localeCompare(b, 'es'));
  if (nombres.length <= MAX_NOMBRES) return { texto: nombres.join(', '), vacio: false };
  return { texto: `${nombres.length} de ${f.total} valores`, vacio: false };
}

export default function FiltrosActivos({ filtros, onQuitar, onQuitarTodos }: {
  filtros: FiltroActivo[];
  onQuitar: (clave: string) => void;
  onQuitarTodos: () => void;
}) {
  const activos = filtros.filter((f) => f.seleccion != null);
  if (activos.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>
        Filtros de columna
      </span>
      {activos.map((f) => {
        const { texto, vacio } = describir(f);
        const color = vacio ? 'var(--alerta-fuerte)' : 'var(--navy)';
        return (
          <span key={f.clave} className="chip" style={{
            color, borderColor: color, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600,
            background: vacio ? 'var(--alerta-suave)' : 'transparent',
          }}>
            {f.etiqueta}: <span style={{ fontWeight: 400 }}>{texto}</span>
            <button type="button" onClick={() => onQuitar(f.clave)} aria-label={`Quitar el filtro de ${f.etiqueta}`}
              title={`Quitar el filtro de ${f.etiqueta}`}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color, fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
          </span>
        );
      })}
      {activos.length > 1 && (
        <button className="dbtn" style={{ fontSize: 11.5, padding: '3px 8px' }} onClick={onQuitarTodos}>Quitar todos</button>
      )}
    </div>
  );
}
