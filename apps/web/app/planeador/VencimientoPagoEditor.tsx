'use client';
// Editor en línea del pago de un VENCIMIENTO: valor a pagar y estado (los 6
// estados de EstadoPago). Guarda vía el proxy de vencimientos y refresca.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export const VENC_PAGO_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#5b6a82' },
  presentado_sin_pago: { label: 'Presentado (sin pago)', color: '#2f6fd0' },
  presentado_pagado: { label: 'Presentado y pagado', color: '#22a670' },
  presentado_cero: { label: 'Presentado en $0', color: '#14a8a0' },
  no_presentado: { label: 'No presentado', color: '#cf4436' },
  no_obligado: { label: 'No obligado', color: '#9aa3b2' },
};

export default function VencimientoPagoEditor({ id, valorPago, estado }: { id: string; valorPago: number | null; estado: string }) {
  const router = useRouter();
  const [valor, setValor] = useState<string>(valorPago != null ? String(valorPago) : '');
  const [est, setEst] = useState(estado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const color = (VENC_PAGO_META[est] ?? VENC_PAGO_META.pendiente).color;
  const sucio = valor !== (valorPago != null ? String(valorPago) : '') || est !== estado;

  async function guardar() {
    setGuardando(true); setError(null); setOk(false);
    try {
      const res = await fetch(`/api/vencimientos/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valorPago: valor === '' ? null : Number(valor), estado: est }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'No se pudo guardar.'); setGuardando(false); return; }
      setGuardando(false); setOk(true);
      router.refresh();
      setTimeout(() => setOk(false), 1500);
    } catch {
      setError('Error de red.'); setGuardando(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 8, fontSize: 12, color: 'var(--muted)', pointerEvents: 'none' }}>$</span>
        <input type="number" min={0} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0"
          style={{ width: 120, padding: '6px 8px 6px 18px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'var(--ui)', textAlign: 'right' }} />
      </div>
      <select value={est} onChange={(e) => setEst(e.target.value)}
        style={{ fontSize: 11.5, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 4, padding: '5px 8px', cursor: 'pointer', fontFamily: 'var(--ui)' }}>
        {Object.entries(VENC_PAGO_META).map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v.label}</option>)}
      </select>
      <button className="dbtn primary" onClick={guardar} disabled={!sucio || guardando} style={{ fontSize: 12, opacity: !sucio || guardando ? 0.5 : 1 }}>
        {guardando ? '…' : ok ? '✓' : 'Guardar'}
      </button>
      {error && <span style={{ fontSize: 10.5, color: '#cf4436' }}>{error}</span>}
    </div>
  );
}
