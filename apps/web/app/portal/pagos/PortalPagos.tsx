'use client';
// Pagos del cliente (solo lectura): obligaciones por pagar de su empresa/grupo,
// con límite de pago, interés de mora y sanción calculados a hoy. Aislado en el
// backend (GET /vencimientos/portal-pagos).

import { useEffect, useMemo, useState } from 'react';

type Pago = {
  id: string; obligacion: string; periodo: string | null; anio?: number; fechaVencimiento: string; estado: string;
  valorPago: number | null; fechaLimitePago: string | null; consecuencia: string;
  diasMora: number; interesMora: number; sancion: number; empresa: string | null; municipio: string | null; notas?: string | null;
};

const ANIO = 2026;
const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(n || 0));
const EST: Record<string, { label: string; color: string }> = {
  presentado_sin_pago: { label: 'Por pagar', color: '#c67c00' },
  presentado_pagado: { label: 'Pagado', color: '#22a670' },
  pendiente: { label: 'Pendiente', color: '#5b6a82' },
  no_presentado: { label: 'No presentado', color: '#cf4436' },
  presentado_cero: { label: 'Presentado en $0', color: '#14a8a0' },
  no_obligado: { label: 'No obligado', color: '#9aa3b2' },
};
function fFecha(iso: string | null) { if (!iso) return '—'; try { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } }
const totalPagar = (p: Pago) => (p.estado === 'presentado_pagado' ? 0 : (p.valorPago ?? 0) + (p.interesMora ?? 0) + (p.sancion ?? 0));

export default function PortalPagos() {
  const [items, setItems] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/vencimientos/portal-pagos?anio=${ANIO}`, { cache: 'no-store' });
        const d = await r.json();
        if (r.ok) setItems([...(d.vencimientos ?? []), ...(d.pendientes ?? [])]);
        else setError(d.error || 'No se pudieron cargar los pagos.');
      } catch { setError('Error de red.'); }
      setCargando(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const porPagar = items.filter((p) => p.estado !== 'presentado_pagado' && p.estado !== 'no_obligado');
    const valor = porPagar.reduce((a, p) => a + totalPagar(p), 0);
    const enMora = porPagar.filter((p) => (p.diasMora ?? 0) > 0);
    const mora = porPagar.reduce((a, p) => a + (p.interesMora ?? 0) + (p.sancion ?? 0), 0);
    return { count: porPagar.length, valor, enMora: enMora.length, mora };
  }, [items]);

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Pagos</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>Tus obligaciones por pagar, con la fecha límite, el interés de mora y la sanción calculados a hoy. Solo consulta.</p>

      {error && <div className="panel" style={{ padding: '12px 14px', color: '#b42318', fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        <div className="panel" style={{ padding: '13px 15px' }}><div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Por pagar</div><div style={{ fontSize: 24, fontWeight: 800 }}>{kpis.count}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>obligaciones</div></div>
        <div className="panel" style={{ padding: '13px 15px' }}><div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Valor a pagar</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>{cop(kpis.valor)}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>incluye mora y sanción</div></div>
        <div className="panel" style={{ padding: '13px 15px' }}><div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>En mora</div><div style={{ fontSize: 24, fontWeight: 800, color: kpis.enMora ? '#cf4436' : undefined }}>{kpis.enMora}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{cop(kpis.mora)} en intereses/sanción</div></div>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="dt" style={{ minWidth: 880 }}>
          <thead><tr>
            <th>Obligación</th><th>Período</th><th>Vence</th><th>Límite de pago</th>
            <th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Mora</th><th style={{ textAlign: 'right' }}>Sanción</th><th style={{ textAlign: 'right' }}>Total a pagar</th><th>Estado</th>
          </tr></thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No tienes obligaciones de pago registradas. 🎉</td></tr>
            ) : items.map((p) => {
              const em = EST[p.estado] ?? { label: p.estado, color: '#5b6a82' };
              const mora = (p.diasMora ?? 0) > 0;
              return (
                <tr key={p.id}>
                  <td>{p.obligacion}{p.empresa && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{p.empresa}</div>}{p.municipio && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{p.municipio}</div>}</td>
                  <td style={{ color: 'var(--muted)' }}>{p.periodo ?? '—'}{p.anio ? ` ${p.anio}` : ''}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fFecha(p.fechaVencimiento)}</td>
                  <td style={{ whiteSpace: 'nowrap', color: mora ? '#cf4436' : 'var(--muted)', fontWeight: mora ? 800 : 500 }}>{fFecha(p.fechaLimitePago)}{mora ? <div style={{ fontSize: 10 }}>{p.diasMora} días</div> : null}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{p.valorPago != null ? cop(p.valorPago) : '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: p.interesMora ? '#cf4436' : 'var(--muted)' }}>{p.interesMora ? cop(p.interesMora) : '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: p.sancion ? '#cf4436' : 'var(--muted)' }}>{p.sancion ? cop(p.sancion) : '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 800 }}>{p.estado === 'presentado_pagado' ? '—' : cop(totalPagar(p))}</td>
                  <td><span style={{ fontSize: 11, fontWeight: 800, color: em.color, background: `${em.color}18`, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>{em.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 2px 0' }}>La mora y la sanción se calculan a la fecha de hoy con las tasas DIAN. Para el pago, coordina con tu asesor CERPAT.</p>
    </>
  );
}
