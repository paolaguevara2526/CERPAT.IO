'use client';
// Acciones de la vista de Pagos: exportar a Excel (.xls con diseño) e imprimir
// por cliente los impuestos pendientes de pago. Trabaja sobre las filas ya
// filtradas que le pasa la página (respeta el filtro de cliente/estado).

type Fila = {
  id: string; obligacion: string; empresa: string | null; municipio: string | null; periodo: string | null;
  anio: number | null; fechaVencimiento: string; estado: string; valorPago: number | null;
  fechaLimitePago: string | null; consecuencia: string; diasMora: number; interesMora: number; sancion: number;
  notas: string | null; manual: boolean;
};

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

  // ---------- Exportar a Excel (.xls con el mismo diseño del documento) ----------
  // Se genera como tabla HTML que Excel abre conservando colores, negritas y el
  // agrupado por cliente. Excel puede mostrar un aviso de "formato" al abrir.
  function exportar() {
    const pend = filas.filter((f) => !pagado(f.estado));
    if (pend.length === 0) { alert('No hay impuestos pendientes de pago para exportar con el filtro actual.'); return; }
    const porCliente = new Map<string, Fila[]>();
    for (const f of pend) {
      const k = f.empresa ?? 'Sin cliente';
      (porCliente.get(k) ?? porCliente.set(k, []).get(k)!).push(f);
    }
    const tdBase = 'border:0.5pt solid #dfe4ec;padding:3px 7px;font-family:Calibri,Arial;font-size:10pt;';
    const tdL = tdBase + 'text-align:left;', tdC = tdBase + 'text-align:center;', tdR = tdBase + 'text-align:right;';
    const th = 'background:#2E5090;color:#ffffff;font-weight:bold;border:0.5pt solid #24406f;padding:5px 7px;text-align:center;font-family:Calibri,Arial;font-size:9pt;';
    const cliRow = 'background:#eef2f8;color:#16233b;font-weight:bold;border:0.5pt solid #dfe4ec;padding:6px 7px;font-family:Calibri,Arial;font-size:10.5pt;';
    const ftBase = 'border-top:1.5pt solid #c7d0de;font-weight:bold;padding:4px 7px;font-family:Calibri,Arial;font-size:10pt;';
    const rojo = ';color:#b3261e;font-weight:bold', verde = ';color:#16794c';
    const dinero = (v: number | null) => (v != null ? '$' + cop(v) : '—');

    const encabezado = `<tr>
      <th style="${th}text-align:left">Obligación</th><th style="${th}">Vence</th><th style="${th}">Límite de pago</th>
      <th style="${th}">Valor</th><th style="${th}">Interés</th><th style="${th}">Sanción</th><th style="${th}">Total</th><th style="${th}">Vencido</th></tr>`;

    const bloques = [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([nombre, fs]) => {
      const totCap = fs.reduce((s, f) => s + (f.valorPago ?? 0), 0);
      const totInt = fs.reduce((s, f) => s + (f.interesMora ?? 0), 0);
      const totSan = fs.reduce((s, f) => s + (f.sancion ?? 0), 0);
      const filasHtml = fs.map((f) => {
        const venc = vencida(f.fechaVencimiento);
        const tieneLimite = f.fechaLimitePago && f.consecuencia !== 'intereses';
        const limVenc = tieneLimite && vencida(f.fechaLimitePago);
        return `<tr>
          <td style="${tdL}">${esc(f.obligacion)}${f.periodo ? ` · ${esc(f.periodo)}` : ''}${f.manual && f.anio ? ` · ${f.anio}` : ''}${f.municipio ? ` — ${esc(f.municipio)}` : ''}</td>
          <td style="${tdC}">${fechaLarga(f.fechaVencimiento)}</td>
          <td style="${tdC}${limVenc ? rojo : ''}">${tieneLimite ? fechaLarga(f.fechaLimitePago!) : '—'}</td>
          <td style="${tdR}">${dinero(f.valorPago)}</td>
          <td style="${tdR}">${f.interesMora ? '$' + cop(f.interesMora) : '—'}</td>
          <td style="${tdR}">${f.sancion ? '$' + cop(f.sancion) : '—'}</td>
          <td style="${tdR}font-weight:bold">$${cop(totalFila(f))}</td>
          <td style="${tdC}${venc ? rojo : verde}">${venc ? 'SÍ' : 'NO'}</td>
        </tr>`;
      }).join('');
      const totales = `<tr>
        <td colspan="3" style="${ftBase}text-align:right">Totales</td>
        <td style="${ftBase}text-align:right">$${cop(totCap)}</td>
        <td style="${ftBase}text-align:right">$${cop(totInt)}</td>
        <td style="${ftBase}text-align:right">$${cop(totSan)}</td>
        <td style="${ftBase}text-align:right;color:#2E5090">$${cop(totCap + totInt + totSan)}</td>
        <td style="${ftBase}"></td></tr>`;
      return `<tr><td colspan="8" style="${cliRow}">Cliente: ${esc(nombre)}</td></tr>${encabezado}${filasHtml}${totales}<tr><td colspan="8" style="border:none;padding:3px"></td></tr>`;
    }).join('');

    const titulo = `<tr><td colspan="8" style="font-family:Calibri,Arial;font-size:15pt;font-weight:bold;color:#16233b;padding:2px 7px">Impuestos pendientes de pago</td></tr>
      <tr><td colspan="8" style="font-family:Calibri,Arial;font-size:9pt;color:#667;padding:0 7px 6px">CERPAT · Planeador contable — Generado el ${hoy}</td></tr>`;

    const html = `﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Pagos</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head><body><table style="border-collapse:collapse">${titulo}${bloques}</table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (cliente || 'todos').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = url; a.download = `pagos-${slug}-${new Date().toISOString().slice(0, 10)}.xls`;
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
          <td class="c${limVenc ? ' venc' : ''}">${tieneLimite ? fechaLarga(f.fechaLimitePago!) : '—'}</td>
          <td class="r">${f.valorPago != null ? '$' + cop(f.valorPago) : '—'}</td>
          <td class="r">${f.interesMora ? '$' + cop(f.interesMora) : '—'}</td>
          <td class="r">${f.sancion ? '$' + cop(f.sancion) : '—'}</td>
          <td class="r b">$${cop(totalFila(f))}</td>
          <td class="c">${venc ? '<span class="venc">SÍ</span>' : '<span class="ok">NO</span>'}</td>
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
            <thead><tr><th>Obligación</th><th class="c">Vence</th><th class="c">Límite de pago</th><th class="r">Valor</th><th class="r">Interés</th><th class="r">Sanción</th><th class="r">Total</th><th class="c">Vencido</th></tr></thead>
            <tbody>${filasHtml}</tbody>
            <tfoot><tr><td colspan="3" class="r b">Totales</td><td class="r b">$${cop(totCap)}</td><td class="r b">$${cop(totInt)}</td><td class="r b">$${cop(totSan)}</td><td class="r b tot">$${cop(totTot)}</td><td></td></tr></tfoot>
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
