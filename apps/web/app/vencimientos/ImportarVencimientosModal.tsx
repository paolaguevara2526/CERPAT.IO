'use client';
// Importar vencimientos desde un Excel/CSV (solo Administrador). Lee el archivo
// en el navegador (SheetJS), lo previsualiza contra la base (empareja cliente por
// NIT y municipio) y, si todo está bien, crea los vencimientos. Idempotente: no
// duplica. Pensado para los vencimientos puntuales que llegan por lista (p. ej.
// exógena municipal / medios magnéticos).

import { useState } from 'react';

type Fila = { nit: string; empresa: string; municipio: string; departamento: string; fecha: string };
type Previo = { crear: number; duplicados: number; problemas: string[]; preview: string[]; totalFilas: number };

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };

const AHORA = new Date().getFullYear();
// Busca el índice de una columna por su encabezado (varios posibles nombres).
function idxCol(headers: string[], re: RegExp): number { return headers.findIndex((h) => re.test(h)); }
const fmtFecha = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ImportarVencimientosModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [obligacion, setObligacion] = useState('Exógena municipal (medios magnéticos)');
  const [anio, setAnio] = useState(AHORA);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [previo, setPrevio] = useState<Previo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);

  async function leerArchivo(file: File) {
    setError(null); setPrevio(null); setHecho(null); setFilas([]); setNombreArchivo(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
      if (!aoa.length) { setError('El archivo está vacío.'); return; }
      // Fila de encabezados = la primera que mencione NIT/empresa/municipio/fecha.
      const hIdx = aoa.findIndex((r) => r.some((c) => /nit|empresa|cliente|municipio|fecha/i.test(String(c ?? ''))));
      if (hIdx < 0) { setError('No encontré encabezados (NIT, Municipio, Fecha…).'); return; }
      const headers = aoa[hIdx].map((c) => String(c ?? '').trim());
      const iNit = idxCol(headers, /nit/i);
      const iEmp = idxCol(headers, /empresa|cliente|raz[oó]n/i);
      const iMun = idxCol(headers, /municipio/i);
      const iDep = idxCol(headers, /departamento|depto/i);
      // Fecha: prefiere una columna cuyo nombre incluya "venc"; si no, la primera "fecha".
      let iFec = headers.findIndex((h) => /fecha/i.test(h) && /venc|magnet|medios/i.test(h));
      if (iFec < 0) iFec = idxCol(headers, /fecha/i);
      if (iNit < 0 && iEmp < 0) { setError('Falta la columna de cliente (NIT o Empresa).'); return; }
      if (iFec < 0) { setError('Falta la columna de fecha de vencimiento.'); return; }

      const out: Fila[] = [];
      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r];
        const nit = iNit >= 0 ? String(row[iNit] ?? '').trim() : '';
        const empresa = iEmp >= 0 ? String(row[iEmp] ?? '').trim() : '';
        if (!nit && !empresa) continue;
        const celdaF = row[iFec];
        let fecha = '';
        if (celdaF instanceof Date && !isNaN(celdaF.getTime())) fecha = fmtFecha(celdaF);
        else if (typeof celdaF === 'string' && /^\d{4}-\d{2}-\d{2}/.test(celdaF.trim())) fecha = celdaF.trim().slice(0, 10);
        else if (celdaF != null && celdaF !== '') { const d = new Date(celdaF); if (!isNaN(d.getTime())) fecha = fmtFecha(d); }
        out.push({ nit, empresa, municipio: iMun >= 0 ? String(row[iMun] ?? '').trim() : '', departamento: iDep >= 0 ? String(row[iDep] ?? '').trim() : '', fecha });
      }
      if (!out.length) { setError('No encontré filas de datos debajo de los encabezados.'); return; }
      setFilas(out);
    } catch (e) { setError('No pude leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?'); }
  }

  async function enviar(dryRun: boolean) {
    if (!obligacion.trim()) { setError('Indica la obligación.'); return; }
    if (!filas.length) { setError('Primero elige un archivo con filas.'); return; }
    setTrabajando(true); setError(null);
    try {
      const r = await fetch('/api/vencimientos/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obligacion: obligacion.trim(), anio, dryRun, filas }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo procesar.'); setTrabajando(false); return; }
      if (dryRun) setPrevio(d);
      else { setHecho(`Se cargaron ${d.creados} vencimientos${d.duplicados ? ` (${d.duplicados} ya existían)` : ''}.`); setPrevio(null); onImported(); }
    } catch { setError('Error de red.'); }
    setTrabajando(false);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 600, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="win-bar">
          <span className="win-title">Importar vencimientos desde Excel</span>
          <div className="win-ctl"><button className="close" onClick={onClose} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
        </div>
        <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
          {hecho && <div style={{ background: '#E4F5EC', color: '#1c8a5e', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontWeight: 700 }}>✓ {hecho}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
            <label><span style={lbl}>Obligación (igual para todas las filas)</span><input style={input} value={obligacion} onChange={(e) => setObligacion(e.target.value)} /></label>
            <label><span style={lbl}>Año</span><input type="number" style={input} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></label>
          </div>

          <label><span style={lbl}>Archivo (.xlsx o .csv)</span>
            <input type="file" accept=".xlsx,.xls,.csv" style={{ ...input, padding: 7 }} onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); }} />
          </label>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0 }}>
            El archivo debe traer columnas de <b>NIT</b> (o Empresa), <b>Municipio</b> y <b>Departamento</b> (si aplica) y <b>Fecha de vencimiento</b>. Empareja el cliente por NIT y no duplica lo ya cargado.
          </p>
          {nombreArchivo && <div style={{ fontSize: 12.5 }}>📄 <b>{nombreArchivo}</b> — {filas.length} fila(s) leída(s).</div>}

          {previo && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                <b style={{ color: '#1c8a5e' }}>{previo.crear}</b> por crear ·{' '}
                <b style={{ color: '#8a6d00' }}>{previo.duplicados}</b> ya existían ·{' '}
                <b style={{ color: previo.problemas.length ? '#cf4436' : 'var(--muted)' }}>{previo.problemas.length}</b> con problema
              </div>
              {previo.problemas.length > 0 && (
                <div style={{ maxHeight: 120, overflow: 'auto', background: '#FBE4E1', borderRadius: 6, padding: '6px 9px', fontSize: 11.5, color: '#B42318' }}>
                  {previo.problemas.map((p, i) => <div key={i}>• {p}</div>)}
                </div>
              )}
              {previo.crear > 0 && (
                <div style={{ maxHeight: 130, overflow: 'auto', fontSize: 11.5, color: 'var(--muted)' }}>
                  {previo.preview.map((p, i) => <div key={i}>+ {p}</div>)}
                  {previo.crear > previo.preview.length && <div>… y {previo.crear - previo.preview.length} más</div>}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="dbtn" onClick={onClose} style={{ fontSize: 13 }}>Cerrar</button>
            <button className="dbtn" onClick={() => enviar(true)} disabled={trabajando || !filas.length} style={{ fontSize: 13 }}>{trabajando ? '…' : 'Previsualizar'}</button>
            <button className="dbtn primary" onClick={() => enviar(false)} disabled={trabajando || !previo || previo.crear === 0} style={{ fontSize: 13 }} title={!previo ? 'Primero previsualiza' : ''}>
              {trabajando ? 'Cargando…' : previo ? `Cargar ${previo.crear}` : 'Cargar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
