'use client';
// Vista de Visitas y REUNIONES: lista por mes, agendar y abrir el acta de cada
// una. Presencial y virtual son la misma entidad con distinta modalidad (ver
// lib/modalidad.ts): se programan, se les levanta acta, dejan compromisos y se
// les hace seguimiento igual. Se distinguen porque la dirección necesita saber
// cuánto del acompañamiento se hace en sitio y cuánto a distancia.
// Filtros tipo Excel (embudo) por columna, combinables. Fase 2 (seguimiento).

import { useCallback, useEffect, useMemo, useState } from 'react';
import VisitaModal, { VISITA_ESTADOS } from './VisitaModal';
import FiltroColumna from '@/app/_components/FiltroColumna';
import SeguimientoVisitas from './SeguimientoVisitas';

import { tinte } from '@/app/_components/color';
import { fmtDia } from '@/lib/fechas';
import { duracionTexto, duracionEnHoras } from '@/lib/duracion';
import { MODALIDADES, metaModalidad, nombreModalidad, type Modalidad } from '@/lib/modalidad';
type Visita = {
  id: string; empresa: string | null; responsable: string | null; fecha: string; hora: string | null; horaSalida: string | null; almuerzoMinutos: number | null; modalidad: string | null;
  objetivo: string | null; estado: string; compromisosTotal: number; compromisosPendientes: number; compromisosCumplidos: number;
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (n: number) => String(n).padStart(2, '0');
function mesActual() { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`; }
function desplazar(mes: string, delta: number) { const [y, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + delta, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; }
function fFecha(iso: string) { try { return fmtDia(iso, { day: '2-digit', month: 'short' }); } catch { return iso.slice(0, 10); } }
const estadoMeta = (k: string) => VISITA_ESTADOS.find((s) => s.k === k) ?? { label: k, color: 'var(--muted)' };

// Columnas filtrables y el valor por el que se filtra cada una.
const COLS = ['fecha', 'modalidad', 'cliente', 'responsable', 'objetivo', 'duracion', 'estado', 'compromisos'] as const;
type Col = (typeof COLS)[number];
const sinFiltros = (): Record<Col, Set<string> | null> => ({ fecha: null, modalidad: null, cliente: null, responsable: null, objetivo: null, duracion: null, estado: null, compromisos: null });
const catCompromisos = (v: Visita) => v.compromisosTotal === 0 ? 'Sin compromisos' : v.compromisosCumplidos === v.compromisosTotal ? 'Todos cumplidos' : 'Con pendientes';
function valorDe(v: Visita, c: Col): string {
  switch (c) {
    case 'fecha': return fFecha(v.fecha);
    case 'cliente': return v.empresa ?? '';
    case 'responsable': return v.responsable ?? '';
    case 'objetivo': return v.objetivo ?? '';
    case 'estado': return estadoMeta(v.estado).label;
    case 'compromisos': return catCompromisos(v);
    // "Sin registrar" es una categoría de filtro por derecho propio: es la lista
    // de actas a las que les falta marcar la salida, y sin ella esas visitas no
    // cuentan en las horas.
    case 'duracion': return duracionTexto(v.hora, v.horaSalida, v.almuerzoMinutos) || 'Sin registrar';
    case 'modalidad': return nombreModalidad(v.modalidad);
  }
}

export default function VisitasView({ puedeAgendar }: { puedeAgendar: boolean }) {
  const [mes, setMes] = useState(mesActual());
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editar, setEditar] = useState<string | 'nueva' | null>(null);
  // Con qué modalidad se abre el acta NUEVA. Se elige al agendar, no después:
  // cambia cómo se llama y qué se pregunta (dirección o enlace).
  const [modalidadNueva, setModalidadNueva] = useState<Modalidad>('presencial');
  const [filtros, setFiltros] = useState<Record<Col, Set<string> | null>>(sinFiltros);
  const [tab, setTab] = useState<'lista' | 'seguimiento'>('lista');

  const cargar = useCallback(async (m: string) => {
    setCargando(true); setError(null);
    const [y, mm] = m.split('-').map(Number);
    try {
      const r = await fetch(`/api/visitas?anio=${y}&mes=${mm}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setVisitas(d.visitas ?? []); else setError(d.error || 'No se pudieron cargar las visitas.');
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(mes); }, [mes, cargar]);
  useEffect(() => { setFiltros(sinFiltros()); }, [mes]); // los valores cambian por mes

  const [y, m] = mes.split('-').map(Number);

  // Valores distintos por columna (fecha en orden cronológico, el resto alfabético).
  const valores = useMemo(() => {
    const out = {} as Record<Col, string[]>;
    for (const c of COLS) {
      if (c === 'fecha') {
        const isos = [...new Set(visitas.map((v) => v.fecha.slice(0, 10)))].sort();
        out[c] = isos.map((iso) => fFecha(iso));
      } else {
        out[c] = [...new Set(visitas.map((v) => valorDe(v, c)))].sort((a, b) => a.localeCompare(b, 'es'));
      }
    }
    return out;
  }, [visitas]);

  const visitasFiltradas = useMemo(
    () => visitas.filter((v) => COLS.every((c) => { const sel = filtros[c]; return sel == null || sel.has(valorDe(v, c)); })),
    [visitas, filtros],
  );
  // Horas del recorte que se está viendo. Es el número por el que se pidió la
  // hora de salida: no basta con registrarla acta por acta, hay que poder sumar.
  // Se cuentan también las actas SIN salida, aparte, porque un total que ignora
  // en silencio la mitad de las visitas es peor que no tener total.
  const horas = useMemo(() => {
    let total = 0, conDuracion = 0, sinRegistrar = 0;
    for (const v of visitasFiltradas) {
      const h = duracionEnHoras(v.hora, v.horaSalida, v.almuerzoMinutos);
      if (h == null) sinRegistrar++; else { total += h; conDuracion++; }
    }
    return { total: Math.round(total * 100) / 100, conDuracion, sinRegistrar };
  }, [visitasFiltradas]);

  const hayFiltro = COLS.some((c) => filtros[c] != null);
  const setFiltro = (c: Col, s: Set<string> | null) => setFiltros((f) => ({ ...f, [c]: s }));

  const th = (c: Col, texto: string, buscar = false, estilo?: React.CSSProperties) => (
    <th style={estilo}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{texto}
        <FiltroColumna valores={valores[c]} seleccion={filtros[c]} onCambio={(s) => setFiltro(c, s)} buscar={buscar} />
      </span>
    </th>
  );

  const tabBtn = (k: 'lista' | 'seguimiento', texto: string): React.CSSProperties => ({
    fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--ui)',
    border: '1px solid ' + (tab === k ? 'var(--navy)' : 'var(--edge-strong)'), background: tab === k ? 'var(--navy)' : 'var(--panel)', color: tab === k ? '#fff' : 'var(--muted)',
  });

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Visitas y reuniones</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <a href="/portal/visitas" title="Ver el portal como lo ve el cliente" className="dbtn" style={{ textDecoration: 'none', fontSize: 12.5, marginRight: 4 }}>👁 Portal del cliente</a>
          <button onClick={() => setTab('lista')} style={tabBtn('lista', 'Lista')}>📋 Lista</button>
          <button onClick={() => setTab('seguimiento')} style={tabBtn('seguimiento', 'Seguimiento')}>📊 Seguimiento</button>
        </div>
      </div>

      {error && <div className="panel" style={{ padding: '12px 14px', color: 'var(--peligro-fuerte)', fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      {tab === 'seguimiento' ? <SeguimientoVisitas /> : (
      <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMes(desplazar(mes, -1))} className="dbtn" style={{ fontSize: 13 }}>‹</button>
          <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>{MESES[m - 1]} {y}</span>
          <button onClick={() => setMes(desplazar(mes, 1))} className="dbtn" style={{ fontSize: 13 }}>›</button>
          <button onClick={() => setMes(mesActual())} className="dbtn" style={{ fontSize: 12.5 }}>Hoy</button>
        </div>
        {puedeAgendar && MODALIDADES.map((m) => (
          <button key={m.k} className={m.k === 'presencial' ? 'dbtn primary' : 'dbtn'} style={{ fontSize: 13 }}
            onClick={() => { setModalidadNueva(m.k); setEditar('nueva'); }}
            title={m.k === 'virtual' ? 'Reunión virtual: se programa y se levanta acta igual que una visita' : 'Visita en sitio'}>
            ＋ {m.icono} {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{visitasFiltradas.length}{hayFiltro ? ` de ${visitas.length}` : ''} programada(s)</span>
        {(horas.conDuracion > 0 || horas.sinRegistrar > 0) && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            · <b style={{ color: 'var(--ink)' }}>{horas.total.toLocaleString('es-CO', { maximumFractionDigits: 2 })} h</b> registradas
            {horas.sinRegistrar > 0 && (
              <span title="Actas sin hora de salida: no entran en el total" style={{ color: 'var(--peligro)', fontWeight: 600 }}> · {horas.sinRegistrar} sin registrar</span>
            )}
          </span>
        )}
        {hayFiltro && <button className="dbtn" onClick={() => setFiltros(sinFiltros())} style={{ fontSize: 12 }}>Limpiar filtros</button>}
      </div>

      <div className="panel">
        <div className="dt-wrap dt-alta">
          <table className="dt">
            <thead><tr>
              {th('fecha', 'Fecha', false, { width: 96 })}
              {th('modalidad', 'Tipo', false, { width: 108 })}
              {th('cliente', 'Cliente', true)}
              {th('responsable', 'Responsable', true)}
              {th('objetivo', 'Objetivo', true)}
              {th('duracion', 'Duración', false, { width: 110 })}
              {th('estado', 'Estado', false, { width: 130 })}
              {th('compromisos', 'Compromisos', false, { width: 140 })}
            </tr></thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
              ) : visitas.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin visitas ni reuniones este mes.</td></tr>
              ) : visitasFiltradas.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Ninguna cumple los filtros.</td></tr>
              ) : visitasFiltradas.map((v) => {
                const em = estadoMeta(v.estado);
                return (
                  <tr key={v.id} onClick={() => setEditar(v.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fFecha(v.fecha)}{v.hora ? <span style={{ color: 'var(--muted)', fontSize: 11 }}> · {v.hora}</span> : null}</td>
                    <td>{(() => { const m = metaModalidad(v.modalidad); return (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: m.color, background: `${tinte(m.color, 10)}`, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>{m.icono} {m.label}</span>
                    ); })()}</td>
                    <td style={{ fontWeight: 600 }}>{v.empresa ?? '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{v.responsable ?? '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{v.objetivo ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12.5 }} title={v.hora || v.horaSalida ? `${v.hora ?? '—'} a ${v.horaSalida ?? '—'}${v.almuerzoMinutos ? ` · menos ${v.almuerzoMinutos} min de almuerzo` : ''}` : undefined}>{duracionTexto(v.hora, v.horaSalida, v.almuerzoMinutos) || '—'}</td>
                    <td><span style={{ fontSize: 11.5, fontWeight: 800, color: em.color, background: `${tinte(em.color, 12)}`, borderRadius: 20, padding: '2px 9px' }}>{em.label}</span></td>
                    <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{v.compromisosTotal === 0 ? '—' : `${v.compromisosCumplidos}/${v.compromisosTotal} cumplidos`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 2px 0' }}>Haz clic en una visita para abrir su acta (objetivo, compromisos y recomendaciones). Usa el embudo (▼) de cada columna para filtrar. Las visitas también aparecen en el Calendario.</p>
      </>
      )}

      {editar && <VisitaModal id={editar === 'nueva' ? null : editar} modalidadInicial={editar === 'nueva' ? modalidadNueva : undefined} onClose={() => setEditar(null)} onSaved={() => cargar(mes)} />}
    </>
  );
}
