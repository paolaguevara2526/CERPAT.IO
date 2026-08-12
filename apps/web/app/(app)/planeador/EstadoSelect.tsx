'use client';
// Control para cambiar el estado de una tarea (chip-select). Llama al proxy y
// refresca la vista. Muestra el error si el backend rechaza (permiso/reglas).

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { tinte } from '@/app/_components/color';
const META: Record<string, { label: string; color: string }> = {
  por_iniciar: { label: 'Por iniciar', color: 'var(--muted)' },
  en_curso: { label: 'En curso', color: 'var(--info)' },
  en_revision: { label: 'En revisión', color: 'var(--alerta)' },
  terminado: { label: 'Terminado', color: 'var(--exito)' },
  auditado: { label: 'Auditado', color: 'var(--green-edge)' },
  no_realizado: { label: 'No realizado', color: 'var(--peligro)' },
  no_aplica: { label: 'No aplica', color: 'var(--neutro)' },
};

export default function EstadoSelect({ id, estado }: { id: string; estado: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(estado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const color = (META[valor] ?? META.por_iniciar).color;

  async function cambiar(nuevo: string) {
    const anterior = valor;
    setValor(nuevo);
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/planeador/tarea-estado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: nuevo }),
      });
      const data = await res.json();
      if (!res.ok) { setValor(anterior); setError(data.error || 'No se pudo cambiar.'); setGuardando(false); return; }
      setGuardando(false);
      router.refresh();
    } catch {
      setValor(anterior); setError('Error de red.'); setGuardando(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
      <select
        value={valor} disabled={guardando} onChange={(e) => cambiar(e.target.value)}
        title="Cambiar estado"
        style={{
          fontSize: 11.5, fontWeight: 800, color, background: `${tinte(color, 12)}`, border: `1px solid ${tinte(color, 30)}`,
          borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--ui)', opacity: guardando ? 0.6 : 1,
        }}
      >
        {Object.entries(META).map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v.label}</option>)}
      </select>
      {error && <span style={{ fontSize: 10.5, color: 'var(--peligro)', maxWidth: 160 }}>{error}</span>}
    </span>
  );
}
