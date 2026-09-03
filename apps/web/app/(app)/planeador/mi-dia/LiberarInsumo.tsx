'use client';
// Liberar el insumo a cada asesor, por área.
//
// La captura del auxiliar vive en Informes y Nómina. Impuestos y Tesorería no
// tienen esa fase, así que no aparecían en la lista y no había forma de
// soltarle el mes al asesor de esas áreas. Esta bandeja lista los clientes
// del auxiliar con el asesor de cada área y deja liberar (o deshacer) ahí.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { alCambiarTarea } from '@/lib/eventos';
import PanelPlegable from '@/app/_components/PanelPlegable';
import TablaDatos, { type Columna } from '@/app/_components/TablaDatos';
import { fmtDia } from '@/lib/fechas';

type Fila = {
  empresaId: string; areaId: string; empresa: string; area: string;
  asesor: string | null; liberado: boolean; origen: string | null;
  fechaEntrega: string | null; marcadoPor: string | null;
  capturaPendiente: boolean; puedeLiberar: boolean; motivoBloqueo: string | null;
};
type Resp = { periodo: string | null; total: number; pendientes: number; filas: Fila[] };

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return '—'; }
};

const ORIGEN: Record<string, string> = {
  auto: 'auto',
  auxiliar: 'tú',
  manual: 'coordinación',
  cliente: 'cliente',
};

export default function LiberarInsumo() {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  // El mes sale de la URL, igual que el resto de la pantalla. Sin esto la
  // bandeja siempre mira el mes en curso: en la Lista parada en agosto, arriba
  // se veía septiembre — dos meses distintos en la misma pantalla.
  const params = useSearchParams();
  const periodoURL = params.get('periodo') ?? '';

  const cargar = useCallback(async () => {
    try {
      const qs = /^\d{4}-\d{2}$/.test(periodoURL) ? `?periodo=${encodeURIComponent(periodoURL)}` : '';
      const r = await fetch(`/api/plan/liberar-insumo${qs}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setData(d as Resp);
    } catch { /* el panel se oculta si no aplica */ }
    finally { setCargando(false); }
  }, [periodoURL]);

  useEffect(() => { cargar(); }, [cargar]);

  // Marcar la captura como Terminado pasa ABAJO, en la misma pantalla. Sin oír
  // ese aviso, la bandeja se queda diciendo "falta captura" de algo que se
  // acaba de terminar, y la pantalla se contradice a sí misma.
  useEffect(() => alCambiarTarea(() => { cargar(); }), [cargar]);

  async function liberar(f: Fila) {
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch('/api/plan/liberar-insumo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: f.empresaId, areaId: f.areaId, periodo: data?.periodo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo liberar.'); return; }
      await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  async function deshacer(f: Fila) {
    if (!confirm(`¿Quitar la liberación de ${f.empresa} · ${f.area}? El asesor de esa área vuelve a quedar en espera.`)) return;
    setTrabajando(true); setMsg(null);
    try {
      const q = new URLSearchParams({ empresaId: f.empresaId, areaId: f.areaId, periodo: data?.periodo ?? '' });
      const r = await fetch(`/api/plan/liberar-insumo?${q}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo deshacer.'); return; }
      await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  if (cargando || !data || data.total === 0) return null;

  const columnas: Columna<Fila>[] = [
    { clave: 'empresa', label: 'Cliente', valor: (f) => f.empresa, buscar: true, estiloCelda: { fontWeight: 600 } },
    { clave: 'area', label: 'Área', valor: (f) => f.area, estiloCelda: { color: 'var(--muted)' } },
    { clave: 'asesor', label: 'Asesor', valor: (f) => f.asesor ?? 'Sin asesor', buscar: true,
      render: (f) => f.asesor
        ? <span>{f.asesor}</span>
        : <span style={{ color: 'var(--alerta-fuerte)' }}>Sin asesor</span> },
    { clave: 'estado', label: 'Insumo',
      valor: (f) => (f.liberado ? 'liberado' : (f.capturaPendiente ? 'falta captura' : 'pendiente')),
      render: (f) => {
        if (f.liberado) {
          const quien = ORIGEN[f.origen ?? ''] ?? f.origen;
          return (
            <span style={{ fontSize: 12.5, color: 'var(--exito-fuerte)', fontWeight: 700, whiteSpace: 'nowrap' }}
              title={f.marcadoPor ? `Liberado por ${f.marcadoPor}` : undefined}>
              ✓ {fmt(f.fechaEntrega)}{quien ? ` · ${quien}` : ''}
            </span>
          );
        }
        if (f.capturaPendiente) {
          return <span style={{ fontSize: 12.5, color: 'var(--muted)' }} title={f.motivoBloqueo ?? undefined}>falta captura</span>;
        }
        return <span style={{ fontSize: 12.5, color: 'var(--alerta-fuerte)', fontWeight: 700 }}>pendiente</span>;
      } },
    { clave: 'accion', label: '', filtrable: false, ordenable: false, valor: () => '',
      estiloCelda: { textAlign: 'right', whiteSpace: 'nowrap' },
      render: (f) => {
        if (f.liberado) {
          const sePuedeDeshacer = f.origen === 'auxiliar' || f.origen === 'auto';
          if (!sePuedeDeshacer) return null;
          return <button className="dbtn" disabled={trabajando} onClick={() => deshacer(f)} style={{ fontSize: 12, padding: '5px 10px' }}>Deshacer</button>;
        }
        if (!f.puedeLiberar) return null;
        return <button className="dbtn primary" disabled={trabajando} onClick={() => liberar(f)} style={{ fontSize: 12, padding: '5px 10px' }}>Liberar</button>;
      } },
  ];

  return (
    <PanelPlegable
      id="liberar-insumo-asesores" titulo="📤 Liberar insumo a asesores"
      nota="Por área: Impuestos, Tesorería, Informes y Nómina se sueltan cada una a su asesor. No hay que esperar a terminar toda la captura del cliente."
      resumen={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, background: data.pendientes > 0 ? 'var(--alerta-suave)' : 'var(--exito-suave)', border: `1px solid ${data.pendientes > 0 ? 'var(--alerta-borde)' : 'var(--exito-borde)'}`, borderRadius: 20, padding: '4px 12px' }}>
          <b style={{ fontSize: 14, color: data.pendientes > 0 ? 'var(--alerta-fuerte)' : 'var(--exito-fuerte)' }}>{data.pendientes}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>sin liberar</span>
        </span>
      }
    >
      {msg && <div style={{ margin: '10px 14px 0', background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '7px 11px', fontSize: 12.5, fontWeight: 600 }}>{msg}</div>}
      <div style={{ padding: '10px 14px 4px' }}>
        <TablaDatos
          filas={data.filas}
          columnas={columnas}
          idDe={(f) => `${f.empresaId}|${f.areaId}`}
          vacio="No tienes áreas que liberar este período."
          sinCoincidencias="Ninguna cumple los filtros."
        />
      </div>
    </PanelPlegable>
  );
}
