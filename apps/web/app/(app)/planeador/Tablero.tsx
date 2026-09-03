'use client';
// Tablero (kanban) del planeador: columnas por estado con arrastrar y soltar.
// Al soltar una tarjeta en otra columna cambia el estado vía el proxy autenticado;
// si el backend rechaza (permiso / auditoría / subtareas) revierte y avisa.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Tarea } from './tareas';

import { tinte } from '@/app/_components/color';
import { fmtDia } from '@/lib/fechas';
import { avisarTareaCambiada } from '@/lib/eventos';
const COLUMNAS: { estado: string; label: string; color: string }[] = [
  { estado: 'por_iniciar', label: 'Por iniciar', color: 'var(--muted)' },
  { estado: 'en_curso', label: 'En curso', color: 'var(--info)' },
  { estado: 'en_revision', label: 'En revisión', color: 'var(--alerta)' },
  { estado: 'terminado', label: 'Terminado', color: 'var(--exito)' },
  { estado: 'auditado', label: 'Auditado', color: 'var(--green-edge)' },
  { estado: 'no_realizado', label: 'No realizado', color: 'var(--peligro)' },
  // No aplica va de última y en gris: no es un logro ni una falta, es trabajo
  // que ese cliente no tenía ese mes y que sale de la medición.
  { estado: 'no_aplica', label: 'No aplica', color: 'var(--neutro)' },
];

function fmtFecha(iso: string): string {
  try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return ''; }
}

export default function Tablero({ tareas: iniciales }: { tareas: Tarea[] }) {
  const router = useRouter();
  const [tareas, setTareas] = useState<Tarea[]>(iniciales);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function soltar(estadoDestino: string) {
    const id = arrastrando;
    setArrastrando(null);
    setSobre(null);
    if (!id) return;
    const tarea = tareas.find((t) => t.id === id);
    if (!tarea || tarea.estado === estadoDestino) return;

    const anterior = tarea.estado;
    setError(null);
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, estado: estadoDestino } : t)));
    setGuardando((prev) => new Set(prev).add(id));
    try {
      const res = await fetch('/api/planeador/tarea-estado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: estadoDestino }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, estado: anterior } : t)));
        setError(data.error || 'No se pudo cambiar el estado.');
      } else {
        avisarTareaCambiada();
        router.refresh();
      }
    } catch {
      setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, estado: anterior } : t)));
      setError('Error de red.');
    } finally {
      setGuardando((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  return (
    <>
      {error && (
        <div className="panel" style={{ padding: '10px 14px', marginBottom: 12, color: 'var(--peligro-fuerte)', fontWeight: 600, fontSize: 13, borderColor: 'var(--peligro-borde)' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {COLUMNAS.map((col) => {
          const items = tareas.filter((t) => t.estado === col.estado);
          const activo = sobre === col.estado;
          return (
            <section
              key={col.estado}
              onDragOver={(e) => { e.preventDefault(); if (sobre !== col.estado) setSobre(col.estado); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setSobre((s) => (s === col.estado ? null : s)); }}
              onDrop={() => soltar(col.estado)}
              style={{
                flex: '0 0 260px', minWidth: 260, background: 'var(--panel-2, var(--panel))',
                border: `1px solid ${activo ? col.color : 'var(--edge)'}`, borderRadius: 8,
                boxShadow: activo ? `inset 0 0 0 1px ${col.color}` : 'none', transition: 'border-color .12s',
                display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 210px)',
              }}
            >
              <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--edge)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: col.color, boxShadow: `0 0 0 3px ${tinte(col.color, 14)}` }} />
                <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.2 }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: col.color, background: `${tinte(col.color, 12)}`, borderRadius: 10, padding: '2px 8px' }}>{items.length}</span>
              </header>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                {items.length === 0 ? (
                  <div style={{ padding: '18px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>—</div>
                ) : items.map((t) => (
                  <article
                    key={t.id}
                    draggable={!guardando.has(t.id)}
                    onDragStart={() => setArrastrando(t.id)}
                    onDragEnd={() => { setArrastrando(null); setSobre(null); }}
                    title="Arrastra a otra columna para cambiar el estado"
                    style={{
                      background: 'var(--panel)', border: '1px solid var(--edge-strong)', borderLeft: `3px solid ${col.color}`,
                      borderRadius: 6, padding: '9px 11px', cursor: guardando.has(t.id) ? 'progress' : 'grab',
                      opacity: guardando.has(t.id) ? 0.55 : arrastrando === t.id ? 0.4 : 1,
                      boxShadow: '0 1px 2px var(--lo)',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{t.titulo}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>{t.empresa ?? '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10.5 }}>
                      {t.area && <span className="chip" style={{ fontSize: 10, padding: '1px 7px' }}>{t.area}</span>}
                      <span style={{ marginLeft: 'auto', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtFecha(t.fechaVencimiento)}</span>
                    </div>
                    {(t.asesor || t.auxiliar) && (
                      <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--muted)' }}>
                        {t.asesor ?? '—'}{t.auxiliar ? ` · ${t.auxiliar}` : ''}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
