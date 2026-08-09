'use client';
// Abonos (pagos parciales) de una obligación. Abre un modal con el saldo, la lista
// de abonos y —para el Administrador— el formulario para registrar uno nuevo y
// eliminar. El saldo = valor − abonos; el interés de mora corre sobre el saldo.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Abono = { id: string; monto: number; fecha: string; notas: string | null };
type Data = { valorPago: number | null; abonado: number; saldo: number | null; abonos: Abono[] };

const fmtCOP = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
function fmtFecha(iso: string) { try { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } }
const inp: React.CSSProperties = { padding: '7px 9px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };

export default function AbonosBoton({ id, editable }: { id: string; editable: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true); setError(null);
    try {
      const d = await fetch(`/api/vencimientos/${id}/abonos`, { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error); else setData(d);
    } catch { setError('Error de red.'); }
    setCargando(false);
  }
  function abrir() { setAbierto(true); cargar(); }
  function cerrar() { setAbierto(false); setMonto(''); setFecha(''); setNotas(''); setError(null); }

  async function agregar() {
    if (!monto || Number(monto) <= 0) { setError('Indica un abono mayor que 0.'); return; }
    setGuardando(true); setError(null);
    try {
      const r = await fetch(`/api/vencimientos/${id}/abonos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: Number(monto), fecha: fecha || undefined, notas: notas || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo registrar el abono.'); setGuardando(false); return; }
      setMonto(''); setFecha(''); setNotas('');
      await cargar(); router.refresh();
    } catch { setError('Error de red.'); }
    setGuardando(false);
  }

  async function eliminar(abonoId: string) {
    setError(null);
    try {
      const r = await fetch(`/api/vencimientos/abonos/${abonoId}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); return; }
      await cargar(); router.refresh();
    } catch { setError('Error de red.'); }
  }

  return (
    <>
      <button className="dbtn" onClick={abrir} style={{ fontSize: 11.5, padding: '3px 8px' }} title="Ver y registrar abonos">＋ Abonos</button>

      {abierto && (
        <div onClick={() => !guardando && cerrar()} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflow: 'auto' }}>
            <div className="win-bar">
              <span className="win-title">Abonos a la obligación</span>
              <div className="win-ctl"><button className="close" onClick={cerrar} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
            </div>
            <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}

              {cargando ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
              ) : data ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    <div className="tile"><div className="k">Valor</div><div className="v" style={{ fontSize: 18 }}>${fmtCOP(data.valorPago ?? 0)}</div></div>
                    <div className="tile"><div className="k">Abonado</div><div className="v" style={{ fontSize: 18, color: 'var(--exito-fuerte)' }}>${fmtCOP(data.abonado)}</div></div>
                    <div className="tile" style={{ borderColor: 'var(--navy)' }}><div className="k">Saldo</div><div className="v" style={{ fontSize: 18, color: 'var(--navy)' }}>${fmtCOP(data.saldo ?? 0)}</div></div>
                  </div>

                  {data.abonos.length > 0 ? (
                    <div className="panel" style={{ padding: 0 }}>
                      <table className="dt"><tbody>
                        {data.abonos.map((a) => (
                          <tr key={a.id}>
                            <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12.5 }}>{fmtFecha(a.fecha)}</td>
                            <td style={{ fontWeight: 700 }}>${fmtCOP(a.monto)}</td>
                            <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{a.notas ?? ''}</td>
                            {editable && <td style={{ textAlign: 'right' }}><button className="dbtn" onClick={() => eliminar(a.id)} style={{ fontSize: 11, color: 'var(--peligro)', padding: '2px 7px' }}>Eliminar</button></td>}
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aún no hay abonos registrados.</div>
                  )}

                  {editable ? (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Registrar abono</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Monto
                          <input type="number" min={0} inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" style={{ ...inp, width: '100%', textAlign: 'right' }} />
                        </label>
                        <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Fecha
                          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...inp, width: '100%' }} />
                        </label>
                      </div>
                      <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Nota (opcional)" style={{ ...inp, width: '100%' }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button className="dbtn" onClick={cerrar} disabled={guardando} style={{ fontSize: 13 }}>Cerrar</button>
                        <button className="dbtn primary" onClick={agregar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : 'Registrar abono'}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="dbtn" onClick={cerrar} style={{ fontSize: 13 }}>Cerrar</button></div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
