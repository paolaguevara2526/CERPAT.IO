'use client';
// Aplicar el día hábil del catálogo a las tareas ya generadas de un período.
//
// Cambiar el día hábil de una actividad no toca lo que ya existe, y "Generar"
// tampoco: solo crea lo que falta. Sin esta acción, un plazo nuevo empezaría a
// valer el mes siguiente, y el mes en curso se quedaría con todo venciendo a
// fin de mes.
//
// No toca las tareas terminadas ni auditadas: su fecha de vencimiento es parte
// de lo que ya pasó, y reescribirla falsearía cualquier medición de
// cumplimiento que se haga después.

import { useState } from 'react';

type Previo = { periodo: string; afectadas: number; revisadas: number; ejemplos: string[] };

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };
const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function RecalcularFechas() {
  const [periodo, setPeriodo] = useState(periodoActual());
  const [previo, setPrevio] = useState<Previo | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  async function pedir(dryRun: boolean) {
    setTrabajando(true); setError(null); if (dryRun) setHecho(null);
    try {
      const r = await fetch('/api/admin/plan-cliente/recalcular-fechas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, dryRun }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo procesar.'); return; }
      if (dryRun) setPrevio(d);
      else { setHecho(`Se actualizó el plazo de ${d.afectadas} tarea(s) de ${d.periodo}.`); setPrevio(null); }
    } catch { setError('Error de red.'); } finally { setTrabajando(false); }
  }

  return (
    <div className="panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>Aplicar los días hábiles a un período ya generado</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', maxWidth: 820, lineHeight: 1.65 }}>
        Cuando cambias el <strong>día hábil de entrega</strong> de una actividad en <em>Cat. Tareas</em>, las tareas
        que ya existen conservan su plazo anterior — <em>Generar</em> solo crea lo que falta, no corrige lo hecho.
        Esto recalcula el plazo de las tareas del período según el catálogo actual.
        <strong> No toca las terminadas ni las auditadas</strong>: su fecha es parte de lo que ya pasó.
      </p>

      {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
      {hecho && <div style={{ background: 'var(--exito-suave)', color: 'var(--exito-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>✓ {hecho}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 }}>Período</span>
          <input value={periodo} onChange={(e) => { setPeriodo(e.target.value); setPrevio(null); setHecho(null); }} placeholder="2026-08" style={{ ...input, width: 120, fontFamily: 'var(--mono)' }} />
        </label>
        <button className="dbtn" onClick={() => pedir(true)} disabled={trabajando} style={{ fontSize: 13, height: 36 }}>
          {trabajando ? '…' : 'Simular recálculo'}
        </button>
      </div>

      {previo && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', marginTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: previo.ejemplos.length ? 8 : 0 }}>
            Cambiarían <b style={{ color: previo.afectadas ? 'var(--exito)' : 'var(--muted)' }}>{previo.afectadas}</b> tarea(s)
            <span style={{ color: 'var(--muted)' }}> · {previo.revisadas} revisadas (las que tienen día hábil y siguen abiertas)</span>
          </div>
          {previo.ejemplos.length > 0 && (
            <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
              {previo.ejemplos.map((e) => <div key={e}>· {e}</div>)}
            </div>
          )}
          {previo.afectadas > 0 && (
            <button className="dbtn primary" disabled={trabajando} onClick={() => pedir(false)} style={{ fontSize: 13 }}>
              {trabajando ? 'Aplicando…' : `Aplicar a ${previo.afectadas} tarea(s)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
