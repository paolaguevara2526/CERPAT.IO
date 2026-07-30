'use client';
// Panel de Administración: parámetros de liquidación y catálogos base.
// Todo se guarda contra la API (proxy /api/admin/...), con reglas y permisos
// validados en el backend.

import { useEffect, useState, useCallback } from 'react';
import ActividadesEditor from './ActividadesEditor';
import VencimientosEditor from './VencimientosEditor';
import EmpresasEditor from './EmpresasEditor';

type Tab = { id: string; label: string; tipo?: string };
const TABS: Tab[] = [
  { id: 'parametros', label: 'Parámetros' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'actividades', label: 'Cat. Tareas' },
  { id: 'vencimientos', label: 'Vencimientos' },
  { id: 'areas', label: 'Áreas', tipo: 'areas' },
  { id: 'tipos-tarea', label: 'Tipos de tarea', tipo: 'tipos-tarea' },
  { id: 'tipos-obligacion', label: 'Tipos de obligación', tipo: 'tipos-obligacion' },
  { id: 'periodicidades', label: 'Periodicidades', tipo: 'periodicidades' },
  { id: 'etiquetas', label: 'Etiquetas', tipo: 'etiquetas' },
];

export default function AdminPanel() {
  const [tab, setTab] = useState('parametros');
  const activo = TABS.find((t) => t.id === tab)!;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', marginBottom: 18, paddingBottom: 2 }}>
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', fontSize: 13,
                fontWeight: on ? 800 : 600, color: on ? 'var(--navy)' : 'var(--muted)', padding: '8px 12px',
                borderBottom: on ? '2px solid var(--navy)' : '2px solid transparent', marginBottom: -3,
              }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {activo.tipo ? <CatalogoEditor key={activo.tipo} tipo={activo.tipo} label={activo.label} />
        : activo.id === 'actividades' ? <ActividadesEditor />
        : activo.id === 'empresas' ? <EmpresasEditor />
        : activo.id === 'vencimientos' ? <VencimientosEditor />
        : <ParametrosEditor />}
    </div>
  );
}

// ---------------- Catálogos simples ----------------

type Item = { id: string; nombre: string; orden?: number };

function CatalogoEditor({ tipo, label }: { tipo: string; label: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const conOrden = tipo !== 'etiquetas';

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/${tipo}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo cargar.'); setItems([]); }
      else setItems(data.items ?? []);
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, [tipo]);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    setGuardando(true); setError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/${tipo}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, orden: items.length }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'No se pudo crear.');
      else { setNuevo(''); await cargar(); }
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  async function renombrar(it: Item, nombre: string) {
    if (nombre.trim() === it.nombre || !nombre.trim()) return;
    const res = await fetch(`/api/admin/catalogos/${tipo}/${it.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim() }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'No se pudo renombrar.'); await cargar(); }
    else setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, nombre: nombre.trim() } : x)));
  }

  async function eliminar(it: Item) {
    if (!confirm(`¿Eliminar "${it.nombre}"?`)) return;
    const res = await fetch(`/api/admin/catalogos/${tipo}/${it.id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'No se pudo eliminar.'); }
    else setItems((prev) => prev.filter((x) => x.id !== it.id));
  }

  const input: React.CSSProperties = { padding: '8px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{label}</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} elemento(s)</span>
      </div>
      {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input style={{ ...input, flex: 1 }} value={nuevo} onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }} placeholder={`Nuevo elemento de ${label.toLowerCase()}…`} />
        <button className="dbtn primary" onClick={agregar} disabled={guardando || !nuevo.trim()} style={{ fontSize: 13 }}>＋ Agregar</button>
      </div>

      {cargando ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>Cargando…</div>
      ) : items.length === 0 ? (
        <div className="panel" style={{ padding: 22, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Aún no hay elementos.</div>
      ) : (
        <div className="panel">
          {items.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none' }}>
              {conOrden && <span style={{ fontSize: 11, color: 'var(--muted)', width: 22, textAlign: 'right' }}>{it.orden ?? i}</span>}
              <input defaultValue={it.nombre} onBlur={(e) => renombrar(it, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                style={{ ...input, flex: 1, padding: '5px 9px' }} />
              <button onClick={() => eliminar(it)} title="Eliminar" aria-label="Eliminar"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cf4436', fontSize: 15, padding: '2px 6px' }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Parámetros de liquidación ----------------

const CAMPOS: { k: string; label: string; sufijo?: string; ayuda?: string; step?: string }[] = [
  { k: 'valorUvt', label: 'Valor UVT', sufijo: '$', ayuda: 'Unidad de Valor Tributario del año' },
  { k: 'smmlv', label: 'SMMLV', sufijo: '$', ayuda: 'Salario mínimo mensual legal vigente' },
  { k: 'tasaMoraMensual', label: 'Tasa de mora mensual', step: '0.0001', ayuda: 'En decimal (ej. 0.2679)' },
  { k: 'sancionMinimaUvt', label: 'Sanción mínima', sufijo: 'UVT', step: '0.01' },
  { k: 'pctSancionExtemporaneidad', label: '% sanción extemporaneidad', step: '0.0001', ayuda: 'En decimal (0.05 = 5%)' },
];

function ParametrosEditor() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/parametros', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data.parametros) {
          const v: Record<string, string> = {};
          for (const c of CAMPOS) v[c.k] = data.parametros[c.k] != null ? String(data.parametros[c.k]) : '';
          setVals(v);
        }
      } catch { setError('Error de red.'); }
      setCargando(false);
    })();
  }, []);

  async function guardar() {
    setGuardando(true); setError(null); setOk(false);
    try {
      const res = await fetch('/api/admin/parametros', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vals),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'No se pudo guardar.');
      else { setOk(true); setTimeout(() => setOk(false), 1800); }
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  const input: React.CSSProperties = { padding: '9px 11px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 14, fontFamily: 'var(--ui)', width: '100%', textAlign: 'right' };

  if (cargando) return <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>Cargando…</div>;

  return (
    <div style={{ maxWidth: 460 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Parámetros de liquidación</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 16px' }}>Valores que usan las calculadoras y las liquidaciones. Actualízalos cada año (UVT, SMMLV).</p>
      {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {CAMPOS.map((c) => (
          <label key={c.k} style={{ display: 'grid', gridTemplateColumns: '1fr 170px', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{c.label}{c.sufijo ? <span style={{ color: 'var(--muted)', fontWeight: 500 }}> ({c.sufijo})</span> : null}
              {c.ayuda && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{c.ayuda}</span>}</span>
            <input type="number" min={0} step={c.step ?? '1'} style={input}
              value={vals[c.k] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [c.k]: e.target.value }))} />
          </label>
        ))}
      </div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13.5 }}>{guardando ? 'Guardando…' : 'Guardar parámetros'}</button>
        {ok && <span style={{ color: '#22a670', fontWeight: 700, fontSize: 13 }}>✓ Guardado</span>}
      </div>
    </div>
  );
}
