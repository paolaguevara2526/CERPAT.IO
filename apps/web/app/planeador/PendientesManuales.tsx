'use client';
// Sección "Pagos pendientes" de la vista de Pagos: registrar a mano deudas de
// años anteriores o impuestos que no se cargaron al sistema. Alta (formulario),
// edición del valor/estado (reutiliza VencimientoPagoEditor) y borrado.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import VencimientoPagoEditor, { VENC_PAGO_META } from './VencimientoPagoEditor';

type Empresa = { id: string; nombre: string };
type Municipio = { id: string; nombre: string; departamento: string | null };
type Pendiente = {
  id: string; obligacion: string; anio: number; periodo: string | null; municipio: string | null;
  empresa: string | null; fechaVencimiento: string; estado: string; valorPago: number | null; notas: string | null;
  diasMora: number; interesMora: number;
};

// Catálogo de obligaciones (uniforme). Los nombres casan con las reglas de
// límite de pago del backend (retención/autorretención/ReteICA → INEFICAZ, etc.).
const OBLIGACIONES = [
  'Retención en la fuente', 'Autorretención', 'IVA', 'Impuesto al consumo', 'Anticipo RST',
  'Renta Persona Jurídica', 'Renta Persona Natural', 'Renta Grandes Contribuyentes',
  'ICA (Industria y comercio)', 'ReteICA', 'AutoICA',
];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const BIMESTRES = [['Bimestre 1', 'ene-feb'], ['Bimestre 2', 'mar-abr'], ['Bimestre 3', 'may-jun'], ['Bimestre 4', 'jul-ago'], ['Bimestre 5', 'sep-oct'], ['Bimestre 6', 'nov-dic']];
const CUATRIMESTRES = [['Cuatrimestre 1', 'ene-abr'], ['Cuatrimestre 2', 'may-ago'], ['Cuatrimestre 3', 'sep-dic']];

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
}
const fmtCOP = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 0 });

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)',
  background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)',
};

