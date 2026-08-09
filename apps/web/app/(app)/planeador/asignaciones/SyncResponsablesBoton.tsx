'use client';
// Botón + modal para sincronizar el responsable (asesor/auxiliar) de las tareas ya
// generadas con la Asignación cliente×área actual. Previsualiza cuántas cambiarían
// y, al confirmar, las actualiza. Solo lo ve Coordinación/Administrador.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Alcance = 'actual' | 'abiertas' | 'todas';
const ALCANCES: { k: Alcance; label: string; hint: string }[] = [
  { k: 'actual', label: 'Período actual y siguientes (sin auditadas)', hint: 'Recomendado para cambios de personal: conserva el historial de quién hizo el trabajo.' },
  { k: 'abiertas', label: 'Todas las abiertas (cualquier período, sin auditadas)', hint: 'Incluye meses anteriores aún sin auditar.' },
  { k: 'todas', label: 'Absolutamente todas (incluye auditadas)', hint: 'Úsalo antes de iniciar operación, cuando aún no hay historial que conservar.' },
];

type Previo = { revisadas: number; aCambiar: number; sinAsignacion: number };

export default function SyncResponsablesBoton() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [alcance, setAlcance] = useState<Alcance>('actual');
  const [previo, setPrevio] = useState<Previo | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  function elegir(a: Alcance) { setAlcance(a); setPrevio(null); setHecho(null); }

  async function llamar(dryRun: boolean) {
    setTrabajando(true); setError(null);
    try {
      const r = await fetch('/api/admin/asignaciones/sincronizar-tareas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, alcance }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo procesar.'); setTrabajando(false); return; }
      if (dryRun) { setPrevio(d); setHecho(null); }
      else { setHecho(`Listo: ${d.actualizadas} tarea(s) actualizada(s).`); setPrevio(null); router.refresh(); }
    } catch { setError('Error de red.'); }
    setTrabajando(false);
  }

  function cerrar() { setAbierto(false); setPrevio(null); setError(null); setHecho(null); }

  return (
    <>
      <button className="dbtn primary" onClick={() => setAbierto(true)} style={{ fontSize: 13 }}>⟳ Sincronizar responsables</button>

      {abierto && (
        <div onClick={() => !trabajando && cerrar()} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'auto' }}>
            <div className="win-bar">
              <span className="win-title">Sincronizar responsables en las tareas</span>
              <div className="win-ctl"><button className="close" onClick={cerrar} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
            </div>
            <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                Actualiza el asesor y auxiliar de las tareas ya generadas para que coincidan con la asignación actual (cliente × área). Útil tras importar o editar asignaciones.
              </p>

              {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
              {hecho && <div style={{ background: 'var(--exito-suave)', color: 'var(--green-edge)', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontWeight: 700 }}>✓ {hecho}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ALCANCES.map((a) => (
                  <label key={a.k} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 7, border: `1px solid ${alcance === a.k ? 'var(--navy)' : 'var(--line)'}`, background: alcance === a.k ? 'var(--navy-08, rgba(31,58,102,0.06))' : 'transparent', cursor: 'pointer' }}>
                    <input type="radio" name="alcance" checked={alcance === a.k} onChange={() => elegir(a.k)} style={{ marginTop: 2 }} />
                    <span>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{a.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{a.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              {previo && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', fontSize: 13 }}>
                  <b style={{ color: previo.aCambiar ? 'var(--green-edge)' : 'var(--muted)' }}>{previo.aCambiar}</b> tarea(s) por reasignar
                  <span style={{ color: 'var(--muted)' }}> · de {previo.revisadas} revisada(s)</span>
                  {previo.sinAsignacion > 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{previo.sinAsignacion} tarea(s) sin asignación en su área (se dejan igual).</div>}
                  {previo.aCambiar === 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Ya están todas al día para este alcance.</div>}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 2 }}>
                <button className="dbtn" onClick={cerrar} disabled={trabajando} style={{ fontSize: 13 }}>Cerrar</button>
                <button className="dbtn" onClick={() => llamar(true)} disabled={trabajando} style={{ fontSize: 13 }}>{trabajando ? '…' : 'Previsualizar'}</button>
                <button className="dbtn primary" onClick={() => llamar(false)} disabled={trabajando || !previo || previo.aCambiar === 0} style={{ fontSize: 13 }} title={!previo ? 'Primero previsualiza' : ''}>
                  {trabajando ? 'Aplicando…' : previo ? `Aplicar (${previo.aCambiar})` : 'Aplicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
