'use client';
// UVT y SMMLV por año.
//
// Los topes de las normas (Art. 606, Ley 43/90, Art. 600, 905, 368-2, Dto.
// 1998/17) se expresan en estas unidades y se comparan contra el año anterior.
// Con un solo valor vigente, cada enero todos los cálculos quedarían mal sin que
// nadie se entere. Mientras falte el año que una regla necesita, la regla no
// calcula: dice que falta el dato.

import { useCallback, useEffect, useState } from 'react';

type Anio = { id: string; anio: number; uvt: string; smmlv: string };

const inp: React.CSSProperties = {
  padding: '7px 9px', borderRadius: 5, border: '1px solid var(--edge-strong)',
  background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 };
const cop = (v: string) => `$${Math.round(Number(v)).toLocaleString('es-CO')}`;

export default function ParametrosAnuales() {
  const [anios, setAnios] = useState<Anio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ anio: String(new Date().getFullYear() - 1), uvt: '', smmlv: '' });
  const [ok, setOk] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const d = await fetch('/api/admin/parametros-anuales', { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error); else { setAnios(d.anios ?? []); setError(null); }
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    setError(null);
    const r = await fetch(`/api/admin/parametros-anuales/${form.anio}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uvt: form.uvt, smmlv: form.smmlv }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo guardar.'); return; }
    setOk(true); setTimeout(() => setOk(false), 1600);
    setForm((f) => ({ ...f, uvt: '', smmlv: '' }));
    cargar();
  }

  async function borrar(anio: number) {
    if (!confirm(`¿Eliminar los valores de ${anio}? Las reglas que dependan de ese año dejarán de calcular.`)) return;
    const r = await fetch(`/api/admin/parametros-anuales/${anio}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); return; }
    cargar();
  }

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Parámetros por año — UVT y SMMLV</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 16px', maxWidth: 800, lineHeight: 1.6 }}>
        De estos valores dependen las obligaciones que se calculan por topes: firma de contador, revisor fiscal,
        periodicidad del IVA, conciliación fiscal, Régimen Simple y retención en personas naturales. Cada norma
        compara contra el <strong>año inmediatamente anterior</strong>, así que hay que tener el año de las cifras,
        no solo el actual.
      </p>

      {error && <div className="panel" style={{ padding: '10px 14px', color: 'var(--peligro-fuerte)', background: 'var(--peligro-suave)', borderColor: 'var(--peligro-borde)', fontWeight: 600, marginBottom: 14 }}>{error}</div>}

      {!cargando && anios.length === 0 && (
        <div className="panel" style={{ padding: '12px 15px', marginBottom: 14, fontSize: 13, lineHeight: 1.7, background: 'var(--alerta-suave)', color: 'var(--alerta-fuerte)', borderColor: 'var(--alerta-borde)' }}>
          <strong>Todavía no hay ningún año cargado.</strong> No se sembraron valores a propósito: un número
          equivocado aquí produciría obligaciones equivocadas en silencio. Cárgalos tú, empezando por el año
          anterior al que quieras evaluar.
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>Año</th><th style={{ textAlign: 'right' }}>UVT</th><th style={{ textAlign: 'right' }}>SMMLV</th><th style={{ width: 44 }} /></tr></thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
              ) : anios.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin años cargados.</td></tr>
              ) : anios.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 700 }}>{a.anio}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cop(a.uvt)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cop(a.smmlv)}</td>
                  <td><button className="dbtn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => borrar(a.anio)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, alignItems: 'end' }}>
          <div><span style={lbl}>Año</span><input style={inp} value={form.anio} onChange={(e) => setForm((f) => ({ ...f, anio: e.target.value }))} /></div>
          <div><span style={lbl}>UVT del año</span><input style={inp} inputMode="numeric" placeholder="49799" value={form.uvt} onChange={(e) => setForm((f) => ({ ...f, uvt: e.target.value }))} /></div>
          <div><span style={lbl}>SMMLV del año</span><input style={inp} inputMode="numeric" placeholder="1423500" value={form.smmlv} onChange={(e) => setForm((f) => ({ ...f, smmlv: e.target.value }))} /></div>
          <div><button className="dbtn green" onClick={guardar} style={{ fontSize: 13 }}>{ok ? '✓ Guardado' : 'Guardar año'}</button></div>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '12px 0 0' }}>
          Si el año ya existe, se actualiza.
        </p>
      </div>
    </div>
  );
}
