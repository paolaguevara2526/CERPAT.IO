'use client';
// Ver y editar las responsabilidades tributarias de cada cliente:
// config nacional (IVA, retención, consumo, renta, anticipo RST) + ICA por
// municipio (reteICA / autoICA). Contra la API vía /api/admin/config-tributaria.

import { useCallback, useEffect, useState } from 'react';
import FiltroColumna from './FiltroColumna';

type Empresa = { id: string; nombre: string; nit: string | null };
type Ica = { id: string; municipioId: string; municipio: string | null; departamento: string | null; icaPeriodicidad: string | null; reteica: boolean; reteicaPeriodicidad: string | null; autoica: boolean; autoicaPeriodicidad: string | null; fechaInscripcion: string | null };
type SinCalendario = { municipio: string; departamento: string | null; obligaciones: string[] };
type Config = { ivaPeriodicidad: string | null; retencionFuente: boolean; fopat: boolean; nominaElectronica: boolean; seguridadSocial: boolean; consumoPeriodicidad: string | null; rentaTipo: string | null; anticipoRstPeriodicidad: string | null } | null;
const CONFIG_VACIA = { ivaPeriodicidad: null, retencionFuente: false, fopat: false, nominaElectronica: false, seguridadSocial: false, consumoPeriodicidad: null, rentaTipo: null, anticipoRstPeriodicidad: null };

const IVA = [['', 'No responsable'], ['bimestral', 'Bimestral'], ['cuatrimestral', 'Cuatrimestral'], ['anual_rst', 'Anual (RST)']];
const CONSUMO = [['', 'No responsable'], ['bimestral', 'Bimestral'], ['anual_rst', 'Anual (RST)']];
const RENTA = [['', 'No aplica'], ['persona_juridica', 'Persona jurídica'], ['persona_natural', 'Persona natural'], ['gran_contribuyente', 'Gran contribuyente'], ['rst_consolidada', 'RST consolidada']];
const ANTICIPO = [['', 'No aplica'], ['bimestral', 'Bimestral']];
const ICA_PER = [['', '—'], ['mensual', 'Mensual'], ['bimestral', 'Bimestral'], ['anual', 'Anual']];

const input: React.CSSProperties = { padding: '7px 9px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'var(--ui)', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--muted)', marginBottom: 4 };

