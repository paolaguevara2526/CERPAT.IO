'use client';
// Aplicar los responsables actuales a lo ya generado del período.
//
// La tarea nace con el asesor y el auxiliar que tenía la asignación en ese
// momento, y guardar el plan no reescribe lo ya creado. El desenlace real es
// este: se corrige la asignación, se da por resuelto, y a la persona equivocada
// le sigue apareciendo el trabajo todo el mes.
//
// No toca las terminadas ni las auditadas: cambiarles el responsable falsearía
// quién hizo un trabajo que ya se hizo.

import { useState } from 'react';

type Previo = { periodo: string; tareas: number; vencimientos: number; revisadas: number; ejemplos: string[] };

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };
const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function ResincronizarResponsables() {
  const [periodo, setPeriodo] = useState(periodoActual());
  const [previo, setPrevio] = useState<Previo | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  async function pedir(dryRun: boolean) {
    setTrabajando(true); setError(null); if (dryRun) setHecho(null);
    try {
      const r = await fetch('/api/admin/plan-cliente/resincronizar-responsables', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, dryRun }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo procesar.'); return; }
      if (dryRun) setPrevio(d);
      else { setHecho(`Se actualizó el responsable de ${d.tareas} tarea(s) y ${d.vencimientos} vencimiento(s) de ${d.periodo}.`); setPrevio(null); }
    } catch { setError('Error de red.'); } finally { setTrabajando(false); }
  }

  const total = previo ? previo.tareas + previo.vencimientos : 0;

  return (
    <div className="panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>Aplicar los responsables a un período ya generado</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', maxWidth: 820, lineHeight: 1.65 }}>
        Una tarea nace con el asesor y el auxiliar que tenía la asignación <em>en ese momento</em>. Corregir la
        asignación después <strong>no reescribe lo ya generado</strong>: a la persona equivocada le sigue apareciendo
        el trabajo el resto del mes. Esto pone al día las tareas <em>y</em> los vencimientos del período con la
        asignación actual. <strong>No toca las terminadas ni las auditadas</strong>: cambiarles el responsable
        falsearía quién hizo un trabajo que ya se hizo.
      </p>

      {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
      {hecho && <div style={{ background: 'var(--exito-suave)', color: 'var(--exito-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>✓ {hecho}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 }}>Período</span>
          <input value={periodo} onChange={(e) => { setPeriodo(e.target.value); setPrevio(null); setHecho(null); }} placeholder="2026-08" style={{ ...input, width: 120, fontFamily: 'var(--mono)' }} />
        </label>
        <button className="dbtn" onClick={() => pedir(true)} disabled={trabajando} style={{ fontSize: 13, height: 36 }}>
          {trabajando ? '…' : 'Simular'}
        </button>
      </div>

      {previo && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', marginTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: previo.ejemplos.length ? 8 : 0 }}>
            Cambiarían de responsable <b style={{ color: total ? 'var(--exito)' : 'var(--muted)' }}>{previo.tareas}</b> tarea(s)
            {previo.vencimientos > 0 && <> y <b style={{ color: 'var(--exito)' }}>{previo.vencimientos}</b> vencimiento(s)</>}
            <span style={{ color: 'var(--muted)' }}> · {previo.revisadas} tarea(s) revisadas</span>
          </div>
          {previo.ejemplos.length > 0 && (
            <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
              {previo.ejemplos.map((e, i) => <div key={`${e}-${i}`}>· {e}</div>)}
            </div>
          )}
          {total > 0 && (
            <button className="dbtn primary" disabled={trabajando} onClick={() => pedir(false)} style={{ fontSize: 13 }}>
              {trabajando ? 'Aplicando…' : `Aplicar a ${total} registro(s)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
