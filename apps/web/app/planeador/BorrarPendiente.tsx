'use client';
// Botón para eliminar un pago pendiente manual (generado=false) desde el
// listado unificado de Pagos.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BorrarPendiente({ id }: { id: string }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);
  async function eliminar() {
    if (!confirm('¿Eliminar este pago pendiente?')) return;
    setBorrando(true);
    try {
      const r = await fetch(`/api/vencimientos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (r.ok) router.refresh(); else setBorrando(false);
    } catch { setBorrando(false); }
  }
  return (
    <button className="dbtn" onClick={eliminar} disabled={borrando} title="Eliminar pago pendiente" style={{ fontSize: 12, color: '#cf4436', opacity: borrando ? 0.5 : 1 }}>
      {borrando ? '…' : 'Eliminar'}
    </button>
  );
}
