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

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PanelPlegable from '@/app/_components/PanelPlegable';
import TablaDatos, { type Columna } from '@/app/_components/TablaDatos';
import { fmtDia } from '@/lib/fechas';

type Fila = {
  empresaId: string; areaId: string; empresa: string; area: string;
  // Quién responde por esta fila. El API ya los mandaba; la tabla no los
  // mostraba, y sin ellos la pregunta "¿por qué me aparece este cliente?" no
  // tiene respuesta en pantalla — que es justo lo que se preguntó al ver un
  // cliente ajeno en la propia bandeja.
  asesor: string | null; auxiliar: string | null;
  recibido: boolean; fechaEntrega: string | null; marcadoPor: string | null; diasEsperando: number;
};
// Quien tiene rol de coordinación ve TODAS las áreas de la firma, no las suyas.
// El panel tiene que decir cuál de los dos alcances está mostrando: con el texto
// de "tus áreas" sobre la lista completa, ver ahí un cliente ajeno se lee como
// un error de asignación y se sale a corregir algo que está bien.
type Resp = { periodo: string | null; esCoordinacion?: boolean; total: number; pendientes: number; filas: Fila[] };

const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string | null) => {
  if (!iso) return '—';
  try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return '—'; }
};

// El mes lo manda la URL (navegador de período de Mi Día). Antes este panel
// pedía siempre el mes en curso: parado en agosto arriba, aquí se veía septiembre.
const PERIODO_RE = /^\d{4}-\d{2}$/;

export default function InsumoDelCliente() {
  const params = useSearchParams();
  const periodoURL = params.get('periodo') ?? '';
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [msg, setMsg] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const qs = PERIODO_RE.test(periodoURL) ? `?periodo=${encodeURIComponent(periodoURL)}` : '';
      const r = await fetch(`/api/plan/insumo-cliente${qs}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setData(d as Resp);
    } catch { /* silencioso: el panel se oculta si no aplica al usuario */ }
    finally { setCargando(false); }
  }, [periodoURL]);
  useEffect(() => { cargar(); }, [cargar]);

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


  // El valor de cada columna es TAMBIÉN por lo que se filtra: si el embudo
  // ofreciera algo distinto de lo que se ve, filtrar dejaría fuera filas que sí
  // cumplen.
  const columnas: Columna<Fila>[] = [
    { clave: 'empresa', label: 'Cliente', valor: (f) => f.empresa, buscar: true, estiloCelda: { fontWeight: 600 } },
    { clave: 'area', label: 'Área', valor: (f) => f.area, estiloCelda: { color: 'var(--muted)' } },
    // Aparece por ser asesor O auxiliar de ESA área. Sin decir cuál de los dos,
    // ver un cliente que "es de otro" se lee como un error de asignación.
    { clave: 'responsables', label: 'Responsables', valor: (f) => `${f.asesor ?? ''} ${f.auxiliar ?? ''}`.trim() || 'sin asignar',
      render: (f) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, fontSize: 11.5, lineHeight: 1.4 }}>
          <span><span style={{ color: 'var(--muted)' }}>Asesor </span>{f.asesor ?? <span style={{ color: 'var(--alerta-fuerte)', fontWeight: 700 }}>sin asignar</span>}</span>
          <span><span style={{ color: 'var(--muted)' }}>Auxiliar </span>{f.auxiliar ?? <span style={{ color: 'var(--muted)' }}>—</span>}</span>
        </span>
      ) },
    // Se filtra por "recibido"/"sin recibir", que es el corte que sirve: la
    // coordinadora quiere ver lo que falta, no ordenar por fecha.
    { clave: 'recepcion', label: 'Recepción', valor: (f) => (f.recibido ? 'recibido' : 'sin recibir'),
      orden: (f) => (f.recibido ? `1-${f.fechaEntrega ?? ''}` : `0-${String(f.diasEsperando).padStart(4, '0')}`),
      render: (f) => (f.recibido ? (
        <span style={{ fontSize: 12.5, color: 'var(--exito-fuerte)', fontWeight: 700, whiteSpace: 'nowrap' }} title={f.marcadoPor ? `Marcado por ${f.marcadoPor}` : undefined}>
          ✓ {fmt(f.fechaEntrega)}
        </span>
      ) : (
        <span style={{ fontSize: 12.5, color: 'var(--alerta-fuerte)', fontWeight: 700 }}>
          sin recibir{f.diasEsperando > 0 && <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {f.diasEsperando} día(s) del período</span>}
        </span>
      )) },
    { clave: 'accion', label: '', filtrable: false, ordenable: false, valor: () => '',
      estiloCelda: { textAlign: 'right', whiteSpace: 'nowrap' },
      render: (f) => {
        const clave = `${f.empresaId}|${f.areaId}`;
        if (f.recibido) return <button className="dbtn" disabled={trabajando} onClick={() => deshacer(f)} style={{ fontSize: 12, padding: '5px 10px' }}>Deshacer</button>;
        if (abierta === clave) {
          // La fecha es la de ENTREGA, no la de hoy: el cliente manda el 3 y el
          // asesor marca el 5. Grabar "hoy" le cargaría al cliente dos días de
          // demora que no son suyos.
          return (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)}
                title="Fecha en que el cliente entregó, no la de hoy"
                style={{ padding: '5px 7px', border: '1px solid var(--edge-strong)', borderRadius: 6, fontSize: 12.5, background: 'var(--panel)', color: 'var(--ink)' }} />
              <button className="dbtn primary" disabled={trabajando} onClick={() => marcar(f)} style={{ fontSize: 12, padding: '5px 10px' }}>Confirmar</button>
              <button className="dbtn" onClick={() => setAbierta(null)} style={{ fontSize: 12, padding: '5px 8px' }}>✕</button>
            </span>
          );
        }
        return <button className="dbtn" onClick={() => { setAbierta(clave); setFecha(hoyISO()); setMsg(null); }} style={{ fontSize: 12, padding: '5px 10px' }}>Ya entregó</button>;
      } },
  ];

  return (
    <PanelPlegable
      id="insumo-del-cliente" titulo="📥 Esperando al cliente"
      nota={`Áreas donde el insumo lo manda el cliente. ${
        data.esCoordinacion
          ? 'Ves las de TODA la firma porque tienes rol de coordinación, no solo las tuyas.'
          : 'Te aparecen aquellas donde eres asesor o auxiliar de esa área.'
      } Al marcar la recepción, el trabajo de esa área se destraba.`}
      resumen={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, background: data.pendientes > 0 ? 'var(--alerta-suave)' : 'var(--exito-suave)', border: `1px solid ${data.pendientes > 0 ? 'var(--alerta-borde)' : 'var(--exito-borde)'}`, borderRadius: 20, padding: '4px 12px' }}>
          <b style={{ fontSize: 14, color: data.pendientes > 0 ? 'var(--alerta-fuerte)' : 'var(--exito-fuerte)' }}>{data.pendientes}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>sin recibir</span>
        </span>
      }
    >
      {msg && <div style={{ margin: '10px 14px 0', background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '7px 11px', fontSize: 12.5, fontWeight: 600 }}>{msg}</div>}

      <div style={{ padding: '10px 14px 4px' }}>
        <TablaDatos
          filas={data.filas}
          columnas={columnas}
          idDe={(f) => `${f.empresaId}|${f.areaId}`}
          vacio="No hay áreas esperando insumo del cliente."
          sinCoincidencias="Ninguna cumple los filtros."
        />
      </div>
    </PanelPlegable>
  );
}