function Sel({ value, onChange, opciones }: { value: string; onChange: (v: string) => void; opciones: string[][] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} style={input}>{opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;
}

export default function ConfigTributariaEditor() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Empresa | null>(null);
  const [config, setConfig] = useState<Config>(null);
  const [ica, setIca] = useState<Ica[]>([]);
  // Filtros estilo Excel por columna (null = todos).
  const [fMun, setFMun] = useState<Set<string> | null>(null);
  const [fIca, setFIca] = useState<Set<string> | null>(null);
  const [fRete, setFRete] = useState<Set<string> | null>(null);
  const [fAuto, setFAuto] = useState<Set<string> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerando, setRegenerando] = useState(false);
  const [regResumen, setRegResumen] = useState<string | null>(null);
  const [regAviso, setRegAviso] = useState<SinCalendario[]>([]);
  // búsqueda de municipio para agregar
  const [munQ, setMunQ] = useState('');
  const [munRes, setMunRes] = useState<{ id: string; nombre: string; departamento: string | null }[]>([]);

  useEffect(() => { fetch('/api/admin/empresas', { cache: 'no-store' }).then((r) => r.json()).then((d) => setEmpresas(d.items ?? [])).catch(() => {}); }, []);

  const abrir = useCallback(async (e: Empresa) => {
    setSel(e); setCargando(true); setError(null); setOk(false); setRegResumen(null); setRegAviso([]); setMunQ(''); setMunRes([]);
    setFMun(null); setFIca(null); setFRete(null); setFAuto(null);
    try {
      const r = await fetch(`/api/admin/config-tributaria/${e.id}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo cargar.'); return; }
      setConfig(d.config ?? { ...CONFIG_VACIA });
      setIca(d.municipiosIca ?? []);
    } catch { setError('Error de red.'); } finally { setCargando(false); }
  }, []);

  function setC<K extends keyof NonNullable<Config>>(k: K, v: NonNullable<Config>[K]) {
    setConfig((c) => ({ ...(c ?? { ...CONFIG_VACIA }), [k]: v }));
    setOk(false); setRegResumen(null);
  }

  async function guardar() {
    if (!sel || !config) return;
    setGuardando(true); setError(null); setOk(false);
    try {
      const r = await fetch(`/api/admin/config-tributaria/${sel.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo guardar.'); return; }
      setOk(true); setTimeout(() => setOk(false), 2500);
    } catch { setError('Error de red.'); } finally { setGuardando(false); }
  }

  async function regenerar() {
    if (!sel) return;
    if (!confirm(`¿Regenerar los vencimientos de ${sel.nombre} (nacionales + ICA municipal) según su configuración actual?\n\nNo se tocan los pagos ya registrados ni las entradas manuales. Guarda primero los cambios de la config.`)) return;
    setRegenerando(true); setError(null); setRegResumen(null); setRegAviso([]);
    try {
      const r = await fetch(`/api/vencimientos/regenerar/${sel.id}`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo regenerar.'); return; }
      const s = d.resumen ?? {};
      setRegResumen(
        `Vencimientos ${d.anio} regenerados: ${s.creados ?? 0} nuevos · ${s.actualizados ?? 0} con fecha ajustada · ${s.sinCambios ?? 0} sin cambios · ${s.eliminados ?? 0} eliminados`
        + (s.conservadosConPago ? ` · ${s.conservadosConPago} conservados por tener pago registrado` : '') + '.'
      );
      setRegAviso(Array.isArray(d.sinCalendario) ? d.sinCalendario : []);
    } catch { setError('Error de red.'); } finally { setRegenerando(false); }
  }

  // ICA
  async function buscarMun(v: string) {
    setMunQ(v);
    if (v.trim().length < 2) { setMunRes([]); return; }
    const r = await fetch(`/api/admin/municipios?q=${encodeURIComponent(v.trim())}`, { cache: 'no-store' });
    const d = await r.json().catch(() => ({ items: [] }));
    setMunRes(d.items ?? []);
  }
  async function agregarMun(m: { id: string; nombre: string }) {
    if (!sel) return;
    setError(null);
    const r = await fetch(`/api/admin/config-tributaria/${sel.id}/ica`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ municipioId: m.id, reteica: true, reteicaPeriodicidad: 'bimestral' }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'No se pudo agregar el municipio.'); return; }
    setMunQ(''); setMunRes([]); abrir(sel);
  }
  async function guardarIca(row: Ica) {
    if (!sel) return;
    const r = await fetch(`/api/admin/config-tributaria/${sel.id}/ica/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo guardar el municipio.'); }
    else { setError(null); }
  }
  async function quitarIca(row: Ica) {
    if (!sel || !confirm(`¿Quitar ${row.municipio} de la config de ICA?`)) return;
    const r = await fetch(`/api/admin/config-tributaria/${sel.id}/ica/${row.id}`, { method: 'DELETE' });
    if (r.ok) setIca((p) => p.filter((x) => x.id !== row.id));
  }
  function setIcaRow(id: string, patch: Partial<Ica>) { setIca((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))); }

  const filtrada = empresas.filter((e) => !q || `${e.nombre} ${e.nit ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  // Valores por columna para los filtros tipo Excel.
  const valMun = (r: Ica) => `${r.municipio ?? ''}${r.departamento ? ' · ' + r.departamento : ''}`;
  const perLabel = (v: string | null) => (ICA_PER.find(([k]) => k === (v ?? ''))?.[1] ?? '—');
  const valIca = (r: Ica) => perLabel(r.icaPeriodicidad);
  const valRete = (r: Ica) => (r.reteica ? 'Sí' : 'No');
  const valAuto = (r: Ica) => (r.autoica ? 'Sí' : 'No');
  const distintos = (fn: (r: Ica) => string) => [...new Set(ica.map(fn))].sort((a, b) => a.localeCompare(b));
  const icaFiltrada = ica.filter((r) =>
    (fMun == null || fMun.has(valMun(r)))
    && (fIca == null || fIca.has(valIca(r)))
    && (fRete == null || fRete.has(valRete(r)))
    && (fAuto == null || fAuto.has(valAuto(r))),
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 18, alignItems: 'start' }}>
      {/* Lista de clientes */}
      <div className="panel" style={{ padding: 10, maxHeight: 560, overflow: 'auto' }}>
        <input style={{ ...input, marginBottom: 8 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente o NIT…" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtrada.map((e) => (
            <button key={e.id} onClick={() => abrir(e)} style={{ textAlign: 'left', border: 'none', borderRadius: 5, padding: '7px 9px', cursor: 'pointer', fontFamily: 'var(--ui)', fontSize: 12.5, background: sel?.id === e.id ? 'var(--panel-2)' : 'transparent', fontWeight: sel?.id === e.id ? 700 : 500, color: 'var(--ink)' }}>
              {e.nombre}{e.nit ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {e.nit}</span> : null}
            </button>
          ))}
          {filtrada.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>Sin resultados.</div>}
        </div>
      </div>

      {/* Detalle */}
      <div>
        {!sel ? (
          <div className="panel" style={{ padding: 26, color: 'var(--muted)', fontSize: 13 }}>Elige un cliente para ver y editar sus responsabilidades tributarias.</div>
        ) : cargando ? (
          <div className="panel" style={{ padding: 26, color: 'var(--muted)' }}>Cargando…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{sel.nombre}</h2>
              {sel.nit && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>NIT {sel.nit}</span>}
            </div>
            {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600 }}>{error}</div>}

            {/* Config nacional */}
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Responsabilidades nacionales</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div><span style={lbl}>IVA</span><Sel value={config?.ivaPeriodicidad ?? ''} onChange={(v) => setC('ivaPeriodicidad', v || null)} opciones={IVA} /></div>
                <div><span style={lbl}>Impuesto al consumo</span><Sel value={config?.consumoPeriodicidad ?? ''} onChange={(v) => setC('consumoPeriodicidad', v || null)} opciones={CONSUMO} /></div>
                <div><span style={lbl}>Renta</span><Sel value={config?.rentaTipo ?? ''} onChange={(v) => setC('rentaTipo', v || null)} opciones={RENTA} /></div>
                <div><span style={lbl}>Anticipo RST</span><Sel value={config?.anticipoRstPeriodicidad ?? ''} onChange={(v) => setC('anticipoRstPeriodicidad', v || null)} opciones={ANTICIPO} /></div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!config?.retencionFuente} onChange={(e) => setC('retencionFuente', e.target.checked)} style={{ accentColor: 'var(--navy)' }} />
                    Agente de retención en la fuente
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} title="Retención FOPAT (mensual), aplica a empresas de transporte">
                    <input type="checkbox" checked={!!config?.fopat} onChange={(e) => setC('fopat', e.target.checked)} style={{ accentColor: 'var(--navy)' }} />
                    Agente de retención FOPAT (transporte)
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} title="Envío de nómina electrónica (mensual, 10º día hábil). Solo presentación, no genera pago.">
                    <input type="checkbox" checked={!!config?.nominaElectronica} onChange={(e) => setC('nominaElectronica', e.target.checked)} style={{ accentColor: 'var(--navy)' }} />
                    Nómina electrónica <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(sin pago)</span>
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} title="Pago de seguridad social / PILA (mensual, día hábil según los 2 últimos dígitos del NIT). Solo presentación, no genera pago.">
                    <input type="checkbox" checked={!!config?.seguridadSocial} onChange={(e) => setC('seguridadSocial', e.target.checked)} style={{ accentColor: 'var(--navy)' }} />
                    Seguridad social · PILA <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(sin pago)</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : ok ? '✓ Guardado' : 'Guardar'}</button>
                <button className="dbtn" onClick={regenerar} disabled={regenerando || guardando} style={{ fontSize: 13 }} title="Rehace los vencimientos nacionales de este cliente según la config actual, sin tocar los pagos ni el ICA municipal">
                  {regenerando ? 'Regenerando…' : '↻ Regenerar vencimientos'}
                </button>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Guarda los cambios y luego regenera para que los vencimientos reflejen la config nueva.</span>
              </div>
              {regResumen && (
                <div style={{ marginTop: 12, background: 'var(--exito-suave)', color: 'var(--exito-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 12.5, fontWeight: 600 }}>{regResumen}</div>
              )}
              {regAviso.length > 0 && (
                <div style={{ marginTop: 10, background: 'var(--alerta-suave)', color: 'var(--alerta-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ Sin calendario de ICA para:</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {regAviso.map((a, i) => (
                      <li key={i}><b>{a.municipio}</b>{a.departamento ? ` · ${a.departamento}` : ''} — {a.obligaciones.join(', ')}</li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 4, fontSize: 11.5 }}>No se generaron esos vencimientos porque falta la fecha en el calendario municipal. Agrega sus fechas a <code>docs/data/calendario-ica-municipal-2026.csv</code> y regenera.</div>
                </div>
              )}
            </div>

            {/* ICA por municipio */}
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>ICA por municipio</div>
              <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 12px' }}>Municipios donde el cliente declara ICA, con reteICA / autoICA.</p>

              {/* Agregar municipio (arriba, para que el desplegable no se recorte con el overflow del panel) */}
              <div style={{ position: 'relative', maxWidth: 360, marginBottom: 14 }}>
                <input style={input} value={munQ} onChange={(e) => buscarMun(e.target.value)} placeholder="+ Agregar municipio (escribe 2+ letras)…" />
                {munQ.trim().length >= 2 && (
                  <div className="panel" style={{ position: 'absolute', zIndex: 40, top: 'calc(100% + 3px)', left: 0, right: 0, maxHeight: 260, overflow: 'auto', padding: 4, boxShadow: '0 8px 24px rgba(10,18,34,.18)' }}>
                    {munRes.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)', padding: '7px 8px' }}>Sin resultados para “{munQ.trim()}”.</div>
                    ) : munRes.map((m) => (
                      <button key={m.id} onClick={() => agregarMun(m)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 4, padding: '6px 8px', cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--ui)', color: 'var(--ink)' }}>
                        {m.nombre}{m.departamento ? <span style={{ color: 'var(--muted)' }}> · {m.departamento}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {ica.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>Sin municipios de ICA.</div>
              ) : (
                <>
                  <div className="dt-wrap" style={{ marginBottom: 12, overflow: 'visible' }}>
                    <table className="dt">
                      <thead><tr>
                        <th style={{ whiteSpace: 'nowrap' }}>Municipio <FiltroColumna valores={distintos(valMun)} seleccion={fMun} onCambio={setFMun} buscar ancho={260} /></th>
                        <th style={{ whiteSpace: 'nowrap' }}>ICA <FiltroColumna valores={distintos(valIca)} seleccion={fIca} onCambio={setFIca} /></th>
                        <th style={{ whiteSpace: 'nowrap' }}>ReteICA <FiltroColumna valores={distintos(valRete)} seleccion={fRete} onCambio={setFRete} /></th>
                        <th style={{ whiteSpace: 'nowrap' }}>AutoICA <FiltroColumna valores={distintos(valAuto)} seleccion={fAuto} onCambio={setFAuto} /></th>
                        <th style={{ whiteSpace: 'nowrap' }} title="Desde esta fecha se generan los vencimientos de ICA de este municipio (no afecta lo ya cargado)">Inscripción</th>
                        <th></th>
                      </tr></thead>
                      <tbody>
                      {icaFiltrada.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>Ningún municipio con esos filtros.</td></tr>
                      ) : icaFiltrada.map((row) => (
                        <tr key={row.id}>
                          <td style={{ fontWeight: 600 }}>{row.municipio}{row.departamento ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {row.departamento}</span> : null}</td>
                          <td style={{ minWidth: 110 }}><Sel value={row.icaPeriodicidad ?? ''} onChange={(v) => setIcaRow(row.id, { icaPeriodicidad: v || null })} opciones={ICA_PER} /></td>
                          <td style={{ minWidth: 150 }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}><input type="checkbox" checked={row.reteica} onChange={(e) => setIcaRow(row.id, { reteica: e.target.checked })} /> Sí</label>
                            {row.reteica && <div style={{ marginTop: 4 }}><Sel value={row.reteicaPeriodicidad ?? ''} onChange={(v) => setIcaRow(row.id, { reteicaPeriodicidad: v || null })} opciones={ICA_PER} /></div>}
                          </td>
                          <td style={{ minWidth: 150 }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}><input type="checkbox" checked={row.autoica} onChange={(e) => setIcaRow(row.id, { autoica: e.target.checked })} /> Sí</label>
                            {row.autoica && <div style={{ marginTop: 4 }}><Sel value={row.autoicaPeriodicidad ?? ''} onChange={(v) => setIcaRow(row.id, { autoicaPeriodicidad: v || null })} opciones={ICA_PER} /></div>}
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <input type="date" value={row.fechaInscripcion ?? ''} onChange={(e) => setIcaRow(row.id, { fechaInscripcion: e.target.value || null })} style={{ ...input, padding: '6px 7px' }} title="Opcional. Desde esta fecha se generan los vencimientos de ICA." />
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="dbtn" onClick={() => guardarIca(row)} style={{ fontSize: 11.5, marginRight: 6 }}>Guardar</button>
                            <button onClick={() => quitarIca(row)} title="Quitar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--peligro)', fontSize: 13 }}>🗑</button>
                          </td>
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
