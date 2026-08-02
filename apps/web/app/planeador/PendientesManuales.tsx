'use client';
// Sección "Pagos pendientes" de la vista de Pagos: registrar a mano deudas de
// años anteriores o impuestos que no se cargaron al sistema. Alta (formulario),
// edición del valor/estado (reutiliza VencimientoPagoEditor) y borrado.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import VencimientoPagoEditor, { VENC_PAGO_META } from './VencimientoPagoEditor';

type Empresa = { id: string; nombre: string };
type Pendiente = {
  id: string; obligacion: string; anio: number; periodo: string | null; municipio: string | null;
  empresa: string | null; fechaVencimiento: string; estado: string; valorPago: number | null; notas: string | null;
};

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
}

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)',
  background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)',
};

export default function PendientesManuales({ empresas, pendientes }: { empresas: Empresa[]; pendientes: Pendiente[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const anioActual = new Date().getFullYear();
  const [empresaId, setEmpresaId] = useState('');
  const [obligacion, setObligacion] = useState('');
  const [anio, setAnio] = useState<string>(String(anioActual - 1));
  const [periodo, setPeriodo] = useState('');
  const [fecha, setFecha] = useState('');
  const [valor, setValor] = useState('');
  const [notas, setNotas] = useState('');

  function limpiar() {
    setEmpresaId(''); setObligacion(''); setAnio(String(anioActual - 1));
    setPeriodo(''); setFecha(''); setValor(''); setNotas(''); setError(null);
  }

  async function agregar() {
    setError(null);
    if (!empresaId) { setError('Selecciona un cliente.'); return; }
    if (!obligacion.trim()) { setError('Indica la obligación.'); return; }
    if (!fecha) { setError('Indica la fecha de vencimiento.'); return; }
    setGuardando(true);
    try {
      const res = await fetch('/api/vencimientos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId, obligacion: obligacion.trim(), anio: Number(anio),
          periodo: periodo.trim() || null, fechaVencimiento: fecha,
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

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 3px' }}>Pagos pendientes</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px', maxWidth: 640 }}>
            Deudas agregadas a mano: obligaciones de <strong>años anteriores</strong> o impuestos que no se cargaron al sistema. No dependen del generador de vencimientos.
          </p>
        </div>
        <button className="dbtn primary" onClick={() => { setAbierto((v) => !v); setError(null); }} style={{ fontSize: 13 }}>
          {abierto ? 'Cerrar' : '+ Agregar pago pendiente'}
        </button>
      </div>

      {abierto && (
        <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
              Cliente *
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={inp}>
                <option value="">Selecciona…</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
              Obligación *
              <input value={obligacion} onChange={(e) => setObligacion(e.target.value)} placeholder="IVA, Renta, ICA…" style={inp} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
              Año *
              <input type="number" min={2000} max={2100} value={anio} onChange={(e) => setAnio(e.target.value)} style={inp} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
              Período
              <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="2024-06, bimestre 3, anual…" style={inp} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
              Vence *
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
              Valor a pagar
              <input type="number" min={0} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" style={{ ...inp, textAlign: 'right' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)', gridColumn: '1 / -1' }}>
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

      {pendientes.length === 0 ? (
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
                <tr><th>Obligación</th><th>Cliente</th><th style={{ whiteSpace: 'nowrap' }}>Año / período</th><th style={{ whiteSpace: 'nowrap' }}>Vence</th><th>Valor y estado de pago</th><th></th></tr>
              </thead>
              <tbody>
                {pendientes.map((p) => {
                  const vencido = new Date(p.fechaVencimiento) < new Date() && p.estado !== 'presentado_pagado' && p.estado !== 'presentado_cero';
                  const meta = VENC_PAGO_META[p.estado] ?? VENC_PAGO_META.pendiente;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        {p.obligacion}
                        {p.notas ? <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{p.notas}</span> : null}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{p.empresa ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{p.anio}{p.periodo ? ` · ${p.periodo}` : ''}</td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: vencido ? 800 : 500, color: vencido ? '#d64b3f' : 'var(--muted)' }} title={meta.label}>{fmtFecha(p.fechaVencimiento)}</td>
                      <td><VencimientoPagoEditor id={p.id} valorPago={p.valorPago} estado={p.estado} /></td>
                      <td>
                        <button
                          className="dbtn" onClick={() => eliminar(p.id)} disabled={borrando === p.id}
                          title="Eliminar pago pendiente"
                          style={{ fontSize: 12, color: '#cf4436', opacity: borrando === p.id ? 0.5 : 1 }}
                        >
                          {borrando === p.id ? '…' : 'Eliminar'}
                        </button>
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
