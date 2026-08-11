'use client';
// Recepción del insumo del cliente.
//
// En las áreas donde el insumo lo manda el cliente no hay auxiliar que capture ni
// que libere, así que hasta ahora nada las destrababa: el trabajo quedaba
// esperando una liberación que no iba a llegar nunca.
//
// Va en Mi Día porque es donde el asesor ya está todas las mañanas y porque esta
// marca destraba SU propio trabajo. Enterrada en otra pantalla no se marcaría, y
// una marca que no se marca no mide nada.

import { useEffect, useState } from 'react';
import PanelPlegable from '@/app/_components/PanelPlegable';

type Fila = {
  empresaId: string; areaId: string; empresa: string; area: string;
  recibido: boolean; fechaEntrega: string | null; marcadoPor: string | null; diasEsperando: number;
};
type Resp = { periodo: string | null; total: number; pendientes: number; filas: Fila[] };

const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return '—'; }
};

export default function InsumoDelCliente() {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [msg, setMsg] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function cargar() {
    try {
      const r = await fetch('/api/plan/insumo-cliente', { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setData(d as Resp);
    } catch { /* silencioso: el panel se oculta si no aplica al usuario */ }
    finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);

  async function marcar(f: Fila) {
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch('/api/plan/insumo-cliente', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: f.empresaId, areaId: f.areaId, periodo: data?.periodo, fecha }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo marcar.'); return; }
      setAbierta(null); setFecha(hoyISO()); await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  async function deshacer(f: Fila) {
    if (!confirm(`¿Deshacer la marca de ${f.empresa} · ${f.area}? El trabajo de esa área vuelve a quedar en espera.`)) return;
    setTrabajando(true); setMsg(null);
    try {
      const q = new URLSearchParams({ empresaId: f.empresaId, areaId: f.areaId, periodo: data?.periodo ?? '' });
      const r = await fetch(`/api/plan/insumo-cliente?${q}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo deshacer.'); return; }
      await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  // Se oculta solo si el usuario no tiene áreas de insumo del cliente.
  if (cargando || !data || data.total === 0) return null;

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '8px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, borderBottom: '1px solid var(--line)', verticalAlign: 'middle' };

  return (
    <PanelPlegable
      id="insumo-del-cliente" titulo="📥 Esperando al cliente"
      nota="Áreas donde el insumo lo manda el cliente. Al marcar la recepción, el trabajo de esa área se destraba."
      resumen={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, background: data.pendientes > 0 ? 'var(--alerta-suave)' : 'var(--exito-suave)', border: `1px solid ${data.pendientes > 0 ? 'var(--alerta-borde)' : 'var(--exito-borde)'}`, borderRadius: 20, padding: '4px 12px' }}>
          <b style={{ fontSize: 14, color: data.pendientes > 0 ? 'var(--alerta-fuerte)' : 'var(--exito-fuerte)' }}>{data.pendientes}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>sin recibir</span>
        </span>
      }
    >
      {msg && <div style={{ margin: '10px 14px 0', background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '7px 11px', fontSize: 12.5, fontWeight: 600 }}>{msg}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>Área</th>
              <th style={th}>Recepción</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {data.filas.map((f) => {
              const clave = `${f.empresaId}|${f.areaId}`;
              return (
                <tr key={clave}>
                  <td style={{ ...td, fontWeight: 600 }}>{f.empresa}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{f.area}</td>
                  <td style={td}>
                    {f.recibido ? (
                      <span style={{ fontSize: 12.5, color: 'var(--exito-fuerte)', fontWeight: 700 }} title={f.marcadoPor ? `Marcado por ${f.marcadoPor}` : undefined}>
                        ✓ {fmt(f.fechaEntrega)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--alerta-fuerte)', fontWeight: 700 }}>
                        sin recibir{f.diasEsperando > 0 && <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {f.diasEsperando} día(s) del período</span>}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {f.recibido ? (
                      <button className="dbtn" disabled={trabajando} onClick={() => deshacer(f)} style={{ fontSize: 12, padding: '5px 10px' }}>Deshacer</button>
                    ) : abierta === clave ? (
                      // La fecha es la de ENTREGA, no la de hoy: el cliente manda
                      // el 3 y el asesor marca el 5. Grabar "hoy" le cargaría al
                      // cliente dos días de demora que no son suyos.
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)}
                          title="Fecha en que el cliente entregó, no la de hoy"
                          style={{ padding: '5px 7px', border: '1px solid var(--edge-strong)', borderRadius: 6, fontSize: 12.5, background: 'var(--panel)', color: 'var(--ink)' }} />
                        <button className="dbtn primary" disabled={trabajando} onClick={() => marcar(f)} style={{ fontSize: 12, padding: '5px 10px' }}>Confirmar</button>
                        <button className="dbtn" onClick={() => setAbierta(null)} style={{ fontSize: 12, padding: '5px 8px' }}>✕</button>
                      </span>
                    ) : (
                      <button className="dbtn" onClick={() => { setAbierta(clave); setFecha(hoyISO()); setMsg(null); }} style={{ fontSize: 12, padding: '5px 10px' }}>
                        Ya entregó
                      </button>
                    )}
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
