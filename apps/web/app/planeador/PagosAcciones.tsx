'use client';
// Acciones de la vista de Pagos: exportar a Excel (CSV) e imprimir por cliente
// los impuestos pendientes de pago. Trabaja sobre las filas ya filtradas que le
// pasa la página (respeta el filtro de cliente/estado aplicado).

type Fila = {
  id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null;
  anio: number | null; fechaVencimiento: string; estado: string; valorPago: number | null;
  fechaLimitePago: string | null; consecuencia: string; diasMora: number; interesMora: number; sancion: number;
  notas: string | null; manual: boolean;
};

const ESTADO_LBL: Record<string, string> = {
  pendiente: 'Pendiente', presentado_sin_pago: 'Presentado (sin pago)', presentado_pagado: 'Presentado y pagado',
  presentado_cero: 'Presentado en $0', no_presentado: 'No presentado', no_obligado: 'No obligado',
};
const CONSEC_LBL: Record<string, string> = { ineficaz: 'Queda INEFICAZ', exclusion_rst: 'Exclusión del RST', intereses: 'Solo intereses' };
const pagado = (e: string) => e === 'presentado_pagado';
const cop = (v: number) => (v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
function fechaLarga(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return ''; }
}
const totalFila = (f: Fila) => (f.valorPago ?? 0) + (f.interesMora ?? 0) + (f.sancion ?? 0);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// ¿La fecha (solo día) ya pasó? Para marcar vencido y el límite de pago en rojo.
function vencida(iso: string | null): boolean {
  if (!iso) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(iso); f.setHours(0, 0, 0, 0);
  return f.getTime() < hoy.getTime();
}

