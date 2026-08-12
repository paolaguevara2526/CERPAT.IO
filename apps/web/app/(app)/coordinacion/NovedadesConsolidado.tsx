'use client';
// Novedades de toda la firma, para Coordinación: qué está frenando al equipo,
// cuánto tiempo costó y qué hizo cada quien al respecto.
//
// La suma por causa es la salida de este panel: "el internet nos costó 6 h este
// mes" es la frase que se lleva a una cotización o a un cambio de proveedor —
// el motivo por el que las novedades se registran en vez de contarse de palabra.

import { useEffect, useState } from 'react';
import { formatoMinutos } from '@/lib/tiempo-novedad';
import { fmtDia } from '@/lib/fechas';

type Opcion = { id: string; nombre: string };
type Novedad = {
  id: string; fecha: string; descripcion: string; planAccion: string;
  horaDesde: string | null; horaHasta: string | null; minutos: number | null;
  estado: string; cerradaEn: string | null;
  tipo: Opcion; usuario: Opcion; cerradaPor: Opcion | null;
  empresa: Opcion | null; area: Opcion | null;
};
type Resp = { total: number; abiertas: number; minutos: number; novedades: Novedad[] };

const fmtFecha = (iso: string) => {
  try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return '—'; }
};

export default function NovedadesConsolidado() {
  const [data, setData] = useState<Resp | null>(null);
  const [estado, setEstado] = useState<'todas' | 'abierta' | 'resuelta'>('todas');
  const [msg, setMsg] = useState<string | null>(null);

  async function cargar(filtro = estado) {
    try {
      const q = filtro === 'todas' ? '' : `&estado=${filtro}`;
      const r = await fetch(`/api/novedades?todas=1${q}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* silencioso */ }
  }
  useEffect(() => { cargar(); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cerrar(id: string) {
    setMsg(null);
    const r = await fetch(`/api/novedades/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'resuelta' }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'No se pudo cerrar.'); }
    await cargar();
  }

  // Sin novedades nunca reportadas, el panel no ocupa espacio en el tablero.
  if (!data || (data.total === 0 && estado === 'todas')) return null;

  // Minutos por causa, de mayor a menor: la lectura ejecutiva del panel.
  const porTipo = new Map<string, { n: number; minutos: number }>();
  for (const n of data.novedades) {
    const t = porTipo.get(n.tipo.nombre) ?? { n: 0, minutos: 0 };
    t.n += 1; t.minutos += n.minutos ?? 0;
    porTipo.set(n.tipo.nombre, t);
  }
  const causas = [...porTipo.entries()].sort((a, b) => b[1].minutos - a[1].minutos);

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px' }}>Novedades del equipo</h2>
      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
        Lo que frenó el trabajo, con el plan de acción de cada quien. No cambia el estado de ninguna tarea.
      </div>
      <div className="panel" style={{ padding: '14px 16px' }}>
        {msg && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {(['todas', 'abierta', 'resuelta'] as const).map((e) => (
            <button key={e} onClick={() => setEstado(e)}
              style={{
                fontSize: 12, fontWeight: estado === e ? 800 : 500, cursor: 'pointer', borderRadius: 20, padding: '4px 12px',
                border: '1px solid var(--edge-strong)', background: estado === e ? 'var(--brand, #2E5090)' : 'var(--panel)',
                color: estado === e ? '#fff' : 'var(--ink)',
              }}>
              {e === 'todas' ? 'Todas' : e === 'abierta' ? 'Abiertas' : 'Resueltas'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
            {data.total} novedad(es) · {data.abiertas} abierta(s) · <b>{formatoMinutos(data.minutos)}</b> en total
          </span>
        </div>

        {/* Suma por causa */}
        {causas.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {causas.map(([nombre, t]) => (
              <span key={nombre} style={{ fontSize: 11.5, border: '1px solid var(--line)', borderRadius: 20, padding: '4px 12px', color: 'var(--muted)' }}>
                <b style={{ color: 'var(--ink)' }}>{nombre}</b> · {t.n} · {formatoMinutos(t.minutos)}
              </span>
            ))}
          </div>
        )}

        {data.novedades.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '10px 0' }}>Ninguna con este filtro.</div>
        ) : (
          <div className="dt-wrap">
            <table className="dt">
              <thead>
                <tr><th>Fecha</th><th>Quién</th><th>Tipo</th><th>Qué pasó / plan de acción</th><th>Tiempo</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {data.novedades.map((n) => (
                  <tr key={n.id} style={{ opacity: n.estado === 'resuelta' ? 0.72 : 1 }}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fmtFecha(n.fecha)}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{n.usuario.nombre}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{n.tipo.nombre}</td>
                    <td style={{ minWidth: 260 }}>
                      <div style={{ fontSize: 12.5 }}>{n.descripcion}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}><b>Plan:</b> {n.planAccion}</div>
                      {(n.empresa || n.area) && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {[n.empresa?.nombre, n.area?.nombre].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{formatoMinutos(n.minutos)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {n.estado === 'resuelta'
                        ? <span title={n.cerradaPor ? `Cerrada por ${n.cerradaPor.nombre}` : undefined} style={{ fontSize: 11, fontWeight: 700, color: 'var(--exito-fuerte)', background: 'var(--exito-suave)', borderRadius: 20, padding: '2px 9px' }}>✓ resuelta</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--alerta-fuerte)', background: 'var(--alerta-suave)', borderRadius: 20, padding: '2px 9px' }}>abierta</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {n.estado === 'abierta' && (
                        <button className="dbtn" onClick={() => cerrar(n.id)} style={{ fontSize: 11.5, padding: '4px 9px' }}>Marcar resuelta</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
