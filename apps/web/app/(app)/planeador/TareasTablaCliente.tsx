'use client';
// La tabla de tareas (Lista, Mi Día, Tablero) con el filtro y el orden estándar.
//
// Era la tabla con más filas de la plataforma —miles de tareas por período— y la
// única forma de acotarla eran los filtros de la barra superior de cada vista.
// Ahora usa TablaDatos, así que trae embudo por columna, orden y contador, igual
// que Vencimientos o Asignaciones.
//
// Vive aparte porque las vistas que la usan se arman en el servidor: reciben los
// datos allá y se los pasan planos.

import TablaDatos, { type Columna } from '@/app/_components/TablaDatos';
import EstadoSelect from './EstadoSelect';
import { EditarTareaBoton } from './TareaModal';
import { ESTADO_META, type Tarea } from './tareas-datos';
import { fmtDia } from '@/lib/fechas';

function fmtFecha(iso: string): string {
  try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return ''; }
}

const guion = (v: string | null | undefined) => (v && v.trim() ? v : '—');

// Quién ejecuta cada fase, y qué cuenta para liberarle el insumo al asesor.
const FASE_META: Record<string, { label: string; color: string }> = {
  captura: { label: 'Captura', color: 'var(--info)' },
  procesamiento: { label: 'Procesamiento', color: 'var(--navy)' },
  revision: { label: 'Revisión', color: 'var(--alerta-fuerte)' },
};

export default function TareasTablaCliente({ tareas, mostrarAsesor = true, gestionable = false }: {
  tareas: Tarea[]; mostrarAsesor?: boolean; gestionable?: boolean;
}) {
  const columnas: Columna<Tarea>[] = [
    {
      clave: 'actividad', label: 'Actividad', valor: (t) => t.titulo, buscar: true,
      estiloCelda: { fontWeight: 600 },
      render: (t) => (
        <>
          {t.titulo}
          {t.bloqueada && (
            <span title="Esperando la entrega del insumo del cliente"
              style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--alerta)', background: 'var(--alerta-suave)', border: '1px solid var(--alerta-borde)', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
              🔒 Bloqueada
            </span>
          )}
        </>
      ),
    },
    { clave: 'cliente', label: 'Cliente', valor: (t) => guion(t.empresa), buscar: true, estiloCelda: { color: 'var(--muted)' } },
    {
      // La fase decide quién ejecuta (captura → auxiliar; el resto → asesor) y
      // cuándo se libera el insumo. Estaba en los datos pero no se veía, así que
      // no había forma de entender por qué una tarea le tocaba a uno o a otro.
      clave: 'fase', label: 'Fase', valor: (t) => FASE_META[t.fase ?? '']?.label ?? 'Sin fase',
      render: (t) => {
        const m = FASE_META[t.fase ?? ''];
        return m
          ? <span className="chip" style={{ color: m.color, borderColor: m.color }}>{m.label}</span>
          : <span className="chip" style={{ color: 'var(--alerta-fuerte)', borderColor: 'var(--alerta-fuerte)' }}
              title="Sin fase no se sabe quién la ejecuta ni cuenta para liberar el insumo al asesor. Se asigna en Administración → Cat. Tareas.">Sin fase</span>;
      },
    },
    { clave: 'area', label: 'Área', valor: (t) => guion(t.area), estiloCelda: { color: 'var(--muted)' } },
    ...(mostrarAsesor ? [{ clave: 'asesor', label: 'Asesor', valor: (t: Tarea) => guion(t.asesor), buscar: true, estiloCelda: { color: 'var(--muted)' } }] : []),
    { clave: 'auxiliar', label: 'Auxiliar', valor: (t) => guion(t.auxiliar), buscar: true, estiloCelda: { color: 'var(--muted)' } },
    {
      clave: 'vence', label: 'Vence', valor: (t) => fmtFecha(t.fechaVencimiento),
      // Se ordena por la fecha real; si no, "2 feb" iría antes que "10 ene".
      orden: (t) => t.fechaVencimiento.slice(0, 10),
      estiloCelda: { color: 'var(--muted)', whiteSpace: 'nowrap' },
    },
    {
      clave: 'estado', label: 'Estado',
      valor: (t) => ESTADO_META[t.estado]?.label ?? t.estado,
      render: (t) => <EstadoSelect id={t.id} estado={t.estado} />,
    },
  ];

  return (
    <TablaDatos
      filas={tareas}
      columnas={columnas}
      idDe={(t) => t.id}
      vacio="No hay tareas en este período."
      sinCoincidencias="Ninguna tarea cumple los filtros."
      acciones={gestionable ? (t) => <EditarTareaBoton id={t.id} /> : undefined}
    />
  );
}
