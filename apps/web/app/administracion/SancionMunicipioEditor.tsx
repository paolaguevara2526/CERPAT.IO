'use client';
// Sanción mínima propia por municipio (en UVT), para las obligaciones municipales
// (ICA/ReteICA/AutoICA/exógena municipal). Vacío = usa la sanción mínima general de
// la firma (pestaña Parámetros). Se guarda contra /api/admin/municipios/:id.

import { useEffect, useState, useCallback } from 'react';

type Muni = { id: string; nombre: string; departamento: string; sancionMinimaUvt: number | null };

const inp: React.CSSProperties = { padding: '6px 8px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: 110, textAlign: 'right' };

export default function SancionMunicipioEditor() {
  const [items, setItems] = useState<Muni[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const d = await fetch('/api/admin/municipios/sanciones', { cache: 'no-store' }).then((r) => r.json());
      if (d.error) { setError(d.error); setCargando(false); return; }
      const muns: Muni[] = d.municipios ?? [];
      setItems(muns);
      setDraft(Object.fromEntries(muns.map((m) => [m.id, m.sancionMinimaUvt != null ? String(m.sancionMinimaUvt) : ''])));
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardar(id: string) {
    setGuardando(id); setError(null);
    try {
      const raw = (draft[id] ?? '').trim();
      const r = await fetch(`/api/admin/municipios/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sancionMinimaUvt: raw === '' ? null : Number(raw) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo guardar.'); setGuardando(null); return; }
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, sancionMinimaUvt: d.sancionMinimaUvt } : m)));
      setOkId(id); setTimeout(() => setOkId((c) => (c === id ? null : c)), 1500);
    } catch { setError('Error de red.'); }
    setGuardando(null);
  }

  const original = (m: Muni) => (m.sancionMinimaUvt != null ? String(m.sancionMinimaUvt) : '');
  const sucio = (m: Muni) => (draft[m.id] ?? '') !== original(m);
  const filtrados = items.filter((m) => !q.trim() || `${m.nombre} ${m.departamento}`.toLowerCase().includes(q.trim().toLowerCase()));
  const conValor = items.filter((m) => m.sancionMinimaUvt != null).length;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 3px' }}>Sanción mínima por municipio</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px', maxWidth: 640 }}>
        Sanción mínima propia de cada municipio, en <b>UVT</b>, para sus obligaciones municipales (ICA / ReteICA / AutoICA / exógena municipal).
        Déjalo <b>vacío</b> para usar la sanción mínima general de la firma (pestaña <b>Parámetros</b>). {conValor > 0 && <span>· {conValor} municipio(s) con valor propio.</span>}
      </p>

      {error && <div className="panel" style={{ padding: '9px 12px', color: '#b42318', fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar municipio…" style={{ ...inp, width: 260, textAlign: 'left', marginBottom: 12 }} />

      {cargando ? (
        <div className="panel" style={{ padding: 20, color: 'var(--muted)' }}>Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div className="panel" style={{ padding: 20, color: 'var(--muted)' }}>Sin municipios que coincidan.</div>
      ) : (
        <div className="panel"><div className="dt-wrap dt-alta">
          <table className="dt">
            <thead><tr><th>Municipio</th><th>Departamento</th><th style={{ whiteSpace: 'nowrap' }}>Sanción mín. (UVT)</th><th></th></tr></thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                  <td style={{ color: 'var(--muted)' }}>{m.departamento}</td>
                  <td>
                    <input type="number" min={0} step="0.01" inputMode="decimal"
                      value={draft[m.id] ?? ''} placeholder="general"
                      onChange={(e) => setDraft((p) => ({ ...p, [m.id]: e.target.value }))}
                      style={inp} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {sucio(m) && <button className="dbtn primary" onClick={() => guardar(m.id)} disabled={guardando === m.id} style={{ fontSize: 12 }}>{guardando === m.id ? '…' : 'Guardar'}</button>}
                    {okId === m.id && <span style={{ color: '#16794c', fontSize: 12, fontWeight: 700, marginLeft: 6 }}>✓</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
}
