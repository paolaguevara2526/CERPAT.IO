'use client';
// Cola de auditoría: cada tarjeta permite Aprobar (→ auditado, bloqueada) o
// Devolver con observaciones (→ en curso). Las reglas y el permiso se validan
// en el backend; aquí solo mostramos el resultado o el error.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type TareaAuditoria = {
  id: string; titulo: string; empresa: string | null; area: string | null;
  asesor: string | null; auxiliar: string | null; fechaVencimiento: string;
  observaciones: string | null; requiereRevisionTecnica: boolean;
};

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return ''; }
}

function Tarjeta({ t }: { t: TareaAuditoria }) {
  const router = useRouter();
  const [modo, setModo] = useState<'idle' | 'devolver'>('idle');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState<null | 'aprobar' | 'devolver'>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<null | string>(null);

  async function enviar(accion: 'aprobar' | 'devolver') {
    if (accion === 'devolver' && !nota.trim()) { setError('Escribe las observaciones para devolver.'); return; }
    setGuardando(accion);
    setError(null);
    try {
      const res = await fetch('/api/planeador/tarea-auditoria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, accion, observaciones: nota }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo procesar.'); setGuardando(null); return; }
      setHecho(accion === 'aprobar' ? 'Aprobada ✓' : 'Devuelta ↩');
      setTimeout(() => router.refresh(), 700);
    } catch {
      setError('Error de red.'); setGuardando(null);
    }
  }

  const vencida = new Date(t.fechaVencimiento) < new Date();

  return (
    <article className="panel" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 9, opacity: hecho ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{t.titulo}</span>
        {t.requiereRevisionTecnica && <span className="chip" style={{ fontSize: 10, color: '#2f6fd0', background: '#2f6fd018', borderColor: '#2f6fd044' }}>Revisión técnica</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: vencida ? 800 : 500, color: vencida ? '#d64b3f' : 'var(--muted)', whiteSpace: 'nowrap' }}>Vence {fmtFecha(t.fechaVencimiento)}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--ink)' }}>{t.empresa ?? '—'}</strong></span>
        {t.area && <span>Área: {t.area}</span>}
        <span>Auxiliar: {t.auxiliar ?? '—'}</span>
        <span>Asesor: {t.asesor ?? '—'}</span>
      </div>
      {t.observaciones && (
        <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 5, padding: '7px 10px' }}>
          <strong>Última observación:</strong> {t.observaciones}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#b42318', fontWeight: 600 }}>{error}</div>}

      {hecho ? (
        <div style={{ fontSize: 13, fontWeight: 800, color: '#22a670' }}>{hecho}</div>
      ) : modo === 'devolver' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={nota} onChange={(e) => setNota(e.target.value)} rows={2} autoFocus
            placeholder="Observaciones para el auxiliar (qué corregir)…"
            style={{ width: '100%', resize: 'vertical', padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="dbtn" onClick={() => { setModo('idle'); setError(null); }} disabled={!!guardando} style={{ fontSize: 12.5 }}>Cancelar</button>
            <button className="dbtn navy" onClick={() => enviar('devolver')} disabled={!!guardando} style={{ fontSize: 12.5 }}>
              {guardando === 'devolver' ? 'Devolviendo…' : 'Confirmar devolución'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dbtn success" onClick={() => enviar('aprobar')} disabled={!!guardando} style={{ fontSize: 12.5 }}>
            {guardando === 'aprobar' ? 'Aprobando…' : 'Aprobar'}
          </button>
          <button className="dbtn" onClick={() => setModo('devolver')} disabled={!!guardando} style={{ fontSize: 12.5 }}>Devolver con observaciones</button>
        </div>
      )}
    </article>
  );
}

export default function AuditoriaCola({ tareas }: { tareas: TareaAuditoria[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tareas.map((t) => <Tarjeta key={t.id} t={t} />)}
    </div>
  );
}
