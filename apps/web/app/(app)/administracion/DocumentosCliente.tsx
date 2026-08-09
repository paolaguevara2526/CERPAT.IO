'use client';
// Documentos del cliente (actas, informes, soportes) almacenados en la plataforma.
// Muestra el almacenamiento consumido y permite subir, descargar y eliminar. El
// archivo se sube en base64 a /api/admin/empresas/:id/documentos (Postgres).

import { useEffect, useState, useCallback } from 'react';

type Doc = { id: string; tipo: string; nombre: string; mime: string; tamanoBytes: number; createdAt: string };
type Data = { total: number; totalBytes: number; porTipo: Record<string, number>; documentos: Doc[] };

const TIPOS: [string, string][] = [['acta', 'Acta'], ['informe', 'Informe'], ['soporte', 'Soporte'], ['otro', 'Otro']];
const MAX_MB = 20;
export const fmtBytes = (n: number) => (n <= 0 ? '0' : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`);
const etiquetaTipo = (t: string) => TIPOS.find(([k]) => k === t)?.[1] ?? t;
function fmtFecha(iso: string) { try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } }

const input: React.CSSProperties = { padding: '7px 9px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

export default function DocumentosCliente({ empresaId, onCambio }: { empresaId: string; onCambio?: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState('acta');
  const [subiendo, setSubiendo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const d = await fetch(`/api/admin/empresas/${empresaId}/documentos`, { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error); else setData(d);
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, [empresaId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function subir(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) { setError(`El archivo supera el máximo de ${MAX_MB} MB.`); return; }
    setSubiendo(true); setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error('read'));
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/admin/empresas/${empresaId}/documentos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nombre: file.name, mime: file.type || 'application/octet-stream', contenidoBase64: base64 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'No se pudo subir el archivo.'); setSubiendo(false); return; }
      await cargar(); onCambio?.();
    } catch { setError('Error de red.'); }
    setSubiendo(false);
  }

  async function descargar(doc: Doc) {
    setError(null);
    try {
      const d = await fetch(`/api/admin/documentos/${doc.id}`, { cache: 'no-store' }).then((r) => r.json());
      if (d.error) { setError(d.error); return; }
      const bin = atob(d.contenidoBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: d.mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = d.nombre || doc.nombre; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { setError('Error de red.'); }
  }

  async function eliminar(doc: Doc) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/documentos/${doc.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); return; }
      await cargar(); onCambio?.();
    } catch { setError('Error de red.'); }
  }

  return (
    <div>
      {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <div className="tile" style={{ flex: '0 0 auto', minWidth: 150 }}>
          <div className="k">Almacenamiento</div>
          <div className="v" style={{ fontSize: 20, color: 'var(--navy)' }}>{fmtBytes(data?.totalBytes ?? 0)}</div>
          <div className="s">{data?.total ?? 0} documento(s)</div>
        </div>
        {data && Object.keys(data.porTipo).length > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(data.porTipo).map(([t, b]) => <span key={t}>{etiquetaTipo(t)}: <b>{fmtBytes(b)}</b></span>)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={input}>
          {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="dbtn primary" style={{ fontSize: 12.5, cursor: subiendo ? 'default' : 'pointer', opacity: subiendo ? 0.6 : 1 }}>
          {subiendo ? 'Subiendo…' : '⬆ Subir documento'}
          <input type="file" disabled={subiendo} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.currentTarget.value = ''; }} style={{ display: 'none' }} />
        </label>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Máx. {MAX_MB} MB por archivo.</span>
      </div>

      {cargando ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Cargando…</div>
      ) : !data || data.documentos.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aún no hay documentos de este cliente.</div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="dt-wrap"><table className="dt">
            <thead><tr><th>Tipo</th><th>Documento</th><th style={{ whiteSpace: 'nowrap' }}>Tamaño</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              {data.documentos.map((d) => (
                <tr key={d.id}>
                  <td><span className="chip" style={{ fontSize: 10.5 }}>{etiquetaTipo(d.tipo)}</span></td>
                  <td style={{ fontWeight: 600 }}>
                    <button onClick={() => descargar(d)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--navy)', fontWeight: 600, fontFamily: 'var(--ui)', fontSize: 13, textAlign: 'left' }}>{d.nombre}</button>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12.5 }}>{fmtBytes(d.tamanoBytes)}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12.5 }}>{fmtFecha(d.createdAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="dbtn" onClick={() => descargar(d)} style={{ fontSize: 11, padding: '2px 7px' }}>Descargar</button>
                    <button className="dbtn" onClick={() => eliminar(d)} style={{ fontSize: 11, padding: '2px 7px', color: 'var(--peligro)', marginLeft: 4 }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
