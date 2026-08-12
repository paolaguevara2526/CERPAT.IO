'use client';
// Novedades del día, dentro de Mi Día: lo que impidió trabajar (internet,
// acceso al sistema, equipo lento) con su plan de acción.
//
// La regla con la que se abrió este espacio: NO hay novedad sin plan de acción.
// Reportar sin decir qué se hizo convierte esto en un buzón de quejas; con el
// plan, cada reporte es un problema más lo que su dueño hizo al respecto.
//
// Y una novedad nunca cambia el estado de una tarea: explica el atraso, no lo
// disculpa. Por eso este panel no toca nada del resto de Mi Día.

import { useEffect, useState } from 'react';
import PanelPlegable from '@/app/_components/PanelPlegable';
import { formatoMinutos } from '@/lib/tiempo-novedad';
import { fmtDia } from '@/lib/fechas';

type Opcion = { id: string; nombre: string };
type Novedad = {
  id: string; fecha: string; descripcion: string; planAccion: string;
  horaDesde: string | null; horaHasta: string | null; minutos: number | null;
  estado: string; cerradaEn: string | null;
  tipo: Opcion; usuario: Opcion; cerradaPor: Opcion | null;
  empresa: Opcion | null; area: Opcion | null;
};
type Resp = { total: number; abiertas: number; minutos: number; novedades: Novedad[] };

const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmtFecha = (iso: string) => {
  try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return '—'; }
};

