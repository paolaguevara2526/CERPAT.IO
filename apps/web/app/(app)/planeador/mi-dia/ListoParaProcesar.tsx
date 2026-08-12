'use client';
// Bandeja "listo para procesar" (F1 — vistas por rol). Contraparte del auxiliar:
// muestra las tareas de PROCESAMIENTO del asesor cuyo insumo ya fue entregado
// (auto o manual) y siguen pendientes, para que arranque sin buscar cliente por
// cliente. Se oculta si no hay nada listo.

import { useEffect, useState } from 'react';
import PanelPlegable from '@/app/_components/PanelPlegable';

const ESTADOS: Record<string, { label: string; color: string }> = {
  por_iniciar: { label: 'Por iniciar', color: 'var(--muted)' },
  en_curso: { label: 'En curso', color: 'var(--info)' },
  en_revision: { label: 'En revisión', color: 'var(--alerta)' },
  terminado: { label: 'Terminado', color: 'var(--exito)' },
  no_realizado: { label: 'No realizado', color: 'var(--peligro)' },
  no_aplica: { label: 'No aplica', color: 'var(--neutro)' },
};
const ESTADOS_EDIT = ['por_iniciar', 'en_curso', 'en_revision', 'terminado', 'no_realizado', 'no_aplica'];

type Fila = {
  id: string; titulo: string; estado: string; empresa: string; area: string | null;
  fechaVencimiento: string; listoDesde: string;
};
type Resp = { periodo: string | null; total: number; tareas: Fila[] };

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return '—'; }
}
function listoRel(iso: string): string {
  try {
    const d = new Date(iso); const hoy = new Date();
    const dias = Math.floor((Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    return `hace ${dias} días`;
  } catch { return fmtFecha(iso); }
}

export default function ListoParaProcesar() {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; texto: string } | null>(null);

  async function cargar() {
    try {
      const r = await fetch('/api/planeador/gestion/mi-dia/procesar', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { setError(d?.error ?? `La API respondió ${r.status}`); return; }
      setData(d as Resp); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);

  async function cambiarEstado(id: string, estado: string) {
    try {
      const r = await fetch('/api/planeador/tarea-estado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estado }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ id, texto: d?.error ?? 'No se pudo cambiar el estado.' }); return; }
      setMsg(null); await cargar();
    } catch { setMsg({ id, texto: 'Error de red al cambiar el estado.' }); }
  }

  // Silencioso mientras carga o si no hay nada listo (no aplica al rol del usuario).
  if (cargando || error || !data || data.total === 0) return null;

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
  const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5, background: 'var(--card, #fff)', color: 'inherit' };

  return (
    // Abierto por defecto: para el asesor es su trabajo, no una consulta.
    <PanelPlegable
      id="listo-para-procesar" titulo="🟢 Listo para procesar"
      nota="El insumo ya fue entregado — puedes arrancar."
      resumen={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, background: 'var(--exito-suave)', border: '1px solid #bfe8d2', borderRadius: 20, padding: '4px 12px' }}>
          <b style={{ fontSize: 14, color: 'var(--green-edge)' }}>{data.total}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>por procesar</span>
        </span>
      }
    >

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>Actividad</th>
              <th style={th}>Área</th>
              <th style={th}>Listo</th>
              <th style={th}>Vence</th>
              <th style={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.tareas.map((t) => {
              const em = ESTADOS[t.estado] ?? { label: t.estado, color: 'var(--muted)' };
              return (
                <tr key={t.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{t.empresa}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{t.titulo}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{t.area ?? '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <span title={fmtFecha(t.listoDesde)} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--green-edge)', background: 'var(--exito-suave)', border: '1px solid #bfe8d2', borderRadius: 20, padding: '2px 8px' }}>✓ {listoRel(t.listoDesde)}</span>
                  </td>
                  <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtFecha(t.fechaVencimiento)}</td>
                  <td style={td}>
                    <select value={t.estado} onChange={(e) => cambiarEstado(t.id, e.target.value)} style={{ ...inp, fontWeight: 700, color: em.color, cursor: 'pointer' }}>
                      {ESTADOS_EDIT.map((e) => <option key={e} value={e}>{ESTADOS[e].label}</option>)}
                    </select>
                    {msg && msg.id === t.id && <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--peligro-fuerte)', fontWeight: 600 }}>{msg.texto}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PanelPlegable>
  );
}
