'use client';
// Asignaciones por cliente: elige el cliente y define, por cada área, el asesor
// (responsable) y el auxiliar (ejecutor) y la talla. De aquí heredan el
// responsable las tareas del plan y los vencimientos vinculados.

import { useEffect, useState, useCallback } from 'react';

type Empresa = { id: string; nombre: string };
type Usuario = { id: string; nombre: string; activo?: boolean };
type Fila = { areaId: string; area: string; asesorId: string | null; auxiliarId: string | null; talla: string | null };

const TALLAS = ['', 'S', 'M', 'L', 'XL'];
const input: React.CSSProperties = { padding: '7px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };

export default function AsignacionesEditor() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/empresas', { cache: 'no-store' }).then((r) => r.json()).then((d) => setEmpresas((d.items ?? []).map((e: any) => ({ id: e.id, nombre: e.nombre })))).catch(() => {});
    fetch('/api/admin/usuarios', { cache: 'no-store' }).then((r) => r.json()).then((d) => setUsuarios((d.usuarios ?? []).filter((u: any) => u.activo !== false).map((u: any) => ({ id: u.id, nombre: u.nombre })))).catch(() => {});
  }, []);

  const cargar = useCallback(async (eid: string) => {
    if (!eid) { setFilas([]); return; }
    setCargando(true); setError(null); setAviso(null);
    try {
      const res = await fetch(`/api/admin/asignaciones/${eid}`, { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo cargar.'); setFilas([]); setCargando(false); return; }
      setFilas(d.areas ?? []);
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(empresaId); }, [empresaId, cargar]);

  const set = (areaId: string, campo: 'asesorId' | 'auxiliarId' | 'talla', valor: string) =>
    setFilas((fs) => fs.map((f) => f.areaId === areaId ? { ...f, [campo]: valor || null } : f));

  async function guardar() {
    setGuardando(true); setError(null); setAviso(null);
    try {
      const res = await fetch(`/api/admin/asignaciones/${empresaId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asignaciones: filas.map((f) => ({ areaId: f.areaId, asesorId: f.asesorId, auxiliarId: f.auxiliarId, talla: f.talla })) }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'No se pudo guardar.');
      else setAviso('Asignaciones guardadas. Al regenerar/generar, tareas y vencimientos heredan estos responsables.');
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  const filtradas = empresas.filter((e) => !q || e.nombre.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18 }}>
      {/* Clientes */}
      <div>
        <input style={{ ...input, width: '100%', marginBottom: 8 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" />
        <div className="panel" style={{ maxHeight: '62vh', overflow: 'auto' }}>
          {filtradas.map((e) => (
            <button key={e.id} onClick={() => setEmpresaId(e.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', fontSize: 12.5, fontWeight: e.id === empresaId ? 800 : 500, color: e.id === empresaId ? 'var(--brand, #2E5090)' : 'var(--ink)', background: e.id === empresaId ? 'color-mix(in srgb, var(--brand, #2E5090) 10%, transparent)' : 'transparent', fontFamily: 'var(--ui)' }}>
              {e.nombre}
            </button>
          ))}
          {filtradas.length === 0 && <div style={{ padding: 14, color: 'var(--muted)', fontSize: 12.5 }}>Sin clientes.</div>}
        </div>
      </div>

      {/* Detalle */}
      <div>
        {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
        {aviso && <div style={{ background: '#E6F4EA', color: '#137333', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{aviso}</div>}

        {!empresaId ? (
          <div className="panel" style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Selecciona un cliente para ver y editar sus asignaciones por área.</div>
        ) : cargando ? (
          <div className="panel" style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Define quién atiende a este cliente en cada área. El <b>asesor</b> es el responsable y el <b>auxiliar</b> el ejecutor; la <b>talla</b> es el tamaño del cliente en esa área.
            </p>
            <div className="panel" style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 11px', borderBottom: '1px solid var(--line)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Área</th>
                    <th style={{ textAlign: 'left', padding: '8px 11px', borderBottom: '1px solid var(--line)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Asesor</th>
                    <th style={{ textAlign: 'left', padding: '8px 11px', borderBottom: '1px solid var(--line)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Auxiliar</th>
                    <th style={{ textAlign: 'left', padding: '8px 11px', borderBottom: '1px solid var(--line)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', width: 90 }}>Talla</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={f.areaId}>
                      <td style={{ padding: '7px 11px', borderBottom: i < filas.length - 1 ? '1px solid var(--line)' : 'none', fontWeight: 700 }}>{f.area}</td>
                      <td style={{ padding: '7px 11px', borderBottom: i < filas.length - 1 ? '1px solid var(--line)' : 'none' }}>
                        <select style={{ ...input, width: '100%' }} value={f.asesorId ?? ''} onChange={(e) => set(f.areaId, 'asesorId', e.target.value)}>
                          <option value="">— Sin asesor —</option>
                          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '7px 11px', borderBottom: i < filas.length - 1 ? '1px solid var(--line)' : 'none' }}>
                        <select style={{ ...input, width: '100%' }} value={f.auxiliarId ?? ''} onChange={(e) => set(f.areaId, 'auxiliarId', e.target.value)}>
                          <option value="">— Sin auxiliar —</option>
                          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '7px 11px', borderBottom: i < filas.length - 1 ? '1px solid var(--line)' : 'none' }}>
                        <select style={{ ...input, width: '100%' }} value={f.talla ?? ''} onChange={(e) => set(f.areaId, 'talla', e.target.value)}>
                          {TALLAS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {filas.length === 0 && <tr><td colSpan={4} style={{ padding: 16, color: 'var(--muted)' }}>No hay áreas configuradas. Crea áreas en la pestaña “Áreas”.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="dbtn primary" onClick={guardar} disabled={guardando || filas.length === 0} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : 'Guardar asignaciones'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