export default function NovedadesDelDia() {
  const [data, setData] = useState<Resp | null>(null);
  const [tipos, setTipos] = useState<Opcion[]>([]);
  const [areas, setAreas] = useState<Opcion[]>([]);
  const [empresas, setEmpresas] = useState<Opcion[]>([]);
  const [formAbierto, setFormAbierto] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Campos del formulario
  const [tipoId, setTipoId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [planAccion, setPlanAccion] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [areaId, setAreaId] = useState('');

  async function cargar() {
    try {
      const r = await fetch('/api/novedades', { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* silencioso */ }
  }
  useEffect(() => {
    cargar();
    fetch('/api/novedades/form-datos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { setTipos(d.tipos ?? []); setAreas(d.areas ?? []); setEmpresas(d.empresas ?? []); })
      .catch(() => {});
  }, []);

  async function reportar() {
    setGuardando(true); setMsg(null);
    try {
      const r = await fetch('/api/novedades', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoId, fecha, descripcion, planAccion,
          horaDesde: desde || null, horaHasta: hasta || null,
          empresaId: empresaId || null, areaId: areaId || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo reportar la novedad.'); return; }
      // Se limpia lo que cambia entre reportes; el tipo y la fecha se quedan,
      // porque cuando el internet se cae tres veces, las tres son del mismo día.
      setDescripcion(''); setPlanAccion(''); setDesde(''); setHasta('');
      setEmpresaId(''); setAreaId(''); setFormAbierto(false);
      await cargar();
    } catch { setMsg('Error de red.'); } finally { setGuardando(false); }
  }

  async function cambiarEstado(id: string, estado: 'resuelta' | 'abierta') {
    setMsg(null);
    const r = await fetch(`/api/novedades/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'No se pudo actualizar.'); }
    await cargar();
  }

  async function borrar(id: string) {
    if (!window.confirm('¿Borrar esta novedad? Solo para errores de digitación.')) return;
    setMsg(null);
    const r = await fetch(`/api/novedades/${id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'No se pudo borrar.'); }
    await cargar();
  }

  if (!data) return null;

  const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--edge-strong)', borderRadius: 6, fontSize: 12.5, background: 'var(--panel)', color: 'var(--ink)', fontFamily: 'var(--ui)' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', display: 'block', marginBottom: 4 };
  const puedeReportar = !!tipoId && !!descripcion.trim() && !!planAccion.trim();

  return (
    <PanelPlegable
      id="novedades-del-dia" titulo="📣 Novedades" abiertoPorDefecto={false}
      nota="Lo que te impidió trabajar, con su plan de acción. No cambia el estado de ninguna tarea."
      resumen={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          {data.abiertas > 0
            ? <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--alerta-fuerte)', background: 'var(--alerta-suave)', borderRadius: 20, padding: '4px 12px' }}>{data.abiertas} abierta(s)</span>
            : <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>sin novedades abiertas</span>}
          {data.minutos > 0 && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· {formatoMinutos(data.minutos)} reportados</span>}
        </span>
      }
    >
      <div style={{ padding: '12px 16px 16px' }}>
        {msg && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{msg}</div>}

        {!formAbierto ? (
          <button className="dbtn primary" onClick={() => setFormAbierto(true)} style={{ fontSize: 13, marginBottom: data.novedades.length > 0 ? 14 : 0 }}>
            + Reportar novedad
          </button>
        ) : (
          <div style={{ border: '1px solid var(--edge-strong)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <label style={lbl}>Tipo *</label>
                <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} style={{ ...inp, minWidth: 170 }}>
                  <option value="">— elige la causa —</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Desde</label>
                <input type="time" value={desde} onChange={(e) => setDesde(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Hasta</label>
                <input type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inp} />
              </div>
            </div>

            <div>
              <label style={lbl}>Qué pasó *</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2}
                placeholder="Ej.: se cayó el internet de la oficina y no cargaba el sistema contable"
                style={{ ...inp, width: '100%', resize: 'vertical' }} />
            </div>

            <div>
              <label style={lbl}>Plan de acción * <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— qué hiciste o qué vas a hacer</span></label>
              <textarea value={planAccion} onChange={(e) => setPlanAccion(e.target.value)} rows={2}
                placeholder="Ej.: compartí datos del celular y avisé al proveedor; retomo la captura de XYZ hoy en la tarde"
                style={{ ...inp, width: '100%', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <label style={lbl}>Cliente (opcional)</label>
                <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ ...inp, minWidth: 190 }}>
                  <option value="">— general —</option>
                  {empresas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Área (opcional)</label>
                <select value={areaId} onChange={(e) => setAreaId(e.target.value)} style={{ ...inp, minWidth: 150 }}>
                  <option value="">— general —</option>
                  {areas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="dbtn primary" disabled={!puedeReportar || guardando} onClick={reportar} style={{ fontSize: 13 }}>
                {guardando ? 'Guardando…' : 'Reportar'}
              </button>
              <button className="dbtn" onClick={() => { setFormAbierto(false); setMsg(null); }} style={{ fontSize: 12.5 }}>Cancelar</button>
              {!puedeReportar && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>El tipo, qué pasó y el plan de acción son obligatorios.</span>}
            </div>
          </div>
        )}

        {data.novedades.length === 0 ? (
          !formAbierto && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>No has reportado novedades.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.novedades.map((n) => (
              <div key={n.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', opacity: n.estado === 'resuelta' ? 0.75 : 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
                  <b style={{ fontSize: 12.5 }}>{n.tipo.nombre}</b>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{fmtFecha(n.fecha)}</span>
                  {n.minutos != null && <span style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{n.horaDesde}–{n.horaHasta} · {formatoMinutos(n.minutos)}</span>}
                  {n.empresa && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· {n.empresa.nombre}</span>}
                  {n.area && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· {n.area.nombre}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap',
                    color: n.estado === 'resuelta' ? 'var(--exito-fuerte)' : 'var(--alerta-fuerte)',
                    background: n.estado === 'resuelta' ? 'var(--exito-suave)' : 'var(--alerta-suave)' }}>
                    {n.estado === 'resuelta' ? '✓ resuelta' : 'abierta'}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, marginBottom: 3 }}>{n.descripcion}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}><b>Plan:</b> {n.planAccion}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 7 }}>
                  {n.estado === 'abierta'
                    ? <button className="dbtn" onClick={() => cambiarEstado(n.id, 'resuelta')} style={{ fontSize: 11.5, padding: '4px 9px' }}>Marcar resuelta</button>
                    : (
                      <>
                        {n.cerradaEn && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cerrada el {fmtFecha(n.cerradaEn)}{n.cerradaPor ? ` por ${n.cerradaPor.nombre}` : ''}</span>}
                        <button className="dbtn" onClick={() => cambiarEstado(n.id, 'abierta')} style={{ fontSize: 11.5, padding: '4px 9px' }}>Reabrir</button>
                      </>
                    )}
                  <button onClick={() => borrar(n.id)} title="Borrar (solo errores de digitación)"
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelPlegable>
  );
}
