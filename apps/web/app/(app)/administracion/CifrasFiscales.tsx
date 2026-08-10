'use client';
// Cifras fiscales por año, en bloque: descargar la plantilla, importarla llena y
// ver qué clientes siguen sin cifras.
//
// Sin esto son 90 fichas a mano, y las cifras ya viven en un Excel del equipo.
// La plantilla sale con los clientes y sus NIT puestos, así que lo único que hay
// que escribir son dos números por fila — y de paso no hay forma de equivocarse
// tecleando el nombre de un cliente.
//
// Importar cifras equivocadas cambia EN SILENCIO qué obligaciones le salen a un
// cliente (revisor fiscal, IVA bimestral, RST). Por eso siempre se previsualiza
// antes de escribir, igual que al regenerar vencimientos.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { descargarXlsx, hoyISO } from './exportar';
import TablaDatos, { type Columna } from '@/app/_components/TablaDatos';

type Fila = {
  empresaId: string; empresa: string; nit: string | null;
  activosBrutos: number | null; ingresosBrutos: number | null; fuente: string | null;
};
type Previo = { aplicar: number; problemas: string[]; preview: string[]; totalFilas: number };
type FilaLeida = { cliente: string; nit: string; activosBrutos: string; ingresosBrutos: string; fuente: string };

const ENCABEZADOS = ['Cliente', 'NIT', 'Activos brutos', 'Ingresos brutos', 'Fuente'];

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)' };
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cop = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-CO')}`);

