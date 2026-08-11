'use client';
// Asignaciones con el responsable mal puesto.
//
// De la asignación cliente×área heredan asesor y auxiliar todas las tareas y los
// vencimientos. Un auxiliar puesto en la casilla de asesor no se nota al
// guardarlo: se nota semanas después, cuando a esa persona le aparece trabajo de
// procesamiento que no le toca. Y para entonces hay que buscarlo a mano entre
// noventa clientes por varias áreas cada uno, que en la práctica es no buscarlo.
//
// El panel se esconde solo cuando no hay nada que revisar.

import { useEffect, useState } from 'react';

type Caso = {
  empresa: string; area: string; empresaId: string; areaId: string;
  campo: 'asesor' | 'auxiliar' | 'ambos'; persona: string; roles: string[]; motivo: string;
};

export default function RevisionResponsables({ onIr }: { onIr?: (empresaId: string) => void }) {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [cargado, setCargado] = useState(false);

  async function cargar() {
    try {
      const r = await fetch('/api/admin/asignaciones/revision', { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setCasos(d.casos ?? []);
    } catch { /* silencioso: es un diagnóstico, no bloquea el trabajo */ }
    finally { setCargado(true); }
  }
  useEffect(() => { cargar(); }, []);

  if (!cargado || casos.length === 0) return null;

  return (
    <div className="panel" style={{ padding: '14px 16px', marginBottom: 16, borderColor: 'var(--alerta-borde)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4, color: 'var(--alerta-fuerte)' }}>
        ⚠ {casos.length} asignación(es) con el responsable mal puesto
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', maxWidth: 820, lineHeight: 1.65 }}>
        De la asignación por área heredan asesor y auxiliar <strong>todas</strong> las tareas y los vencimientos
        del cliente. Mientras esto siga así, a estas personas les aparece —y les seguirá apareciendo cada mes—
        trabajo que no les corresponde.
      </p>

      <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Cliente', 'Área', 'Persona', 'Qué pasa', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)', position: 'sticky', top: 0 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {casos.map((c, i) => (
              <tr key={`${c.empresaId}|${c.areaId}|${c.campo}|${i}`}>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>{c.empresa}</td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>{c.area}</td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
                  {c.persona}
                  <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{c.roles.length ? c.roles.join(', ') : 'sin rol'}</div>
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', maxWidth: 340 }}>{c.motivo}</td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>
                  {onIr && <button className="dbtn" onClick={() => onIr(c.empresaId)} style={{ fontSize: 11.5, padding: '4px 9px' }}>Corregir</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button className="dbtn" onClick={() => { setCargado(false); cargar(); }} style={{ fontSize: 12 }}>Volver a revisar</button>
        {/* Corregir la asignación NO reasigna lo ya generado: las tareas del mes
            se quedan con quien tenían. Decirlo aquí evita el "ya lo arreglé y
            sigue igual". */}
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          Corregir la asignación no cambia las tareas <b>ya generadas</b> de este mes: esas conservan el responsable con el que nacieron.
        </span>
      </div>
    </div>
  );
}
