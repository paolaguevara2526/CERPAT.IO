// apps/web/app/hallazgos/csv.ts — utilidades CSV mínimas (parse/build) para
// importar/exportar el plan de hallazgos.

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

// Detecta el separador de la primera línea entre coma, punto y coma o tab.
export function detectarDelimitador(text: string): string {
  const linea = text.replace(/^﻿/, '').split(/\r?\n/)[0] ?? '';
  const cont = (d: string) => linea.split(d).length - 1;
  const opciones: [string, number][] = [[',', cont(',')], [';', cont(';')], ['\t', cont('\t')]];
  opciones.sort((a, b) => b[1] - a[1]);
  return opciones[0][1] > 0 ? opciones[0][0] : ',';
}

// Parser CSV que respeta comillas y saltos de línea internos. El separador se
// detecta automáticamente (coma/punto y coma/tab) si no se indica.
export function parseCSV(text: string, delim?: string): string[][] {
  const t = text.replace(/^﻿/, ''); // quita BOM
  const sep = delim ?? detectarDelimitador(t);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignora; el \n cierra la fila */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export function descargar(nombre: string, contenido: string) {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Normaliza valores de enum desde texto libre del CSV.
export function normRiesgo(v: string): string {
  const s = v.trim().toLowerCase();
  return ['alto', 'medio', 'bajo'].includes(s) ? s : 'medio';
}
export function normPrioridad(v: string): string {
  const s = v.trim().toLowerCase();
  return ['alta', 'media', 'baja'].includes(s) ? s : 'media';
}
export function normEstado(v: string): string {
  const s = v.trim().toLowerCase();
  if (s.startsWith('resuel')) return 'resuelto';
  if (s.includes('gesti') || s.includes('curso') || s.includes('proceso')) return 'en_gestion';
  return 'pendiente';
}
// Fecha a YYYY-MM-DD (acepta ISO y DD/MM/YYYY).
export function normFecha(v: string): string {
  const s = v.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
