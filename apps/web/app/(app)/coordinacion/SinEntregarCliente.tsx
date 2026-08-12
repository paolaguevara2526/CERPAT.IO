// Clientes que no han entregado su insumo, en las áreas donde el insumo lo manda
// el cliente.
//
// Es la contraparte del panel del asesor, pero consolidada. No es un problema de
// operación sino de negocio: la firma no puede trabajar y no es culpa de nadie
// del equipo. Cuando un cliente reclama que se le entregó tarde, esta lista es la
// respuesta — con fechas, no con recuerdos.

import { apiFetch } from '@/lib/session';
import { fmtDia } from '@/lib/fechas';

type Fila = {
  empresaId: string; areaId: string; empresa: string; area: string;
  asesor: string | null; auxiliar: string | null;
  recibido: boolean; fechaEntrega: string | null; diasEsperando: number;
};

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return '—'; }
};

export default async function SinEntregarCliente({ periodo }: { periodo?: string }) {
  let filas: Fila[] = [];
  try {
    const res = await apiFetch(`/plan/insumo-cliente${periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''}`);
    if (!res.ok) return null;
    filas = ((await res.json())?.filas ?? []) as Fila[];
  } catch { return null; }

  // Si la firma no tiene áreas de insumo del cliente, la sección no existe.
  if (filas.length === 0) return null;
  const pendientes = filas.filter((f) => !f.recibido).sort((a, b) => b.diasEsperando - a.diasEsperando);
  const recibidas = filas.length - pendientes.length;

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>
        Insumo del cliente
        <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--muted)' }}> (áreas donde el insumo lo manda el cliente · {recibidas} de {filas.length} recibidas)</span>
      </h2>
      <div className="panel">
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>Cliente</th><th>Área</th><th>Asesor</th><th style={{ textAlign: 'right' }}>Esperando</th></tr></thead>
            <tbody>
              {pendientes.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>Todos los clientes entregaron este período. 🎉</td></tr>
              ) : pendientes.map((f) => (
                <tr key={`${f.empresaId}|${f.areaId}`}>
                  <td style={{ fontWeight: 600 }}>{f.empresa}</td>
                  <td style={{ color: 'var(--muted)' }}>{f.area}</td>
                  <td style={{ color: 'var(--muted)' }}>{f.asesor ?? '—'}</td>
                  {/* Ordenado por el que más se demora: es el orden en que
                      conviene levantar el teléfono. */}
                  <td style={{ textAlign: 'right', fontWeight: 800, color: f.diasEsperando >= 15 ? 'var(--peligro)' : f.diasEsperando >= 8 ? 'var(--alerta-fuerte)' : 'var(--muted)' }}>
                    {f.diasEsperando} día(s)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {recibidas > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--muted)' }}>Ver las {recibidas} ya recibidas y en qué fecha</summary>
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>
            {filas.filter((f) => f.recibido).map((f) => (
              <div key={`${f.empresaId}|${f.areaId}`}>· {f.empresa} — {f.area}: <b style={{ color: 'var(--exito-fuerte)' }}>{fmt(f.fechaEntrega)}</b></div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
