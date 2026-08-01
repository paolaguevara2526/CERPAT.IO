'use client';
// Vista de Vencimientos: KPIs del año + listado filtrable por empresa/mes/estado,
// con semáforo. El Administrador edita el estado y las notas en línea. Todo contra
// /api/vencimientos/... (permisos validados en el backend).

import { useEffect, useState, useCallback } from 'react';

const ANIO = 2026;
type Empresa = { id: string; nombre: string };
type Venc = {
  id: string; empresaId: string; empresa: string | null; obligacion: string; periodicidad: string | null;
  periodo: string | null; municipio: string | null; fechaVencimiento: string; estado: string; notas: string | null; vencido: boolean;
};
type Resumen = { kpis: { total: number; presentados: number; pendientes: number; vencidos: number } | null; porMes: number[] };

const ESTADO_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#5b6a82' },
  presentado_sin_pago: { label: 'Presentado (sin pago)', color: '#2f6fd0' },
  presentado_pagado: { label: 'Presentado y pagado', color: '#22a670' },
  no_presentado: { label: 'No presentado', color: '#cf4436' },
};
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
// La fecha se guarda como día calendario (medianoche UTC). Se arma desde las
// partes año-mes-día para mostrar el día exacto, sin corrimiento por zona horaria.
function fmtFecha(iso: string) { try { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } }

export default function VencimientosView({ esEditor }: { esEditor: boolean }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [items, setItems] = useState<Venc[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [mes, setMes] = useState('');
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarBase = useCallback(async () => {
    try {
      const [rr, re] = await Promise.all([
        fetch(`/api/vencimientos/resumen?anio=${ANIO}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/vencimientos/empresas?anio=${ANIO}`, { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (rr.error) { setError(rr.error); return; }
      setResumen(rr); setEmpresas(re.empresas ?? []);
    } catch { setError('Error de red.'); }
  }, []);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    const qs = new URLSearchParams({ anio: String(ANIO) });
    if (empresaId) qs.set('empresaId', empresaId);
    if (mes) qs.set('mes', mes);
    if (estado) qs.set('estado', estado);
    try {
      const d = await fetch(`/api/vencimientos?${qs.toString()}`, { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error); else { setItems(d.vencimientos ?? []); setError(null); }
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, [empresaId, mes, estado]);

  useEffect(() => { cargarBase(); }, [cargarBase]);
  useEffect(() => { cargarLista(); }, [cargarLista]);

  async function editar(v: Venc, campo: 'estado' | 'notas' | 'fechaVencimiento', valor: string) {
    const prev = items;
    setItems((p) => p.map((x) => (x.id === v.id ? { ...x, [campo]: valor } : x)));
    const r = await fetch(`/api/vencimientos/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }) });
    if (!r.ok) { setItems(prev); const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo guardar.'); return; }
    // Cambiar estado o fecha afecta KPIs y semáforo; la fecha además reordena la lista.
    if (campo === 'estado') cargarBase();
    else if (campo === 'fechaVencimiento') { cargarBase(); cargarLista(); }
  }

  const k = resumen?.kpis;
  const inputStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Vencimientos {ANIO}</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>Obligaciones tributarias generadas por cliente según su configuración y el calendario DIAN. {esEditor ? 'Marca presentado/pagado y ajusta la fecha si un calendario municipal cambió.' : 'Solo consulta.'}</p>

      {error && <div className="panel" style={{ padding: '10px 14px', color: '#b42318', fontWeight: 600, marginBottom: 14 }}>{error}</div>}

      {k && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
          <div className="tile"><div className="k">Vencimientos</div><div className="v" style={{ color: 'var(--navy)' }}>{k.total}</div><div className="s">en el año</div></div>
          <div className="tile"><div className="k">Presentados</div><div className="v" style={{ color: '#22a670' }}>{k.presentados}</div><div className="s">cumplidos</div></div>
          <div className="tile"><div className="k">Pendientes</div><div className="v" style={{ color: '#2f6fd0' }}>{k.pendientes}</div><div className="s">por vencer</div></div>
          <div className="tile"><div className="k">Vencidos</div><div className="v" style={{ color: k.vencidos ? '#cf4436' : '#8a94a6' }}>{k.vencidos}</div><div className="s">requieren atención</div></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
          <option value="">Todas las compañías</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={inputStyle}>
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputStyle}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 'auto' }}>{items.length} vencimiento(s)</span>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="dt" style={{ minWidth: 900 }}>
          <thead><tr>
            <th>Compañía</th><th>Obligación</th><th>Período</th><th>Vence</th><th>Estado</th><th>Notas</th>
          </tr></thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin vencimientos con estos filtros. Si aún no corres el generador, no habrá datos.</td></tr>
            ) : items.map((v) => {
              const em = ESTADO_META[v.estado] ?? ESTADO_META.pendiente;
              return (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600, minWidth: 160 }}>{v.empresa ?? '—'}</td>
                  <td style={{ minWidth: 150 }}>{v.obligacion}{v.municipio && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{v.municipio}</div>}{v.periodicidad && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{v.periodicidad}</div>}</td>
                  <td style={{ color: 'var(--muted)' }}>{v.periodo ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {esEditor ? (
                      <input type="date" defaultValue={v.fechaVencimiento.slice(0, 10)} key={v.fechaVencimiento}
                        onChange={(e) => { if (e.target.value && e.target.value !== v.fechaVencimiento.slice(0, 10)) editar(v, 'fechaVencimiento', e.target.value); }}
                        style={{ fontSize: 12, fontWeight: v.vencido ? 800 : 600, color: v.vencido ? '#cf4436' : 'var(--ink)', background: 'var(--panel)', border: `1px solid ${v.vencido ? '#cf443666' : 'var(--edge-strong)'}`, borderRadius: 4, padding: '4px 6px', fontFamily: 'var(--ui)' }} />
                    ) : (
                      <span style={{ fontWeight: v.vencido ? 800 : 500, color: v.vencido ? '#cf4436' : 'var(--muted)' }}>{fmtFecha(v.fechaVencimiento)}</span>
                    )}
                  </td>
                  <td>
                    {esEditor ? (
                      <select value={v.estado} onChange={(e) => editar(v, 'estado', e.target.value)} style={{ fontSize: 11.5, fontWeight: 700, color: v.vencido ? '#cf4436' : em.color, background: `${(v.vencido ? '#cf4436' : em.color)}18`, border: `1px solid ${(v.vencido ? '#cf4436' : em.color)}44`, borderRadius: 4, padding: '4px 6px', fontFamily: 'var(--ui)' }}>
                        {Object.entries(ESTADO_META).map(([id, m]) => <option key={id} value={id} style={{ color: '#111' }}>{m.label}</option>)}
                      </select>
                    ) : (
                      <span className="chip" style={{ color: v.vencido ? '#cf4436' : em.color, background: `${(v.vencido ? '#cf4436' : em.color)}18`, borderColor: `${(v.vencido ? '#cf4436' : em.color)}44` }}>{v.vencido ? 'Vencido' : em.label}</span>
                    )}
                  </td>
                  <td style={{ minWidth: 160 }}>
                    {esEditor ? (
                      <input defaultValue={v.notas ?? ''} onBlur={(e) => { if (e.target.value !== (v.notas ?? '')) editar(v, 'notas', e.target.value); }} placeholder="—"
                        style={{ width: '100%', padding: '5px 7px', borderRadius: 4, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12, fontFamily: 'var(--ui)' }} />
                    ) : (<span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{v.notas ?? '—'}</span>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
