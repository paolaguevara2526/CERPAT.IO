// apps/web/app/planeador/asignaciones/page.tsx — Tablero de asignaciones.
// Coordinación/Administrador ve a todo el equipo (asesor y auxiliar por cliente y
// área) con un resumen por persona y el botón para sincronizar los responsables en
// las tareas ya generadas. Un Asesor/Auxiliar ve solo las empresas que tiene
// asignadas. Todo contra /api/plan/asignaciones (alcance validado en el backend).

import { apiFetch } from '@/lib/session';
import { exigirRuta } from '@/lib/acceso-server';
import SyncResponsablesBoton from './SyncResponsablesBoton';

export const dynamic = 'force-dynamic';

type Fila = { empresaId: string; empresa: string; asesor: string | null; auxiliar: string | null };
type AreaG = { areaId: string; area: string; filas: Fila[] };
type Persona = { id: string; nombre: string; asesorDe: number; auxiliarDe: number };
type Data = { esCoordinacion: boolean; yoId: string; areas: AreaG[]; personas: Persona[] };

async function fetchAsignaciones(): Promise<{ data: Data | null; error: string | null }> {
  try {
    const res = await apiFetch('/plan/asignaciones');
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

export default async function AsignacionesPage() {
  await exigirRuta('/planeador/asignaciones');
  const { data, error } = await fetchAsignaciones();
  const esCoord = !!data?.esCoordinacion;
  const areas = data?.areas ?? [];
  const personas = data?.personas ?? [];
  const totalEmpresas = new Set(areas.flatMap((a) => a.filas.map((f) => f.empresaId))).size;

  const guion = <span style={{ color: 'var(--muted)' }}>—</span>;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{esCoord ? 'Asignaciones del equipo' : 'Mis asignaciones'}</h1>
        {esCoord && <SyncResponsablesBoton />}
      </div>
      <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 13 }}>
        {esCoord
          ? 'Asesor y auxiliar responsables por cliente y área. Tras cambiar asignaciones (importar o editar), usa "Sincronizar responsables" para que se reflejen en las tareas ya generadas.'
          : 'Las empresas que tienes asignadas, por área, como asesor o auxiliar.'}
      </p>

      {error ? (
        <div className="panel" style={{ padding: '16px 18px', color: '#b42318', fontWeight: 600 }}>No se pudieron cargar las asignaciones: {error}.</div>
      ) : areas.length === 0 ? (
        <div className="panel" style={{ padding: 26, color: 'var(--muted)' }}>
          {esCoord ? 'Aún no hay asignaciones cargadas. Ve a Administración → Plan por cliente para asignar asesor y auxiliar por área (o importar el Excel).' : 'Todavía no tienes empresas asignadas. Cuando coordinación te asigne clientes por área, aparecerán aquí.'}
        </div>
      ) : (
        <>
          {esCoord && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
              <div className="tile"><div className="k">Clientes</div><div className="v" style={{ color: 'var(--navy)' }}>{totalEmpresas}</div><div className="s">con asignación</div></div>
              <div className="tile"><div className="k">Áreas</div><div className="v" style={{ color: 'var(--navy)' }}>{areas.length}</div><div className="s">con trabajo asignado</div></div>
              <div className="tile"><div className="k">Personas</div><div className="v" style={{ color: 'var(--navy)' }}>{personas.length}</div><div className="s">asesores y auxiliares</div></div>
            </div>
          )}

          {esCoord && personas.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px' }}>Por persona</h2>
              <div className="panel">
                <div className="dt-wrap">
                  <table className="dt">
                    <thead><tr><th>Persona</th><th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Clientes como asesor</th><th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Clientes como auxiliar</th></tr></thead>
                    <tbody>
                      {personas.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                          <td style={{ textAlign: 'right' }}>{p.asesorDe || guion}</td>
                          <td style={{ textAlign: 'right' }}>{p.auxiliarDe || guion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 10px' }}>Por área</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {areas.map((a) => (
              <div key={a.areaId}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>{a.area}</h3>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.filas.length} cliente(s)</span>
                </div>
                <div className="panel">
                  <div className="dt-wrap">
                    <table className="dt">
                      <thead><tr><th>Cliente</th><th>Asesor</th><th>Auxiliar</th></tr></thead>
                      <tbody>
                        {a.filas.map((f) => (
                          <tr key={f.empresaId}>
                            <td style={{ fontWeight: 600 }}>{f.empresa}</td>
                            <td>{f.asesor ?? guion}</td>
                            <td>{f.auxiliar ?? guion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
