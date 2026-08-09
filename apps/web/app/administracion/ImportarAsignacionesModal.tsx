'use client';
// Importar asignaciones (asesor/auxiliar/talla por Cliente × Área) desde el Excel
// "Planes por cliente" que se descarga en este mismo panel. Lee el archivo en el
// navegador (SheetJS), previsualiza contra la base (empareja por nombre) y, si todo
// está bien, actualiza las asignaciones. Idempotente (upsert por área).

import { useState } from 'react';

type Fila = { cliente: string; area: string; asesor: string; auxiliar: string; talla: string; insumo: string };
type Previo = { actualizar: number; problemas: string[]; preview: string[]; totalFilas: number };

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export default function ImportarAsignacionesModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
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
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
      if (!aoa.length) { setError('El archivo está vacío.'); return; }
      const hIdx = aoa.findIndex((r) => r.some((c) => /cliente|empresa/i.test(String(c ?? ''))) && r.some((c) => norm(c) === 'area'));
      if (hIdx < 0) { setError('No encontré los encabezados (Cliente, Área, Asesor, Auxiliar…).'); return; }
      const H = aoa[hIdx].map((c) => norm(c));
      const col = (pred: (h: string) => boolean) => H.findIndex(pred);
      const iCli = col((h) => h === 'cliente' || h.includes('cliente') || h === 'empresa');
      const iArea = col((h) => h === 'area');
      const iAse = col((h) => h === 'asesor');
      const iAux = col((h) => h === 'auxiliar');
      const iTal = col((h) => h === 'talla');
      const iIns = col((h) => h.includes('insumo'));
      if (iCli < 0 || iArea < 0) { setError('Faltan columnas obligatorias: Cliente y Área.'); return; }
      if (iAse < 0 && iAux < 0) { setError('No encontré columnas de Asesor ni Auxiliar.'); return; }

      const out: Fila[] = [];
      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r];
        const cliente = String(row[iCli] ?? '').trim();
        const area = String(row[iArea] ?? '').trim();
        if (!cliente || !area) continue;
        out.push({
          cliente, area,
          asesor: iAse >= 0 ? String(row[iAse] ?? '').trim() : '',
          auxiliar: iAux >= 0 ? String(row[iAux] ?? '').trim() : '',
          talla: iTal >= 0 ? String(row[iTal] ?? '').trim() : '',
          insumo: iIns >= 0 ? String(row[iIns] ?? '').trim() : '',
        });
      }
      if (!out.length) { setError('No encontré filas de datos debajo de los encabezados.'); return; }
      setFilas(out);
    } catch { setError('No pude leer el archivo. ¿Es un Excel (.xlsx) válido?'); }
  }

  async function enviar(dryRun: boolean) {
    if (!filas.length) { setError('Primero elige el archivo.'); return; }
    setTrabajando(true); setError(null);
    try {
      const r = await fetch('/api/admin/asignaciones/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, filas }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo procesar.'); setTrabajando(false); return; }
      if (dryRun) setPrevio(d);
      else { setHecho(`Se actualizaron ${d.actualizadas} asignación(es) por área${d.problemas?.length ? ` · ${d.problemas.length} con problema` : ''}.`); setPrevio(null); onImported(); }
    } catch { setError('Error de red.'); }
    setTrabajando(false);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 620, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="win-bar">
          <span className="win-title">Importar asignaciones desde Excel</span>
          <div className="win-ctl"><button className="close" onClick={onClose} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
        </div>
        <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '8px 11px', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
          {hecho && <div style={{ background: 'var(--exito-suave)', color: 'var(--green-edge)', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontWeight: 700 }}>✓ {hecho}</div>}

          <label><span style={lbl}>Archivo (.xlsx)</span>
            <input type="file" accept=".xlsx,.xls" style={{ ...input, padding: 7 }} onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); }} />
          </label>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0 }}>
            Usa el mismo Excel que descargas aquí (<b>Descargar Excel</b>): columnas <b>Cliente</b>, <b>Área</b>, <b>Asesor</b>, <b>Auxiliar</b>, <b>Talla</b> e <b>Insumo del cliente</b>. Empareja por nombre y actualiza la asignación de cada Cliente × Área (no duplica).
          </p>
          {nombreArchivo && <div style={{ fontSize: 12.5 }}>📄 <b>{nombreArchivo}</b> — {filas.length} fila(s) leída(s).</div>}

          {previo && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                <b style={{ color: 'var(--green-edge)' }}>{previo.actualizar}</b> asignación(es) por aplicar ·{' '}
                <b style={{ color: previo.problemas.length ? 'var(--peligro)' : 'var(--muted)' }}>{previo.problemas.length}</b> con problema{' '}
                <span style={{ color: 'var(--muted)' }}>(de {previo.totalFilas} Cliente×Área)</span>
              </div>
              {previo.problemas.length > 0 && (
                <div style={{ maxHeight: 130, overflow: 'auto', background: 'var(--peligro-suave)', borderRadius: 6, padding: '6px 9px', fontSize: 11.5, color: 'var(--peligro-fuerte)' }}>
                  {previo.problemas.map((p, i) => <div key={i}>• {p}</div>)}
                </div>
              )}
              {previo.preview.length > 0 && (
                <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 11.5, color: 'var(--muted)' }}>
                  {previo.preview.map((p, i) => <div key={i}>✓ {p}</div>)}
                  {previo.actualizar > previo.preview.length && <div>… y {previo.actualizar - previo.preview.length} más</div>}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="dbtn" onClick={onClose} style={{ fontSize: 13 }}>Cerrar</button>
            <button className="dbtn" onClick={() => enviar(true)} disabled={trabajando || !filas.length} style={{ fontSize: 13 }}>{trabajando ? '…' : 'Previsualizar'}</button>
            <button className="dbtn primary" onClick={() => enviar(false)} disabled={trabajando || !previo || previo.actualizar === 0} style={{ fontSize: 13 }} title={!previo ? 'Primero previsualiza' : ''}>
              {trabajando ? 'Aplicando…' : previo ? `Aplicar ${previo.actualizar}` : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
