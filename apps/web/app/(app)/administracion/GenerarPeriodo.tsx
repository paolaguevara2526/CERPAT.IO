'use client';
// Generación del período para todos los clientes de una vez.
//
// Hasta ahora había que entrar cliente por cliente y darle "Generar": con ~90
// clientes son ~90 vueltas a mano cada mes, y basta olvidar una para que a un
// asesor no le aparezca trabajo que sí tiene.
//
// Se puede correr las veces que haga falta: lo ya generado no se duplica ni se
// toca. Si entra un cliente nuevo a mitad de mes, se vuelve a correr y solo se
// crea lo que falta.

import { useState } from 'react';

type Resumen = {
  periodo: string;
  porCrear: number;
  clientesActivos: number;
  clientesConPlan: number;
  clientesAfectados: number;
  yaExistian: number;
  sinPlan: string[];
  sinPlanTotal: number;
  porArea: { area: string; n: number }[];
  creadas?: number;
};

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };
const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function GenerarPeriodo() {
  const [periodo, setPeriodo] = useState(periodoActual());
  const [previo, setPrevio] = useState<Resumen | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  async function pedir(dryRun: boolean) {
    setTrabajando(true); setError(null); if (dryRun) setHecho(null);
    try {
      const r = await fetch('/api/admin/plan-cliente/generar-masivo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, dryRun }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo generar el período.'); return; }
      if (dryRun) setPrevio(d);
      else {
        setHecho(`Se crearon ${d.creadas} tarea(s) de ${periodo} para ${d.clientesAfectados} cliente(s).`);
        setPrevio(null);
      }
    } catch { setError('Error de red.'); } finally { setTrabajando(false); }
  }

  return (
    <div className="panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>Generar el período para todos los clientes</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', maxWidth: 820, lineHeight: 1.65 }}>
        Crea las tareas del mes para <strong>todos los clientes activos que tengan plan</strong>, con el asesor y el
        auxiliar de sus asignaciones y el plazo del <strong>día hábil</strong> de cada actividad.
        Se puede correr <strong>las veces que haga falta</strong>: lo que ya está generado no se duplica ni se modifica,
        así que si entra un cliente a mitad de mes basta con volver a correrlo.
      </p>

      {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
      {hecho && <div style={{ background: 'var(--exito-suave)', color: 'var(--exito-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>✓ {hecho}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 }}>Período</span>
          <input value={periodo} onChange={(e) => { setPeriodo(e.target.value); setPrevio(null); setHecho(null); }} placeholder="2026-09" style={{ ...input, width: 120, fontFamily: 'var(--mono)' }} />
        </label>
        <button className="dbtn" onClick={() => pedir(true)} disabled={trabajando} style={{ fontSize: 13, height: 36 }}>
          {trabajando ? '…' : 'Simular generación'}
        </button>
      </div>

      {previo && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', marginTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            Se crearían <b style={{ color: previo.porCrear ? 'var(--exito)' : 'var(--muted)' }}>{previo.porCrear}</b> tarea(s)
            {' '}para <b>{previo.clientesAfectados}</b> cliente(s)
            <span style={{ color: 'var(--muted)' }}>
              {' '}· {previo.clientesConPlan} de {previo.clientesActivos} clientes activos tienen plan
              {previo.yaExistian > 0 && ` · ${previo.yaExistian} tarea(s) ya existen y no se tocan`}
            </span>
          </div>

          {previo.porArea.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {previo.porArea.map((a) => (
                <span key={a.area} style={{ fontSize: 11.5, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 20, padding: '3px 9px' }}>
                  {a.area} <b>{a.n}</b>
                </span>
              ))}
            </div>
          )}

          {/* Un cliente activo sin plan no genera nada y nadie se entera. Se
              nombra aquí para que se pueda arreglar antes de cerrar el mes. */}
          {previo.sinPlanTotal > 0 && (
            <div style={{ background: 'var(--alerta-suave)', borderRadius: 6, padding: '8px 11px', fontSize: 12, marginBottom: 10 }}>
              <b>{previo.sinPlanTotal} cliente(s) activos sin plan configurado</b> — no se les genera nada.
              <div style={{ color: 'var(--muted)', marginTop: 4, maxHeight: 110, overflow: 'auto' }}>
                {previo.sinPlan.join(' · ')}{previo.sinPlanTotal > previo.sinPlan.length && ' …'}
              </div>
            </div>
          )}

          {previo.porCrear > 0 ? (
            <button className="dbtn primary" disabled={trabajando} onClick={() => pedir(false)} style={{ fontSize: 13 }}>
              {trabajando ? 'Generando…' : `Generar ${previo.porCrear} tarea(s)`}
            </button>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No hay nada por crear: el período ya está generado.</div>
          )}
        </div>
      )}
    </div>
  );
}
