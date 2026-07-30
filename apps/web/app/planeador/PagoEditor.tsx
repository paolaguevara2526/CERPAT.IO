'use client';
// Editor en línea del pago de una tarea: valor (digitado por el ejecutor) y
// estado del pago. Guarda vía el proxy autenticado y refresca.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export const ESTADO_PAGO_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#c67c00' },
  presentado_sin_pago: { label: 'Presentado sin pago', color: '#2f6fd0' },
  presentado_pagado: { label: 'Presentado y pagado', color: '#22a670' },
  no_presentado: { label: 'No presentado', color: '#cf4436' },
};

function fmtCOP(v: number | null): string {
  if (v == null) return '';
  return v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

export default function PagoEditor({ id, valorPago, estadoPago }: { id: string; valorPago: number | null; estadoPago: string }) {
  const router = useRouter();
  const [valor, setValor] = useState<string>(valorPago != null ? String(valorPago) : '');
  const [estado, setEstado] = useState(estadoPago);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const color = (ESTADO_PAGO_META[estado] ?? ESTADO_PAGO_META.pendiente).color;
  const sucio = valor !== (valorPago != null ? String(valorPago) : '') || estado !== estadoPago;

  async function guardar() {
    setGuardando(true); setError(null); setOk(false);
    try {
      const res = await fetch('/api/planeador/tarea-pago', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, valorPago: valor === '' ? null : Number(valor), estadoPago: estado }),
      });
      const data = await res.json();
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
        <input
          type="number" min={0} inputMode="numeric" value={valor}
          onChange={(e) => setValor(e.target.value)} placeholder="0"
          title={valorPago != null ? `Actual: $${fmtCOP(valorPago)}` : 'Sin valor'}
          style={{ width: 120, padding: '6px 8px 6px 18px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'var(--ui)', textAlign: 'right' }}
        />
      </div>
      <select
        value={estado} onChange={(e) => setEstado(e.target.value)}
        style={{ fontSize: 11.5, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 4, padding: '5px 8px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
      >
        {Object.entries(ESTADO_PAGO_META).map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v.label}</option>)}
      </select>
      <button className="dbtn primary" onClick={guardar} disabled={!sucio || guardando} style={{ fontSize: 12, opacity: !sucio || guardando ? 0.5 : 1 }}>
        {guardando ? '…' : ok ? '✓' : 'Guardar'}
      </button>
      {error && <span style={{ fontSize: 10.5, color: '#cf4436' }}>{error}</span>}
    </div>
  );
}
