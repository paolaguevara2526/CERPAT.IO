'use client';
// Vista de Vencimientos: KPIs del año + listado con semáforo y filtros tipo Excel
// (embudo por columna: compañía, obligación, período, vence, estado, notas). El
// Administrador edita el estado y las notas en línea. Todo contra /api/vencimientos
// (permisos validados en el backend).

import { useEffect, useState, useCallback, useMemo } from 'react';
import ImportarVencimientosModal from './ImportarVencimientosModal';
import FiltroColumna from '@/app/_components/FiltroColumna';
import { useOrden, ThOrden } from '@/app/_components/orden';
import { descargarXlsx, hoyISO, diaComoFecha, type Celda } from '@/app/_components/exportar';

import { tinte } from '@/app/_components/color';
const ANIO = 2026;
type Venc = {
  id: string; empresaId: string; empresa: string | null; obligacion: string; periodicidad: string | null;
  periodo: string | null; municipio: string | null; fechaVencimiento: string; estado: string; notas: string | null; vencido: boolean;
  // Vienen del endpoint y no se pintan en la tabla (no cabrían), pero sí van al
  // Excel: son las columnas por las que se reparte y se cobra el trabajo.
  asesor?: string | null; valorPago?: number | null; soporteLink?: string | null;
};
type Resumen = { kpis: { total: number; presentados: number; pendientes: number; vencidos: number } | null; porMes: number[] };

const ESTADO_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'var(--muted)' },
  presentado_sin_pago: { label: 'Presentado (sin pago)', color: 'var(--info)' },
  presentado_pagado: { label: 'Presentado y pagado', color: 'var(--exito)' },
  presentado_cero: { label: 'Presentado en $0', color: 'var(--cero)' },
  no_presentado: { label: 'No presentado', color: 'var(--peligro)' },
  no_obligado: { label: 'No obligado', color: 'var(--neutro)' },
};
// La fecha se guarda como día calendario (medianoche UTC). Se arma desde las
// partes año-mes-día para mostrar el día exacto, sin corrimiento por zona horaria.
function fmtFecha(iso: string) { try { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } }

// Estado mostrado (un pendiente cuya fecha ya pasó aparece como "Vencido").
function estadoDisplay(v: Venc): string { return v.vencido ? 'Vencido' : (ESTADO_META[v.estado]?.label ?? v.estado); }

const COLS = ['compania', 'obligacion', 'periodo', 'vence', 'estado', 'notas'] as const;
type Col = (typeof COLS)[number];
const sinFiltros = (): Record<Col, Set<string> | null> => ({ compania: null, obligacion: null, periodo: null, vence: null, estado: null, notas: null });
function valorDe(v: Venc, c: Col): string {
  switch (c) {
    case 'compania': return v.empresa ?? '(sin compañía)';
    case 'obligacion': return v.obligacion;
    case 'periodo': return v.periodo ?? '(sin período)';
    case 'vence': return fmtFecha(v.fechaVencimiento);
    case 'estado': return estadoDisplay(v);
    case 'notas': return v.notas && v.notas.trim() ? v.notas : '(sin notas)';
  }
}

// Valor por el que se ORDENA (distinto del que se muestra y se filtra): la fecha
// va como ISO para que ordene cronológicamente y no alfabéticamente.
function claveOrden(v: Venc, c: Col): string {
  return c === 'vence' ? v.fechaVencimiento.slice(0, 10) : valorDe(v, c);
}