export default function PendientesManuales({ empresas, pendientes, mostrarTabla = true, editable = true }: { empresas: Empresa[]; pendientes: Pendiente[]; mostrarTabla?: boolean; editable?: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const anioActual = new Date().getFullYear();
  const [empresaId, setEmpresaId] = useState('');
  const [obligacion, setObligacion] = useState('');
  const [obligacionOtra, setObligacionOtra] = useState('');
  const [anio, setAnio] = useState<string>(String(anioActual - 1));
  const [periodo, setPeriodo] = useState('');
  const [fecha, setFecha] = useState('');
  const [valor, setValor] = useState('');
  const [notas, setNotas] = useState('');
  // Municipio (para ICA / ReteICA) con autocompletar.
  const [munQ, setMunQ] = useState('');
  const [munRes, setMunRes] = useState<Municipio[]>([]);
  const [munId, setMunId] = useState('');
  const [munNombre, setMunNombre] = useState('');

  const obligacionFinal = obligacion === '__otra__' ? obligacionOtra.trim() : obligacion;
  const aplicaMunicipio = /ica/i.test(obligacionFinal);

  function limpiar() {
    setEmpresaId(''); setObligacion(''); setObligacionOtra(''); setAnio(String(anioActual - 1));
    setPeriodo(''); setFecha(''); setValor(''); setNotas(''); setError(null);
    setMunQ(''); setMunRes([]); setMunId(''); setMunNombre('');
  }

  async function buscarMun(v: string) {
    setMunQ(v); setMunId(''); setMunNombre('');
    if (v.trim().length < 2) { setMunRes([]); return; }
    try {
      const r = await fetch(`/api/admin/municipios?q=${encodeURIComponent(v.trim())}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({ items: [] }));
      setMunRes(d.items ?? []);
    } catch { setMunRes([]); }
  }
  function elegirMun(m: Municipio) {
    setMunId(m.id); setMunNombre(m.nombre); setMunQ(m.nombre); setMunRes([]);
  }

  async function agregar() {
    setError(null);
    if (!empresaId) { setError('Selecciona un cliente.'); return; }
    if (!obligacionFinal) { setError('Selecciona la obligación.'); return; }
    if (!fecha) { setError('Indica la fecha de vencimiento.'); return; }
    setGuardando(true);
    try {
      const res = await fetch('/api/vencimientos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId, obligacion: obligacionFinal, anio: Number(anio),
          periodo: periodo.trim() || null, fechaVencimiento: fecha,
          municipioId: munId || null,
          valorPago: valor === '' ? null : Number(valor), notas: notas.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'No se pudo guardar.'); setGuardando(false); return; }
      setGuardando(false); setAbierto(false); limpiar();
      router.refresh();
    } catch {
      setError('Error de red.'); setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    setBorrando(id);
    try {
      const res = await fetch(`/api/vencimientos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); setBorrando(null); return; }
      router.refresh();
    } catch {
      setError('Error de red.'); setBorrando(null);
    }
  }

  const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 3px' }}>Pagos pendientes</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px', maxWidth: 640 }}>
            Deudas agregadas a mano: obligaciones de <strong>años anteriores</strong> o impuestos que no se cargaron al sistema. No dependen del generador de vencimientos.
          </p>
        </div>
        {editable && (
          <button className="dbtn primary" onClick={() => { setAbierto((v) => !v); setError(null); }} style={{ fontSize: 13 }}>
            {abierto ? 'Cerrar' : '+ Agregar pago pendiente'}
          </button>
        )}
      </div>

      {abierto && (
        <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
            <label style={lbl}>
              Cliente *
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={inp}>
                <option value="">Selecciona…</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </label>
            <label style={lbl}>
              Obligación *
              <select value={obligacion} onChange={(e) => setObligacion(e.target.value)} style={inp}>
                <option value="">Selecciona…</option>
                {OBLIGACIONES.map((o) => <option key={o} value={o}>{o}</option>)}
                <option value="__otra__">Otra…</option>
              </select>
              {obligacion === '__otra__' && (
                <input value={obligacionOtra} onChange={(e) => setObligacionOtra(e.target.value)} placeholder="Escribe la obligación" style={{ ...inp, marginTop: 4 }} />
              )}
            </label>
            <label style={lbl}>
              Año *
              <input type="number" min={2000} max={2100} value={anio} onChange={(e) => setAnio(e.target.value)} style={inp} />
            </label>
            <label style={lbl}>
              Período
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={inp}>
                <option value="">Sin período</option>
                <option value="Anual">Anual</option>
                <optgroup label="Mensual">
                  {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
                </optgroup>
                <optgroup label="Bimestral">
                  {BIMESTRES.map(([v, r]) => <option key={v} value={v}>{v} · {r}</option>)}
                </optgroup>
                <optgroup label="Cuatrimestral">
                  {CUATRIMESTRES.map(([v, r]) => <option key={v} value={v}>{v} · {r}</option>)}
                </optgroup>
              </select>
            </label>
            <label style={lbl}>
              Vence *
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} />
            </label>
            <label style={lbl}>
              Valor a pagar
              <input type="number" min={0} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" style={{ ...inp, textAlign: 'right' }} />
            </label>
            <label style={{ ...lbl, position: 'relative' }}>
              Municipio {aplicaMunicipio ? '(ICA)' : '(opcional)'}
              <input
                value={munQ}
                onChange={(e) => buscarMun(e.target.value)}
                placeholder="Escribe 2+ letras…"
                style={inp}
              />
              {munNombre && munId && <span style={{ fontSize: 11, color: '#16794c', marginTop: 2 }}>✓ {munNombre}</span>}
              {munRes.length > 0 && (
                <div className="panel" style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, maxHeight: 200, overflow: 'auto', padding: 4, boxShadow: '0 8px 24px rgba(10,18,34,.18)' }}>
                  {munRes.map((m) => (
                    <button key={m.id} type="button" onClick={() => elegirMun(m)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 4, padding: '6px 8px', cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--ui)', color: 'var(--ink)' }}>
                      {m.nombre}{m.departamento ? <span style={{ color: 'var(--muted)' }}> · {m.departamento}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label style={{ ...lbl, gridColumn: '1 / -1' }}>
              Notas
              <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Detalle de la deuda (opcional)" style={inp} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <button className="dbtn primary" onClick={agregar} disabled={guardando} style={{ fontSize: 13, opacity: guardando ? 0.5 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar pago pendiente'}
            </button>
            <button className="dbtn" onClick={() => { setAbierto(false); limpiar(); }} style={{ fontSize: 13 }}>Cancelar</button>
            {error && <span style={{ fontSize: 12, color: '#cf4436' }}>{error}</span>}
          </div>
        </div>
      )}

      {!mostrarTabla ? null : pendientes.length === 0 ? (
        !abierto && (
          <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            No hay pagos pendientes agregados a mano.
            <div style={{ fontSize: 12, marginTop: 6 }}>Usa <strong>+ Agregar pago pendiente</strong> para registrar deudas de años anteriores.</div>
          </div>
        )
      ) : (
        <div className="panel">
          <div className="dt-wrap">
            <table className="dt">
              <thead>
                <tr><th>Obligación</th><th>Cliente</th><th style={{ whiteSpace: 'nowrap' }}>Año / período</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th style={{ whiteSpace: 'nowrap' }}>Interés de mora</th><th>Valor y estado de pago</th><th></th></tr>
              </thead>
              <tbody>
                {pendientes.map((p) => {
                  const vencido = new Date(p.fechaVencimiento) < new Date() && p.estado !== 'presentado_pagado' && p.estado !== 'presentado_cero';
                  const meta = VENC_PAGO_META[p.estado] ?? VENC_PAGO_META.pendiente;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        {p.obligacion}{p.municipio ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {p.municipio}</span> : null}
                        {p.notas ? <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{p.notas}</span> : null}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{p.empresa ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{p.anio}{p.periodo ? ` · ${p.periodo}` : ''}</td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: vencido ? 800 : 500, color: vencido ? '#d64b3f' : 'var(--muted)' }} title={meta.label}>{fmtFecha(p.fechaVencimiento)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {p.interesMora > 0
                          ? <><span style={{ fontWeight: 600, color: '#c67c00' }}>${fmtCOP(p.interesMora)}</span><div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{p.diasMora} d de mora</div></>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td><VencimientoPagoEditor id={p.id} valorPago={p.valorPago} estado={p.estado} editable={editable} /></td>
                      <td>
                        {editable && (
                          <button
                            className="dbtn" onClick={() => eliminar(p.id)} disabled={borrando === p.id}
                            title="Eliminar pago pendiente"
                            style={{ fontSize: 12, color: '#cf4436', opacity: borrando === p.id ? 0.5 : 1 }}
                          >
                            {borrando === p.id ? '…' : 'Eliminar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
