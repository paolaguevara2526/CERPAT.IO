'use client';
// Pendientes del día a día: lo que sale por fuera del plan de trabajo.
//
// El cliente que pide un certificado, la corrección que hay que hacer, la
// llamada al banco. Hasta ahora vivía en cuadernos y en WhatsApp, y por eso
// nadie podía responder cuánto trabajo fuera del plan genera cada cliente.
//
// NO es una tarea del plan: no entra al calendario, no entra al cumplimiento y
// no se mide. Es una agenda. Se dice en la nota del panel a propósito, para que
// nadie espere verlo en sus indicadores.

import { useEffect, useState } from 'react';
import PanelPlegable from '@/app/_components/PanelPlegable';
import { fmtDia } from '@/lib/fechas';

type Fila = {
  id: string; titulo: string; detalle: string | null; fecha: string; estado: string;
  dia: string; atrasado: boolean; esHoy: boolean;
  empresa: { id: string; nombre: string } | null;
  responsable: { id: string; nombre: string } | null;
  creadoPor: { id: string; nombre: string } | null;
};
type Resp = { hoy: string | null; total: number; atrasados: number; deHoy: number; pendientes: Fila[] };
type Opcion = { id: string; nombre: string };
type Asesor = { id: string; nombre: string; areas: string[] };

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const vacio = () => ({ titulo: '', detalle: '', fecha: hoyISO(), empresaId: '', responsableId: '' });