export default function PagosAcciones({ filas, cliente }: { filas: Fila[]; cliente: string }) {
  const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // ---------- Exportar a Excel (CSV con separador ';' y BOM, abre en Excel) ----------
  function exportar() {
    const cols = ['Cliente', 'Obligación', 'Período', 'Año', 'Municipio', 'Vence', 'Estado', 'Valor', 'Interés de mora', 'Días de mora', 'Sanción', 'Total a pagar', 'Límite de pago', 'Consecuencia', 'Notas'];
    const celda = (v: string | number | null) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const filasCsv = filas.map((f) => [
      f.empresa ?? '', f.obligacion, f.periodo ?? '', f.anio ?? '', f.municipio ?? '',
      fechaLarga(f.fechaVencimiento), ESTADO_LBL[f.estado] ?? f.estado,
      f.valorPago ?? '', f.interesMora || '', f.diasMora || '', f.sancion || '',
      pagado(f.estado) ? '' : Math.round(totalFila(f)),
      f.fechaLimitePago ? fechaLarga(f.fechaLimitePago) : '', CONSEC_LBL[f.consecuencia] ?? '', f.notas ?? '',
    ].map(celda).join(';'));
    const csv = '﻿' + [cols.join(';'), ...filasCsv].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (cliente || 'todos').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = url; a.download = `pagos-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Imprimir por cliente (solo lo pendiente de pago) ----------
  function imprimir() {
    const pend = filas.filter((f) => !pagado(f.estado));
    if (pend.length === 0) { alert('No hay impuestos pendientes de pago para imprimir con el filtro actual.'); return; }
    // Agrupar por cliente (una hoja por cliente).
    const porCliente = new Map<string, Fila[]>();
    for (const f of pend) {
      const k = f.empresa ?? 'Sin cliente';
      (porCliente.get(k) ?? porCliente.set(k, []).get(k)!).push(f);
    }
    const secciones = [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([nombre, fs], idx) => {
      const totCap = fs.reduce((s, f) => s + (f.valorPago ?? 0), 0);
      const totInt = fs.reduce((s, f) => s + (f.interesMora ?? 0), 0);
      const totSan = fs.reduce((s, f) => s + (f.sancion ?? 0), 0);
      const totTot = totCap + totInt + totSan;
      const filasHtml = fs.map((f) => {
        const venc = vencida(f.fechaVencimiento);
        const tieneLimite = f.fechaLimitePago && f.consecuencia !== 'intereses';
        const limVenc = tieneLimite && vencida(f.fechaLimitePago);
        return `
        <tr>
          <td>${esc(f.obligacion)}${f.periodo ? ` · ${esc(f.periodo)}` : ''}${f.manual && f.anio ? ` · ${f.anio}` : ''}${f.municipio ? `<div class="mun">${esc(f.municipio)}</div>` : ''}</td>
          <td class="c">${fechaLarga(f.fechaVencimiento)}</td>
          <td class="c">${venc ? '<span class="venc">Vencido</span>' : '<span class="ok">Al día</span>'}</td>
          <td class="c${limVenc ? ' venc' : ''}">${tieneLimite ? fechaLarga(f.fechaLimitePago!) : '—'}</td>
          <td class="r">${f.valorPago != null ? '$' + cop(f.valorPago) : '—'}</td>
          <td class="r">${f.interesMora ? '$' + cop(f.interesMora) : '—'}</td>
          <td class="r">${f.sancion ? '$' + cop(f.sancion) : '—'}</td>
          <td class="r b">$${cop(totalFila(f))}</td>
        </tr>`;
      }).join('');
      return `
        <section class="cliente" ${idx > 0 ? 'style="page-break-before:always"' : ''}>
          <div class="head">
            <div><div class="firma">CERPAT · Planeador contable</div><h1>Impuestos pendientes de pago</h1></div>
            <div class="fecha">Generado el ${hoy}</div>
          </div>
          <div class="cli"><span>Cliente:</span> <b>${esc(nombre)}</b></div>
          <table>
            <thead><tr><th>Obligación</th><th class="c">Vence</th><th class="c">Estado</th><th class="c">Límite de pago</th><th class="r">Valor</th><th class="r">Interés</th><th class="r">Sanción</th><th class="r">Total</th></tr></thead>
            <tbody>${filasHtml}</tbody>
            <tfoot><tr><td colspan="4" class="r b">Totales</td><td class="r b">$${cop(totCap)}</td><td class="r b">$${cop(totInt)}</td><td class="r b">$${cop(totSan)}</td><td class="r b tot">$${cop(totTot)}</td></tr></tfoot>
          </table>
          <p class="nota">Valores estimados a la fecha de generación. El interés de mora se calcula según la tasa DIAN y aumenta cada día; solicite el valor actualizado el día del pago.</p>
        </section>`;
    }).join('');

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Impuestos pendientes de pago</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #16233b; margin: 28px; font-size: 12px; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2E5090; padding-bottom: 8px; }
        .firma { font-size: 11px; color: #2E5090; font-weight: 700; letter-spacing: .3px; }
        h1 { font-size: 17px; margin: 2px 0 0; }
        .fecha { font-size: 11px; color: #667; }
        .cli { margin: 12px 0 8px; font-size: 13px; } .cli span { color: #667; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        th, td { border-bottom: 1px solid #dfe4ec; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f2f5fa; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: #45536b; }
        .c { text-align: center; white-space: nowrap; } .r { text-align: right; white-space: nowrap; } .b { font-weight: 700; }
        .venc { color: #b3261e; font-weight: 700; } .ok { color: #16794c; font-weight: 600; }
        .mun { font-size: 10px; color: #78839a; } .tot { color: #2E5090; }
        tfoot td { border-top: 2px solid #c7d0de; border-bottom: none; }
        .nota { font-size: 10px; color: #78839a; margin-top: 10px; }
        @media print { body { margin: 12mm; } }
      </style></head><body>${secciones}
      <script>window.onload=function(){window.print();}</script></body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permite las ventanas emergentes para imprimir.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  const btn: React.CSSProperties = { fontSize: 13, textDecoration: 'none', cursor: 'pointer' };
  return (
    <div style={{ display: 'inline-flex', gap: 8 }}>
      <button type="button" onClick={imprimir} className="dbtn" style={btn} title="Imprime los impuestos pendientes de pago, una hoja por cliente (para enviar al cliente)">🖨 Imprimir por cliente</button>
      <button type="button" onClick={exportar} className="dbtn" style={btn} title="Descarga el listado (según el filtro actual) en un archivo que abre en Excel">⬇ Exportar a Excel</button>
    </div>
  );
}
