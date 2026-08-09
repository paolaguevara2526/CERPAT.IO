'use client';
// Cifras del cliente y obligaciones que se derivan de ellas.
//
// Las normas comparan contra el "año inmediatamente anterior", así que para
// evaluar 2026 se registran las cifras de 2025. Cada obligación muestra la
// cuenta completa —el tope en pesos y dónde queda el cliente— para que se pueda
// verificar a mano: nadie debería tener que confiar en un semáforo.
//
// El sistema SEÑALA las diferencias con la configuración actual; no la cambia.

import { useCallback, useEffect, useState } from 'react';

type Obl = {
  clave: string; titulo: string; norma: string;
  aplica: boolean | null; detalle: string;
  sugerido?: string; configurado: string | null; discrepa: boolean;
};
type Datos = {
  anioEvaluado: number; anioCifras: number;
  cifras: { anio: number; activosBrutos: string | null; ingresosBrutos: string | null; fuente: string | null; notas: string | null } | null;
  parametros: { anio: number; uvt: string; smmlv: string } | null;
  obligaciones: Obl[];
  editable: boolean;
};

const inp: React.CSSProperties = {
  padding: '7px 9px', borderRadius: 5, border: '1px solid var(--edge-strong)',
  background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 };

export default function ObligacionesCliente({ empresaId }: { empresaId: string }) {
  const [d, setD] = useState<Datos | null>(null);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ activosBrutos: '', ingresosBrutos: '', fuente: '' });
  const [ok, setOk] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/ficha/${empresaId}/obligaciones?anio=${anio}`, { cache: 'no-store' }).then((x) => x.json());
      if (r.error) { setError(r.error); return; }
      setD(r); setError(null);
      setForm({
        activosBrutos: r.cifras?.activosBrutos ?? '',
        ingresosBrutos: r.cifras?.ingresosBrutos ?? '',
        fuente: r.cifras?.fuente ?? '',
      });
    } catch { setError('Error de red.'); }
  }, [empresaId, anio]);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    if (!d) return;
    setError(null);
    const r = await fetch(`/api/ficha/${empresaId}/cifras`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anio: d.anioCifras, ...form }),
    });
    if (!r.ok) { const x = await r.json().catch(() => ({})); setError(x.error || 'No se pudo guardar.'); return; }
    setOk(true); setTimeout(() => setOk(false), 1600);
    cargar();
  }

  if (!d) return <div className="panel" style={{ padding: 20, color: 'var(--muted)' }}>{error ?? 'Cargando…'}</div>;

  const discrepancias = d.obligaciones.filter((o) => o.discrepa).length;
  const anios = [0, 1, 2].map((i) => new Date().getFullYear() - i);

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        Obligaciones por cifras
        <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>
          evaluando&nbsp;
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontFamily: 'var(--ui)' }}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </span>
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Las normas comparan contra el <strong>año inmediatamente anterior</strong>: para {d.anioEvaluado} se usan
          las cifras de <strong>{d.anioCifras}</strong>
          {d.parametros
            ? <>, con la UVT de ese año (<strong>${Math.round(Number(d.parametros.uvt)).toLocaleString('es-CO')}</strong>).</>
            : <> — pero <strong style={{ color: 'var(--peligro)' }}>faltan la UVT y el SMMLV de {d.anioCifras}</strong>, así que no se puede calcular. Cárgalos en <em>Administración → Parámetros por año</em>.</>}
        </p>

        {error && <div style={{ padding: '9px 12px', marginBottom: 12, borderRadius: 6, background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}

        {/* Cifras del año anterior */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
          <div>
            <span style={lbl}>Activos brutos {d.anioCifras}</span>
            <input style={inp} inputMode="numeric" disabled={!d.editable} value={form.activosBrutos}
              onChange={(e) => setForm((f) => ({ ...f, activosBrutos: e.target.value }))} />
          </div>
          <div>
            <span style={lbl}>Ingresos brutos {d.anioCifras}</span>
            <input style={inp} inputMode="numeric" disabled={!d.editable} value={form.ingresosBrutos}
              onChange={(e) => setForm((f) => ({ ...f, ingresosBrutos: e.target.value }))} />
          </div>
          <div>
            <span style={lbl}>Fuente del dato</span>
            <input style={inp} placeholder="declaración de renta, EEFF…" disabled={!d.editable} value={form.fuente}
              onChange={(e) => setForm((f) => ({ ...f, fuente: e.target.value }))} />
          </div>
          {d.editable && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="dbtn primary" onClick={guardar} style={{ fontSize: 13 }}>{ok ? '✓ Guardado' : 'Guardar cifras'}</button>
            </div>
          )}
        </div>

        {discrepancias > 0 && (
          <div style={{ padding: '10px 13px', marginBottom: 12, borderRadius: 6, background: 'var(--alerta-suave)', color: 'var(--alerta-fuerte)', fontSize: 12.5, lineHeight: 1.6 }}>
            <strong>{discrepancias} diferencia(s) con la configuración actual.</strong> El sistema solo lo señala:
            revisa si hay que ajustar la Config. tributaria del cliente o si la excepción está justificada.
          </div>
        )}

        <div className="dt-wrap">
          <table className="dt">
            <thead>
              <tr><th>Obligación</th><th>Norma</th><th>¿Aplica?</th><th>Configurado</th><th>Cuenta</th></tr>
            </thead>
            <tbody>
              {d.obligaciones.map((o) => (
                <tr key={o.clave} style={o.discrepa ? { background: 'var(--alerta-suave)' } : undefined}>
                  <td style={{ fontWeight: 600 }}>{o.titulo}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{o.norma}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {o.aplica == null
                      ? <span style={{ color: 'var(--muted)' }}>sin datos</span>
                      : <span className="chip" style={{ color: o.aplica ? 'var(--exito)' : 'var(--neutro)', borderColor: o.aplica ? 'var(--exito)' : 'var(--neutro)' }}>
                          {o.sugerido ?? (o.aplica ? 'Sí' : 'No')}
                        </span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: o.discrepa ? 'var(--alerta-fuerte)' : 'var(--muted)', fontWeight: o.discrepa ? 700 : 400 }}>
                    {o.configurado ?? '—'}
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{o.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