export default function PendientesDelDia() {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [empresas, setEmpresas] = useState<Opcion[]>([]);
  const [personas, setPersonas] = useState<Opcion[]>([]);
  const [puedeAsignar, setPuedeAsignar] = useState(false);
  // Asesores del cliente elegido: se ofrecen primero para no tener que adivinar
  // en una lista de veinte personas cuál atiende a ese cliente.
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [nuevo, setNuevo] = useState(vacio());
  const [abriendo, setAbriendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      const r = await fetch('/api/pendientes/mios', { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setData(d as Resp);
    } catch { /* el panel se oculta si no hay datos */ }
    finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    fetch('/api/pendientes/form-datos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { setEmpresas(d.empresas ?? []); setPersonas(d.personas ?? []); setPuedeAsignar(!!d.puedeAsignar); })
      .catch(() => {});
  }, []);

  // Al elegir cliente se traen sus asesores. Si tiene uno solo, se precarga:
  // en la mayoría de los casos ya no hay nada que elegir.
  async function elegirEmpresa(empresaId: string) {
    setNuevo((p) => ({ ...p, empresaId, responsableId: '' }));
    setAsesores([]);
    if (!empresaId) return;
    try {
      const r = await fetch(`/api/pendientes/de-empresa/${empresaId}`, { cache: 'no-store' });
      const d = await r.json();
      const lista: Asesor[] = d.asesores ?? [];
      setAsesores(lista);
      if (lista.length === 1 && puedeAsignar) setNuevo((p) => ({ ...p, responsableId: lista[0].id }));
    } catch { /* si falla, queda la lista completa de personas */ }
  }

  async function crear() {
    if (!nuevo.titulo.trim()) { setMsg('Escribe qué hay que hacer.'); return; }
    setGuardando(true); setMsg(null);
    try {
      const r = await fetch('/api/pendientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d?.error ?? 'No se pudo crear el pendiente.'); return; }
      setNuevo(vacio()); setAsesores([]); setAbriendo(false);
      await cargar();
    } catch { setMsg('Error de red.'); } finally { setGuardando(false); }
  }

  async function marcarHecho(id: string) {
    const r = await fetch(`/api/pendientes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'hecho' }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d?.error ?? 'No se pudo cerrar.'); return; }
    await cargar();
  }

  async function borrar(id: string) {
    if (!confirm('¿Eliminar este pendiente?')) return;
    const r = await fetch(`/api/pendientes/${id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d?.error ?? 'No se pudo eliminar.'); return; }
    await cargar();
  }

  if (cargando) return null;

  const filas = data?.pendientes ?? [];
  const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--edge-strong)', borderRadius: 6, fontSize: 12.5, background: 'var(--panel)', color: 'var(--ink)' };
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', display: 'block', marginBottom: 3 };

  return (
    <PanelPlegable
      id="pendientes-del-dia" titulo="📌 Mis pendientes"
      nota="Lo que sale del día a día, por fuera del plan. No entra al calendario ni al cumplimiento: es una agenda."
      resumen={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, background: 'var(--info-suave)', border: '1px solid var(--info-borde, var(--line))', borderRadius: 20, padding: '4px 12px' }}>
            <b style={{ fontSize: 14, color: 'var(--info-fuerte)' }}>{data?.deHoy ?? 0}</b>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>para hoy</span>
          </span>
          {(data?.atrasados ?? 0) > 0 && <span style={{ fontSize: 11.5, color: 'var(--peligro-fuerte)', fontWeight: 700 }}>· {data!.atrasados} atrasado(s)</span>}
        </span>
      }
    >
      <div style={{ padding: '10px 14px 4px' }}>
        {msg && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{msg}</div>}

        {!abriendo ? (
          <button className="dbtn primary" onClick={() => setAbriendo(true)} style={{ fontSize: 12.5, marginBottom: 12 }}>+ Anotar pendiente</button>
        ) : (
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', marginBottom: 12, background: 'var(--panel-2)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ flex: '2 1 260px' }}><span style={lbl}>Qué hay que hacer *</span>
                <input value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })}
                  placeholder="Enviar certificado de retención a…" style={{ ...inp, width: '100%' }} />
              </label>
              <label style={{ flex: '0 0 140px' }}><span style={lbl}>Para cuándo</span>
                <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} style={{ ...inp, width: '100%' }} />
              </label>
              <label style={{ flex: '1 1 200px' }}><span style={lbl}>Cliente</span>
                <select value={nuevo.empresaId} onChange={(e) => elegirEmpresa(e.target.value)} style={{ ...inp, width: '100%' }}>
                  <option value="">— Sin cliente (interno) —</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </label>
              {puedeAsignar && (
                <label style={{ flex: '1 1 200px' }}><span style={lbl}>Responsable</span>
                  <select value={nuevo.responsableId} onChange={(e) => setNuevo({ ...nuevo, responsableId: e.target.value })} style={{ ...inp, width: '100%' }}>
                    <option value="">— Sin asignar (solo mío) —</option>
                    {/* Los asesores del cliente primero: son los que atienden a
                        ese cliente y casi siempre es uno de ellos. */}
                    {asesores.length > 0 && (
                      <optgroup label="Asesores de este cliente">
                        {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.areas.length ? ` · ${a.areas.join(', ')}` : ''}</option>)}
                      </optgroup>
                    )}
                    <optgroup label="Todo el equipo">
                      {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </optgroup>
                  </select>
                </label>
              )}
            </div>
            <label style={{ display: 'block', marginTop: 8 }}><span style={lbl}>Detalle (opcional)</span>
              <textarea value={nuevo.detalle} onChange={(e) => setNuevo({ ...nuevo, detalle: e.target.value })} rows={2}
                placeholder="Contexto, número de radicado, con quién se habló…" style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'var(--ui)' }} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
              <button className="dbtn primary" disabled={guardando} onClick={crear} style={{ fontSize: 12.5 }}>Guardar</button>
              <button className="dbtn" disabled={guardando} onClick={() => { setAbriendo(false); setNuevo(vacio()); setAsesores([]); setMsg(null); }} style={{ fontSize: 12.5 }}>Cancelar</button>
            </div>
          </div>
        )}

        {filas.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '10px 2px 14px' }}>No tienes pendientes anotados. 🎉</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10 }}>
            {filas.map((p) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--panel)',
                borderLeft: `3px solid ${p.atrasado ? 'var(--peligro)' : p.esHoy ? 'var(--info)' : 'var(--line)'}`,
              }}>
                <button onClick={() => marcarHecho(p.id)} title="Marcar como hecho"
                  style={{ flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: 5, border: '1.5px solid var(--edge-strong)', background: 'none', cursor: 'pointer' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, lineHeight: 1.3 }}>{p.titulo}</div>
                  {p.detalle && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{p.detalle}</div>}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, fontSize: 11.5, color: 'var(--muted)' }}>
                    <span style={{ fontWeight: 700, color: p.atrasado ? 'var(--peligro-fuerte)' : p.esHoy ? 'var(--info-fuerte)' : 'var(--muted)' }}>
                      {p.atrasado ? '⚠ ' : ''}{fmtDia(p.fecha)}
                    </span>
                    {p.empresa && <span>· {p.empresa.nombre}</span>}
                    {p.responsable && <span>· {p.responsable.nombre}</span>}
                    {/* Quién lo pidió importa cuando lo asignó otra persona. */}
                    {p.creadoPor && p.responsable && p.creadoPor.id !== p.responsable.id && <span>· lo pidió {p.creadoPor.nombre}</span>}
                  </div>
                </div>
                <button onClick={() => borrar(p.id)} title="Eliminar"
                  style={{ flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelPlegable>
  );
}
