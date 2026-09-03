'use client';
// Fichas que parecen ser el mismo cliente.
//
// Nada en la base impide crear dos veces el mismo cliente, y el síntoma no se
// parece a la causa: las áreas quedan repartidas entre las dos fichas, así que a
// un asesor le sigue apareciendo un cliente que en "Plan por cliente" figura a
// nombre de otro. Se corrige ahí, se guarda, y no cambia nada — porque se está
// editando la otra ficha. Se vuelve a corregir, y otra vez nada. Sin este panel
// no hay manera de ver que el problema no era la asignación.
//
// Por eso cada ficha se muestra con lo que le cuelga: áreas asignadas y con
// quién, tareas, vencimientos y pagos. Eso es lo que decide cuál es la buena y
// qué se pierde al desactivar la otra. Este panel NO fusiona nada solo: unir dos
// clientes es una decisión con consecuencias contables y la toma una persona.

import { useEffect, useState } from 'react';

type Area = { area: string; asesor: string | null; auxiliar: string | null };
type Ficha = {
  id: string; nombre: string; nit: string | null; activo: boolean; creado: string;
  areas: Area[]; tareas: number; vencimientos: number; pagos: number;
};
type Grupo = { motivo: 'nit' | 'nombre'; fichas: Ficha[] };

const MOTIVO: Record<Grupo['motivo'], string> = {
  nit: 'mismo NIT',
  nombre: 'mismo nombre',
};

const celda: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' };

export default function ClientesDuplicados({ onIr }: { onIr?: (empresaId: string) => void }) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [cargado, setCargado] = useState(false);

  async function cargar() {
    try {
      const r = await fetch('/api/admin/clientes-duplicados', { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setGrupos(d.grupos ?? []);
    } catch { /* silencioso: es un diagnóstico, no bloquea el trabajo */ }
    finally { setCargado(true); }
  }
  useEffect(() => { cargar(); }, []);

  if (!cargado || grupos.length === 0) return null;

  return (
    <div className="panel" style={{ padding: '14px 16px', marginBottom: 16, borderColor: 'var(--alerta-borde)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4, color: 'var(--alerta-fuerte)' }}>
        ⚠ {grupos.length} cliente(s) con la ficha repetida
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', maxWidth: 860, lineHeight: 1.65 }}>
        Cuando un cliente tiene dos fichas, sus áreas quedan <strong>repartidas entre las dos</strong>. El desplegable
        de arriba muestra el nombre repetido, así que se corrige la asignación en una ficha y el asesor de la otra
        sigue viendo el cliente: parece que el cambio no se guardó, y en realidad se guardó en el lugar equivocado.
      </p>

      {grupos.map((g, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
          <div style={{ background: 'var(--panel-2)', padding: '6px 10px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>
            {g.fichas.length} fichas · {MOTIVO[g.motivo]}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Ficha', 'Áreas con responsable', 'Trabajo colgado', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontWeight: 800, padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.fichas.map((f) => (
                <tr key={f.id}>
                  <td style={{ ...celda, fontWeight: 600 }}>
                    {f.nombre}
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 500 }}>
                      {f.nit ? `NIT ${f.nit}` : 'sin NIT'} · id …{f.id.slice(-6)}
                      {!f.activo && <span style={{ color: 'var(--alerta-fuerte)', fontWeight: 700 }}> · inactivo</span>}
                    </div>
                  </td>
                  {/* El reparto es el dato: aquí se ve de un vistazo que media
                      operación del cliente cuelga de la ficha que nadie abre. */}
                  <td style={{ ...celda, color: 'var(--muted)', maxWidth: 340 }}>
                    {f.areas.length === 0 ? '—' : f.areas.map((a, j) => (
                      <div key={j} style={{ lineHeight: 1.5 }}>
                        <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{a.area}</b>: {a.asesor ?? 'sin asesor'}
                        {a.auxiliar && <span> · aux. {a.auxiliar}</span>}
                      </div>
                    ))}
                  </td>
                  <td style={{ ...celda, whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                    {f.tareas} tarea(s)<br />{f.vencimientos} vencimiento(s)<br />{f.pagos} pago(s)
                  </td>
                  <td style={{ ...celda, textAlign: 'right' }}>
                    {onIr && <button className="dbtn" onClick={() => onIr(f.id)} style={{ fontSize: 11.5, padding: '4px 9px' }}>Abrir esta ficha</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <button className="dbtn" onClick={() => { setCargado(false); cargar(); }} style={{ fontSize: 12 }}>Volver a revisar</button>
        {/* Qué hacer con esto no es obvio, y sin decirlo el panel solo alarma. */}
        <span style={{ fontSize: 11.5, color: 'var(--muted)', maxWidth: 700, lineHeight: 1.5 }}>
          Para unificar: deja una ficha, pásale las áreas que tenga la otra y desactiva la sobrante.
          Las tareas y los pagos <b>ya registrados no se mueven solos</b> — revisa qué queda en la ficha que desactives.
        </span>
      </div>
    </div>
  );
}
