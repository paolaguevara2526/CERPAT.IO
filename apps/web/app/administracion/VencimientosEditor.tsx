'use client';
// Vencimientos: calendario tributario general (obligación, municipio, período,
// fecha, rango de NIT). Tabla con alta, edición en línea y borrado. Todo contra
// la API (proxy /api/admin/vencimientos), permisos validados en el backend.

import { useEffect, useState, useCallback } from 'react';

type Venc = { id: string; obligacion: string | null; obligacionId: string | null; municipio: string | null; periodo: string | null; fechaVencimiento: string; nitRango: string | null };
type Oblig = { id: string; nombre: string };

const input: React.CSSProperties = { padding: '6px 8px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'var(--ui)', width: '100%' };
const iso = (s: string) => (s ? s.slice(0, 10) : '');

export default function VencimientosEditor() {
  const [items, setItems] = useState<Venc[]>([]);
  const [obligaciones, setObligaciones] = useState<Oblig[]>([]);
  const [periodo, setPeriodo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState({ obligacionId: '', municipio: '', periodo: '', fechaVencimiento: '', nitRango: '' });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
    try {
      const res = await fetch(`/api/admin/vencimientos${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []); else setError(data.error || 'No se pudo cargar.');
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch('/api/admin/catalogos/tipos-obligacion', { cache: 'no-store' }).then((r) => r.json()).then((d) => setObligaciones(d.items ?? [])).catch(() => {});
  }, []);

  async function agregar() {
    if (!nuevo.fechaVencimiento) { setError('La fecha de vencimiento es obligatoria.'); return; }
    setGuardando(true); setError(null);
    try {
      const res = await fetch('/api/admin/vencimientos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevo) });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'No se pudo crear.');
      else { setNuevo({ obligacionId: '', municipio: '', periodo: '', fechaVencimiento: '', nitRango: '' }); await cargar(); }
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  async function patch(id: string, campo: string, valor: string) {
    const res = await fetch(`/api/admin/vencimientos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }) });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'No se pudo guardar.'); await cargar(); }
  }
  async function eliminar(v: Venc) {
    if (!confirm('¿Eliminar este vencimiento?')) return;
    const res = await fetch(`/api/admin/vencimientos/${v.id}`, { method: 'DELETE' });
    if (res.ok) setItems((p) => p.filter((x) => x.id !== v.id));
    else { const d = await res.json(); setError(d.error || 'No se pudo eliminar.'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Vencimientos <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--muted)' }}>(calendario tributario)</span></h2>
        <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Período <input style={{ ...input, width: 110 }} value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="YYYY-MM" />
        </label>
      </div>
      {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, margin: '8px 0' }}>{error}</div>}

      <div className="panel" style={{ marginTop: 10, overflowX: 'auto' }}>
        <table className="dt" style={{ minWidth: 720 }}>
          <thead>
            <tr><th style={{ minWidth: 160 }}>Obligación</th><th>Municipio</th><th style={{ width: 90 }}>Período</th><th style={{ width: 140 }}>Fecha</th><th>NIT (rango)</th><th style={{ width: 44 }}></th></tr>
          </thead>
          <tbody>
            {/* Fila de alta */}
            <tr style={{ background: 'var(--panel-2)' }}>
              <td>
                <select style={input} value={nuevo.obligacionId} onChange={(e) => setNuevo((n) => ({ ...n, obligacionId: e.target.value }))}>
                  <option value="">— Obligación —</option>
                  {obligaciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </td>
              <td><input style={input} value={nuevo.municipio} onChange={(e) => setNuevo((n) => ({ ...n, municipio: e.target.value }))} placeholder="Municipio" /></td>
              <td><input style={input} value={nuevo.periodo} onChange={(e) => setNuevo((n) => ({ ...n, periodo: e.target.value }))} placeholder="YYYY-MM" /></td>
              <td><input type="date" style={input} value={nuevo.fechaVencimiento} onChange={(e) => setNuevo((n) => ({ ...n, fechaVencimiento: e.target.value }))} /></td>
              <td><input style={input} value={nuevo.nitRango} onChange={(e) => setNuevo((n) => ({ ...n, nitRango: e.target.value }))} placeholder="0-9" /></td>
              <td><button className="dbtn primary" onClick={agregar} disabled={guardando} title="Agregar" style={{ fontSize: 12, padding: '5px 9px' }}>＋</button></td>
            </tr>
            {cargando ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No hay vencimientos{periodo ? ' para este período' : ''}.</td></tr>
            ) : items.map((v) => (
              <tr key={v.id}>
                <td>
                  <select style={input} defaultValue={v.obligacionId ?? ''} onChange={(e) => patch(v.id, 'obligacionId', e.target.value)}>
                    <option value="">— Sin obligación —</option>
                    {obligaciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                </td>
                <td><input style={input} defaultValue={v.municipio ?? ''} onBlur={(e) => patch(v.id, 'municipio', e.target.value)} /></td>
                <td><input style={input} defaultValue={v.periodo ?? ''} onBlur={(e) => patch(v.id, 'periodo', e.target.value)} /></td>
                <td><input type="date" style={input} defaultValue={iso(v.fechaVencimiento)} onChange={(e) => patch(v.id, 'fechaVencimiento', e.target.value)} /></td>
                <td><input style={input} defaultValue={v.nitRango ?? ''} onBlur={(e) => patch(v.id, 'nitRango', e.target.value)} /></td>
                <td><button onClick={() => eliminar(v)} title="Eliminar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cf4436', fontSize: 14 }}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '10px 2px 0' }}>Edita un campo y sal de él (o cambia la fecha/obligación) para guardar. Usa el filtro de período para acotar la lista.</p>
    </div>
  );
}