export default function VencimientosView({ esEditor }: { esEditor: boolean }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [items, setItems] = useState<Venc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importar, setImportar] = useState(false);
  const [filtros, setFiltros] = useState<Record<Col, Set<string> | null>>(sinFiltros);
  const { orden, alternar, ordenar } = useOrden<Col>();
  const [aEliminar, setAEliminar] = useState<Venc | null>(null);
  // Cuántas filas se DIBUJAN. Con 3.133 vencimientos y tres controles por fila
  // —fecha, estado y notas— el navegador tenía que sostener casi diez mil
  // campos: por eso la pantalla iba pesada. Los filtros y el orden siguen
  // trabajando sobre el año completo; lo que se limita es lo que se pinta.
  const [pagina, setPagina] = useState(1);
  const [eliminando, setEliminando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const cargarBase = useCallback(async () => {
    try {
      const rr = await fetch(`/api/vencimientos/resumen?anio=${ANIO}`, { cache: 'no-store' }).then((r) => r.json());
      if (rr.error) { setError(rr.error); return; }
      setResumen(rr);
    } catch { setError('Error de red.'); }
  }, []);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const d = await fetch(`/api/vencimientos?anio=${ANIO}`, { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error); else { setItems(d.vencimientos ?? []); setError(null); }
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);

  useEffect(() => { cargarBase(); }, [cargarBase]);
  useEffect(() => { cargarLista(); }, [cargarLista]);

  async function editar(v: Venc, campo: 'estado' | 'notas' | 'fechaVencimiento', valor: string) {
    const prev = items;
    setItems((p) => p.map((x) => (x.id === v.id ? { ...x, [campo]: valor } : x)));
    const r = await fetch(`/api/vencimientos/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }) });
    if (!r.ok) { setItems(prev); const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo guardar.'); return; }
    // Cambiar estado o fecha mueve los KPIs, así que se refrescan. La LISTA no se
    // recarga: traer 3.000 filas por una fecha corregida congelaba la pantalla y
    // rehacía el campo que se acababa de tocar. La fila ya se actualizó arriba.
    if (campo === 'estado' || campo === 'fechaVencimiento') cargarBase();
  }

  async function eliminar(v: Venc) {
    setEliminando(true); setError(null);
    try {
      const r = await fetch(`/api/vencimientos/${v.id}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); setEliminando(false); return; }
      setItems((p) => p.filter((x) => x.id !== v.id)); // quita de la lista sin recargar todo
      setAEliminar(null);
      cargarBase(); // el conteo/KPIs cambia
    } catch { setError('Error de red.'); }
    setEliminando(false);
  }

  // Valores distintos por columna (Vence en orden cronológico; el resto alfabético).
  const valores = useMemo(() => {
    const out = {} as Record<Col, string[]>;
    for (const c of COLS) {
      if (c === 'vence') {
        const isos = [...new Set(items.map((v) => v.fechaVencimiento.slice(0, 10)))].sort();
        out[c] = isos.map((iso) => fmtFecha(iso));
      } else {
        out[c] = [...new Set(items.map((v) => valorDe(v, c)))].sort((a, b) => a.localeCompare(b, 'es'));
      }
    }
    return out;
  }, [items]);

  const filtrados = useMemo(
    () => ordenar(
      items.filter((v) => COLS.every((c) => { const s = filtros[c]; return s == null || s.has(valorDe(v, c)); })),
      claveOrden,
    ),
    [items, filtros, ordenar],
  );
  const hayFiltro = COLS.some((c) => filtros[c] != null);
  const setFiltro = (c: Col, s: Set<string> | null) => { setFiltros((f) => ({ ...f, [c]: s })); setPagina(1); };
  // Cada encabezado ordena (clic en el texto) y filtra (embudo), sin estorbarse.
  const th = (c: Col, texto: string, buscar = false, estilo?: React.CSSProperties) => (
    <ThOrden col={c} orden={orden} alternar={alternar} style={estilo}
      extra={<FiltroColumna valores={valores[c]} seleccion={filtros[c]} onCambio={(s) => setFiltro(c, s)} buscar={buscar} />}>
      {texto}
    </ThOrden>
  );

  // ---------- Exportar a Excel ----------
  // Se baja LO FILTRADO y en el orden actual, no la página ni el año completo:
  // quien acaba de filtrar por un cliente espera ese recorte, y la diferencia no
  // se nota hasta que alguien trabaja sobre el archivo equivocado. Por eso el
  // botón dice cuántas filas va a bajar.
  //
  // El archivo lleva MÁS columnas que la pantalla (municipio, responsable, valor,
  // soporte): en la tabla no caben, pero fuera de la aplicación son justo por las
  // que se reparte y se revisa el trabajo.
  const COLUMNAS_XLSX: { label: string; valor: (v: Venc) => Celda }[] = [
    { label: 'Compañía', valor: (v) => v.empresa ?? '' },
    { label: 'Obligación', valor: (v) => v.obligacion },
    { label: 'Periodicidad', valor: (v) => v.periodicidad ?? '' },
    { label: 'Período', valor: (v) => v.periodo ?? '' },
    { label: 'Municipio', valor: (v) => v.municipio ?? '' },
    // Fecha real (no texto) para que Excel ordene y filtre por rango. Se arma
    // desde las partes para que no se corra un día por zona horaria, igual que
    // fmtFecha.
    { label: 'Vence', valor: (v) => diaComoFecha(v.fechaVencimiento) },
    { label: 'Estado', valor: (v) => ESTADO_META[v.estado]?.label ?? v.estado },
    { label: 'Vencido', valor: (v) => (v.vencido ? 'Sí' : 'No') },
    { label: 'Responsable', valor: (v) => v.asesor ?? '' },
    { label: 'Valor a pagar', valor: (v) => (v.valorPago != null ? v.valorPago : null) },
    { label: 'Notas', valor: (v) => v.notas ?? '' },
    { label: 'Soporte', valor: (v) => v.soporteLink ?? '' },
  ];

  async function exportar() {
    if (!filtrados.length) return;
    setExportando(true);
    try {
      const filas: Celda[][] = [
        COLUMNAS_XLSX.map((c) => c.label),
        ...filtrados.map((v) => COLUMNAS_XLSX.map((c) => c.valor(v))),
      ];
      await descargarXlsx(`vencimientos-${ANIO}-${hoyISO()}.xlsx`, [{ nombre: `Vencimientos ${ANIO}`, filas }]);
    } catch {
      setError('No se pudo generar el archivo.');
    } finally {
      setExportando(false);
    }
  }

  const POR_PAGINA = 100;
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const enPantalla = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);

  const k = resumen?.kpis;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Vencimientos {ANIO}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Dice cuántas filas va a bajar: es la única forma de que se note, antes
              de abrir el archivo, que lo que se baja es lo FILTRADO y no el año. */}
          <button className="dbtn" onClick={exportar} disabled={exportando || !filtrados.length} style={{ fontSize: 13 }}
            title={hayFiltro ? 'Baja los vencimientos que pasan los filtros puestos, en el orden actual' : 'Baja todos los vencimientos del año, en el orden actual'}>
            {exportando ? 'Generando…' : `⬇ Exportar a Excel (${filtrados.length})`}
          </button>
          {esEditor && <button className="dbtn" onClick={() => setImportar(true)} style={{ fontSize: 13 }}>⬆ Importar Excel</button>}
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>Obligaciones tributarias generadas por cliente según su configuración y el calendario DIAN. {esEditor ? 'Marca presentado/pagado y ajusta la fecha si un calendario municipal cambió.' : 'Solo consulta.'}</p>

      {importar && <ImportarVencimientosModal onClose={() => setImportar(false)} onImported={() => { cargarBase(); cargarLista(); }} />}

      {error && <div className="panel" style={{ padding: '10px 14px', color: 'var(--peligro-fuerte)', fontWeight: 600, marginBottom: 14 }}>{error}</div>}

      {k && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
          <div className="tile"><div className="k">Vencimientos</div><div className="v" style={{ color: 'var(--navy)' }}>{k.total}</div><div className="s">en el año</div></div>
          <div className="tile"><div className="k">Presentados</div><div className="v" style={{ color: 'var(--exito)' }}>{k.presentados}</div><div className="s">cumplidos</div></div>
          <div className="tile"><div className="k">Pendientes</div><div className="v" style={{ color: 'var(--info)' }}>{k.pendientes}</div><div className="s">por vencer</div></div>
          <div className="tile"><div className="k">Vencidos</div><div className="v" style={{ color: k.vencidos ? 'var(--peligro)' : 'var(--neutro)' }}>{k.vencidos}</div><div className="s">requieren atención</div></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {filtrados.length}{hayFiltro ? ` de ${items.length}` : ''} vencimiento(s)
          {paginas > 1 && <span> · mostrando {enPantalla.length} (página {pag} de {paginas})</span>}
        </span>
        {hayFiltro && <button className="dbtn" onClick={() => setFiltros(sinFiltros())} style={{ fontSize: 12 }}>Limpiar filtros</button>}
        <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 'auto' }}>Clic en el título de la columna para ordenar · embudo ▼ para filtrar.</span>
      </div>

      <div className="panel dt-alta">
        <table className="dt" style={{ minWidth: 900 }}>
          <thead><tr>
            {th('compania', 'Compañía', true, { minWidth: 160 })}
            {th('obligacion', 'Obligación', true, { minWidth: 150 })}
            {th('periodo', 'Período', true)}
            {th('vence', 'Vence', true)}
            {th('estado', 'Estado')}
            {th('notas', 'Notas', true, { minWidth: 160 })}
            {esEditor && <th style={{ width: 44 }}></th>}
          </tr></thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={esEditor ? 7 : 6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={esEditor ? 7 : 6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin vencimientos. Si aún no corres el generador, no habrá datos.</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={esEditor ? 7 : 6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Ninguno cumple los filtros.</td></tr>
            ) : enPantalla.map((v) => {
              const em = ESTADO_META[v.estado] ?? ESTADO_META.pendiente;
              return (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600, minWidth: 160 }}>{v.empresa ?? '—'}</td>
                  <td style={{ minWidth: 150 }}>{v.obligacion}{v.municipio && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{v.municipio}</div>}{v.periodicidad && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{v.periodicidad}</div>}</td>
                  <td style={{ color: 'var(--muted)' }}>{v.periodo ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {/* Se guarda al SALIR del campo (o con Enter), no en cada tecla:
                        un <input type="date"> dispara onChange mientras se escribe, y
                        al completar el año salía el guardado, se recargaba la lista
                        entera y el campo se rehacía debajo del cursor. Por eso "no
                        dejaba digitar la fecha". */}
                    {esEditor ? (
                      <input type="date" defaultValue={v.fechaVencimiento.slice(0, 10)} key={v.fechaVencimiento}
                        onBlur={(e) => { if (e.target.value && e.target.value !== v.fechaVencimiento.slice(0, 10)) editar(v, 'fechaVencimiento', e.target.value); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ fontSize: 12, fontWeight: v.vencido ? 800 : 600, color: v.vencido ? 'var(--peligro)' : 'var(--ink)', background: 'var(--panel)', border: `1px solid ${v.vencido ? '#cf443666' : 'var(--edge-strong)'}`, borderRadius: 4, padding: '4px 6px', fontFamily: 'var(--ui)' }} />
                    ) : (
                      <span style={{ fontWeight: v.vencido ? 800 : 500, color: v.vencido ? 'var(--peligro)' : 'var(--muted)' }}>{fmtFecha(v.fechaVencimiento)}</span>
                    )}
                  </td>
                  <td>
                    {esEditor ? (
                      <select value={v.estado} onChange={(e) => editar(v, 'estado', e.target.value)} style={{ fontSize: 11.5, fontWeight: 700, color: v.vencido ? 'var(--peligro)' : em.color, background: `${tinte((v.vencido ? 'var(--peligro)' : em.color), 12)}`, border: `1px solid ${tinte((v.vencido ? 'var(--peligro)' : em.color), 30)}`, borderRadius: 4, padding: '4px 6px', fontFamily: 'var(--ui)' }}>
                        {Object.entries(ESTADO_META).map(([id, m]) => <option key={id} value={id} style={{ color: '#111' }}>{m.label}</option>)}
                      </select>
                    ) : (
                      <span className="chip" style={{ color: v.vencido ? 'var(--peligro)' : em.color, background: `${tinte((v.vencido ? 'var(--peligro)' : em.color), 12)}`, borderColor: `${tinte((v.vencido ? 'var(--peligro)' : em.color), 30)}` }}>{v.vencido ? 'Vencido' : em.label}</span>
                    )}
                  </td>
                  <td style={{ minWidth: 160 }}>
                    {esEditor ? (
                      <input defaultValue={v.notas ?? ''} onBlur={(e) => { if (e.target.value !== (v.notas ?? '')) editar(v, 'notas', e.target.value); }} placeholder="—"
                        style={{ width: '100%', padding: '5px 7px', borderRadius: 4, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12, fontFamily: 'var(--ui)' }} />
                    ) : (<span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{v.notas ?? '—'}</span>)}
                  </td>
                  {esEditor && (
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => setAEliminar(v)} title="Eliminar vencimiento" aria-label="Eliminar vencimiento"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--peligro)', cursor: 'pointer' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6M10 11v6M14 11v6" /></svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button className="dbtn" disabled={pag <= 1} onClick={() => setPagina(pag - 1)} style={{ fontSize: 12.5 }}>← Anterior</button>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Página {pag} de {paginas}</span>
          <button className="dbtn" disabled={pag >= paginas} onClick={() => setPagina(pag + 1)} style={{ fontSize: 12.5 }}>Siguiente →</button>
        </div>
      )}


      {aEliminar && (
        <div onClick={() => !eliminando && setAEliminar(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 440 }}>
            <div className="win-bar"><span className="win-title">Eliminar vencimiento</span></div>
            <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
                ¿Estás seguro de querer eliminar este vencimiento? Esta acción no se puede deshacer.
              </p>
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, padding: '9px 11px', fontSize: 12.5 }}>
                <div style={{ fontWeight: 700 }}>{aEliminar.empresa ?? '—'}</div>
                <div style={{ color: 'var(--muted)' }}>{aEliminar.obligacion}{aEliminar.periodo ? ` · ${aEliminar.periodo}` : ''} · vence {fmtFecha(aEliminar.fechaVencimiento)}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 2 }}>
                <button className="dbtn" onClick={() => setAEliminar(null)} disabled={eliminando} style={{ fontSize: 13 }}>Cancelar</button>
                <button className="dbtn" onClick={() => eliminar(aEliminar)} disabled={eliminando} style={{ fontSize: 13, background: 'var(--peligro-solido)', borderColor: 'var(--peligro-solido)', color: '#fff' }}>
                  {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