export default function CifrasFiscales() {
  // Las normas comparan contra el año inmediatamente anterior, así que lo que
  // se carga casi siempre es el año pasado.
  const [anio, setAnio] = useState(new Date().getFullYear() - 1);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [editable, setEditable] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nombreArchivo, setNombreArchivo] = useState('');
  const [leidas, setLeidas] = useState<FilaLeida[]>([]);
  const [previo, setPrevio] = useState<Previo | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const d = await fetch(`/api/ficha/cifras?anio=${anio}`, { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error);
      else { setFilas(d.filas ?? []); setEditable(!!d.editable); setError(null); }
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, [anio]);
  useEffect(() => { cargar(); }, [cargar]);

  const conCifras = filas.filter((f) => f.activosBrutos != null || f.ingresosBrutos != null).length;

  async function descargarPlantilla() {
    const cuerpo = filas.map((f) => [
      f.empresa, f.nit ?? '',
      f.activosBrutos ?? '', f.ingresosBrutos ?? '', f.fuente ?? '',
    ]);
    try {
      await descargarXlsx(`cifras-${anio}-cerpat-${hoyISO()}.xlsx`, [{ nombre: `Cifras ${anio}`, filas: [ENCABEZADOS, ...cuerpo] }]);
    } catch { setError('No se pudo generar el Excel.'); }
  }

  async function leerArchivo(file: File) {
    setError(null); setPrevio(null); setHecho(null); setLeidas([]); setNombreArchivo(file.name);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
      if (!aoa.length) { setError('El archivo está vacío.'); return; }

      const hIdx = aoa.findIndex((r) => r.some((c) => /activo/i.test(String(c ?? ''))) && r.some((c) => /ingreso/i.test(String(c ?? ''))));
      if (hIdx < 0) { setError('No encontré los encabezados. La plantilla debe traer las columnas Activos brutos e Ingresos brutos.'); return; }
      const H = aoa[hIdx].map((c) => norm(c));
      const col = (pred: (h: string) => boolean) => H.findIndex(pred);
      const iCli = col((h) => h === 'cliente' || h.includes('cliente') || h === 'empresa' || h.includes('razon social'));
      const iNit = col((h) => h === 'nit' || h.includes('nit') || h.includes('documento') || h.includes('cedula'));
      const iAct = col((h) => h.includes('activo'));
      const iIng = col((h) => h.includes('ingreso'));
      const iFue = col((h) => h.includes('fuente'));
      if (iCli < 0 && iNit < 0) { setError('Falta la columna Cliente o NIT: sin una de las dos no se puede saber de quién son las cifras.'); return; }

      const out: FilaLeida[] = [];
      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r];
        const cel = (i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '');
        const fila = {
          cliente: cel(iCli), nit: cel(iNit),
          activosBrutos: cel(iAct), ingresosBrutos: cel(iIng), fuente: cel(iFue),
        };
        if (!fila.cliente && !fila.nit) continue;
        out.push(fila);
      }
      if (!out.length) { setError('No encontré filas de datos debajo de los encabezados.'); return; }
      setLeidas(out);
    } catch { setError('No pude leer el archivo. ¿Es un Excel (.xlsx) válido?'); }
  }

  async function enviar(dryRun: boolean) {
    if (!leidas.length) { setError('Primero elige el archivo.'); return; }
    setTrabajando(true); setError(null);
    try {
      const r = await fetch('/api/ficha/cifras/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, anio, filas: leidas }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo procesar.'); setTrabajando(false); return; }
      if (dryRun) setPrevio(d);
      else {
        setHecho(`Se guardaron las cifras ${d.anio} de ${d.aplicadas} cliente(s).`);
        setPrevio(null); setLeidas([]); setNombreArchivo(''); cargar();
      }
    } catch { setError('Error de red.'); }
    setTrabajando(false);
  }

  const columnas: Columna<Fila>[] = useMemo(() => [
    { clave: 'empresa', label: 'Cliente', valor: (f) => f.empresa, buscar: true, estiloCelda: { fontWeight: 600 },
      render: (f) => <a href={`/clientes/${f.empresaId}`} style={{ color: 'var(--navy)', textDecoration: 'none' }}>{f.empresa}</a> },
    { clave: 'nit', label: 'NIT', valor: (f) => f.nit ?? '—', buscar: true, estiloCelda: { color: 'var(--muted)', fontFamily: 'var(--mono)' } },
    { clave: 'activos', label: `Activos brutos ${anio}`, valor: (f) => cop(f.activosBrutos), orden: (f) => f.activosBrutos ?? -1,
      estilo: { textAlign: 'right' }, estiloCelda: { textAlign: 'right', fontFamily: 'var(--mono)' } },
    { clave: 'ingresos', label: `Ingresos brutos ${anio}`, valor: (f) => cop(f.ingresosBrutos), orden: (f) => f.ingresosBrutos ?? -1,
      estilo: { textAlign: 'right' }, estiloCelda: { textAlign: 'right', fontFamily: 'var(--mono)' } },
    { clave: 'estado', label: 'Estado', valor: (f) => (f.activosBrutos != null || f.ingresosBrutos != null ? 'Con cifras' : 'Sin cifras'),
      render: (f) => (f.activosBrutos != null || f.ingresosBrutos != null
        ? <span className="chip" style={{ color: 'var(--exito)', borderColor: 'var(--exito)' }}>Con cifras</span>
        : <span className="chip" style={{ color: 'var(--alerta-fuerte)', borderColor: 'var(--alerta-fuerte)' }}>Sin cifras</span>) },
    { clave: 'fuente', label: 'Fuente', valor: (f) => f.fuente ?? '—', estiloCelda: { color: 'var(--muted)' } },
  ], [anio]);

  const anios = [0, 1, 2, 3].map((i) => new Date().getFullYear() - i);

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Cifras fiscales por año</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px', maxWidth: 820, lineHeight: 1.6 }}>
        Activos e ingresos brutos de cada cliente. De aquí salen las seis obligaciones que se calculan solas
        (firma de contador, revisor fiscal, periodicidad del IVA, conciliación fiscal, RST y el art. 368-2).
        Las normas comparan contra el <strong>año inmediatamente anterior</strong>: para evaluar {anio + 1} se
        cargan las cifras de <strong>{anio}</strong>.
      </p>

      {error && <div className="panel" style={{ padding: '10px 14px', marginBottom: 14, color: 'var(--peligro-fuerte)', background: 'var(--peligro-suave)', borderColor: 'var(--peligro-borde)', fontWeight: 600 }}>{error}</div>}
      {hecho && <div className="panel" style={{ padding: '10px 14px', marginBottom: 14, color: 'var(--exito-fuerte)', background: 'var(--exito-suave)', fontWeight: 700 }}>✓ {hecho}</div>}

      <div className="panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 }}>Año de las cifras</span>
            <select value={anio} onChange={(e) => { setAnio(Number(e.target.value)); setPrevio(null); setLeidas([]); setNombreArchivo(''); setHecho(null); }} style={input}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <button className="dbtn" onClick={descargarPlantilla} disabled={cargando || filas.length === 0} style={{ fontSize: 13, height: 36 }}
            title="Sale con tus clientes y sus NIT ya puestos; solo hay que llenar las dos columnas de cifras">
            ⬇ Descargar plantilla
          </button>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {cargando ? 'Cargando…' : <><strong style={{ color: conCifras ? 'var(--exito)' : 'var(--alerta-fuerte)' }}>{conCifras}</strong> de {filas.length} clientes con cifras de {anio}</>}
          </span>
        </div>

        {editable && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 }}>Importar el archivo lleno</span>
                <input type="file" accept=".xlsx,.xls" style={{ ...input, padding: 6 }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); }} />
              </label>
              <button className="dbtn" onClick={() => enviar(true)} disabled={trabajando || !leidas.length} style={{ fontSize: 13, height: 36 }}>
                {trabajando ? '…' : 'Previsualizar'}
              </button>
              <button className="dbtn primary" onClick={() => enviar(false)} disabled={trabajando || !previo || previo.aplicar === 0} style={{ fontSize: 13, height: 36 }}
                title={!previo ? 'Primero previsualiza' : ''}>
                {trabajando ? 'Guardando…' : previo ? `Guardar ${previo.aplicar}` : 'Guardar'}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0', maxWidth: 760, lineHeight: 1.6 }}>
              Empareja por <strong>NIT</strong> y, si no lo encuentra, por nombre. Las filas vacías se ignoran y las
              que ya tengan cifras se reemplazan. <strong>Nunca escribe sin que previsualices</strong>: una cifra
              equivocada cambia en silencio qué obligaciones le salen al cliente.
            </p>
            {nombreArchivo && <div style={{ fontSize: 12.5, marginTop: 8 }}>📄 <b>{nombreArchivo}</b> — {leidas.length} fila(s) leída(s).</div>}

            {previo && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13 }}>
                  <b style={{ color: 'var(--exito)' }}>{previo.aplicar}</b> cliente(s) por guardar ·{' '}
                  <b style={{ color: previo.problemas.length ? 'var(--peligro)' : 'var(--muted)' }}>{previo.problemas.length}</b> con problema{' '}
                  <span style={{ color: 'var(--muted)' }}>(de {previo.totalFilas} fila(s))</span>
                </div>
                {previo.problemas.length > 0 && (
                  <div style={{ maxHeight: 140, overflow: 'auto', background: 'var(--peligro-suave)', borderRadius: 6, padding: '6px 9px', fontSize: 11.5, color: 'var(--peligro-fuerte)' }}>
                    {previo.problemas.map((p, i) => <div key={i}>• {p}</div>)}
                  </div>
                )}
                {previo.preview.length > 0 && (
                  <div style={{ maxHeight: 160, overflow: 'auto', fontSize: 11.5, color: 'var(--muted)' }}>
                    {previo.preview.map((p, i) => <div key={i}>✓ {p}</div>)}
                    {previo.aplicar > previo.preview.length && <div>… y {previo.aplicar - previo.preview.length} más</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {cargando ? (
        <div className="panel" style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>
      ) : (
        <TablaDatos filas={filas} columnas={columnas} idDe={(f) => f.empresaId}
          vacio="No hay clientes activos." sinCoincidencias="Ningún cliente cumple los filtros." />
      )}
    </div>
  );
}
