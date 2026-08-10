'use client';
// Liberar el insumo de todos los clientes de un período, de una sola vez.
//
// Nace del desfase real del ciclo contable: el asesor trabaja en agosto sobre
// los documentos que se capturaron en julio. El sistema exige la entrega del
// MISMO período, así que al arrancar un mes todo el procesamiento aparece
// bloqueado esperando una captura que no terminará hasta el mes siguiente.
//
// Es el desbloqueo del arranque, no la solución de fondo: mientras la regla siga
// mirando el mismo período, esto habrá que repetirlo cada mes.

import { useState } from 'react';

type Previo = { periodo: string; afectadas: number; nombres: string[]; total: number; yaLiberadas?: number; revertir?: boolean };

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };
const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function LiberarPeriodo() {
  const [periodo, setPeriodo] = useState(periodoActual());
  const [previo, setPrevio] = useState<Previo | null>(null);
  const [revertir, setRevertir] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  async function pedir(dryRun: boolean, rev: boolean) {
    setTrabajando(true); setError(null); if (dryRun) setHecho(null);
    // `finally`: con un `return` dentro del try, la línea de después del catch
    // no se ejecuta y el botón se quedaba en "…" para siempre. Al fallar algo,
    // había que recargar la página para volver a intentarlo.
    try {
      const r = await fetch('/api/admin/entregas/liberar-periodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, dryRun, revertir: rev }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo procesar.'); return; }
      if (dryRun) { setPrevio(d); setRevertir(rev); }
      else {
        setHecho(rev
          ? `Se revirtió la liberación de ${d.afectadas} cliente(s) en ${d.periodo}.`
          : `Insumo liberado para ${d.afectadas} cliente(s) en ${d.periodo}. Sus asesores ya pueden trabajar.`);
        setPrevio(null);
      }
    } catch { setError('Error de red.'); } finally { setTrabajando(false); }
  }

  return (
    <div className="panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>Liberar el insumo de todos los clientes</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', maxWidth: 820, lineHeight: 1.65 }}>
        El asesor trabaja en un mes sobre lo que se capturó el mes anterior, pero el sistema pide la entrega
        del <strong>mismo</strong> período — así que al arrancar un mes todo su plan aparece bloqueado.
        Esto <strong>libera de una vez</strong> a todos los clientes activos para que puedan empezar.
        La entrega queda como <strong>manual</strong>, así que si un auxiliar reabre una captura no vuelve a
        bloquear a quien ya estaba trabajando.
      </p>

      {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
      {hecho && <div style={{ background: 'var(--exito-suave)', color: 'var(--exito-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>✓ {hecho}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 }}>Período</span>
          <input value={periodo} onChange={(e) => { setPeriodo(e.target.value); setPrevio(null); setHecho(null); }} placeholder="2026-08" style={{ ...input, width: 120, fontFamily: 'var(--mono)' }} />
        </label>
        <button className="dbtn" onClick={() => pedir(true, false)} disabled={trabajando} style={{ fontSize: 13, height: 36 }}>
          {trabajando ? '…' : 'Simular liberación'}
        </button>
        <button className="dbtn" onClick={() => pedir(true, true)} disabled={trabajando} style={{ fontSize: 13, height: 36 }}
          title="Quita solo las liberaciones manuales generales de este período; no toca las automáticas ni las de un área">
          Simular reversión
        </button>
      </div>

      {previo && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', marginTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: previo.nombres.length ? 8 : 0 }}>
            {previo.revertir
              ? <>Se revertiría la liberación de <b style={{ color: 'var(--peligro)' }}>{previo.afectadas}</b> cliente(s).</>
              : <>Se liberarían <b style={{ color: 'var(--exito)' }}>{previo.afectadas}</b> de {previo.total} cliente(s)
                  {previo.yaLiberadas ? <span style={{ color: 'var(--muted)' }}> · {previo.yaLiberadas} ya estaban liberados</span> : null}.</>}
          </div>
          {previo.nombres.length > 0 && (
            <div style={{ maxHeight: 140, overflow: 'auto', fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
              {previo.nombres.map((n) => <div key={n}>· {n}</div>)}
              {previo.afectadas > previo.nombres.length && <div>… y {previo.afectadas - previo.nombres.length} más</div>}
            </div>
          )}
          {previo.afectadas > 0 && (
            <button className={previo.revertir ? 'dbtn' : 'dbtn primary'} disabled={trabajando}
              onClick={() => pedir(false, !!previo.revertir)} style={{ fontSize: 13 }}>
              {trabajando ? 'Aplicando…' : previo.revertir ? `Revertir ${previo.afectadas}` : `Liberar ${previo.afectadas}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
