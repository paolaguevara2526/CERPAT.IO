// apps/web/app/planeador/tareas.tsx
// Utilidades compartidas de las vistas de tareas del planeador.

import { apiFetch } from '@/lib/session';
import EstadoSelect from './EstadoSelect';
import { EditarTareaBoton } from './TareaModal';

export type Tarea = {
  id: string; titulo: string; estado: string; prioridad: string; auditoria: string;
  fechaVencimiento: string; periodo: string | null;
  empresa: string | null; area: string | null; asesor: string | null; auxiliar: string | null;
};
export type TareasResp = { periodo: string | null; total: number; tareas: Tarea[] };

export async function fetchTareas(qs: string): Promise<{ data: TareasResp | null; error: string | null }> {
  try {
    const res = await apiFetch(`/plan/tareas${qs ? `?${qs}` : ''}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as TareasResp, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

export const ESTADO_META: Record<string, { label: string; color: string }> = {
  por_iniciar: { label: 'Por iniciar', color: '#5b6a82' },
  en_curso: { label: 'En curso', color: '#2f6fd0' },
  en_revision: { label: 'En revisión', color: '#c67c00' },
  terminado: { label: 'Terminado', color: '#22a670' },
  auditado: { label: 'Auditado', color: '#1c8a5e' },
  no_realizado: { label: 'No realizado', color: '#cf4436' },
};

export const AREAS = ['Impuestos', 'Informes', 'Cumplimiento', 'Nómina', 'Tesorería'];

export function nombrePeriodo(periodo: string | null): string {
  if (!periodo) return '';
  const [y, m] = periodo.split('-').map(Number);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${meses[(m - 1) % 12]} ${y}`;
}

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return ''; }
}

export function TareasTabla({ tareas, mostrarAsesor = true, gestionable = false }: { tareas: Tarea[]; mostrarAsesor?: boolean; gestionable?: boolean }) {
  const cols = 6 + (mostrarAsesor ? 1 : 0) + (gestionable ? 1 : 0);
  return (
    <div className="panel">
      <div className="dt-wrap">
        <table className="dt">
          <thead>
            <tr>
              <th>Actividad</th><th>Cliente</th><th>Área</th>
              {mostrarAsesor && <th>Asesor</th>}<th>Auxiliar</th><th>Vence</th><th>Estado</th>
              {gestionable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {tareas.length === 0 ? (
              <tr><td colSpan={cols} style={{ padding: 34, textAlign: 'center', color: 'var(--muted)' }}>No hay tareas con estos filtros.</td></tr>
            ) : tareas.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.titulo}</td>
                <td style={{ color: 'var(--muted)' }}>{t.empresa ?? '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{t.area ?? '—'}</td>
                {mostrarAsesor && <td style={{ color: 'var(--muted)' }}>{t.asesor ?? '—'}</td>}
                <td style={{ color: 'var(--muted)' }}>{t.auxiliar ?? '—'}</td>
                <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtFecha(t.fechaVencimiento)}</td>
                <td><EstadoSelect id={t.id} estado={t.estado} /></td>
                {gestionable && <td><EditarTareaBoton id={t.id} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
