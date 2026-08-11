'use client';
// Los impuestos del asesor, dentro de Mi Día.
//
// Antes el área de Impuestos no tenía dónde trabajar: los vencimientos viven en
// una pantalla que el rol Asesor no puede abrir, y las actividades de impuestos
// no generan tarea a propósito (se controlan como vencimiento, no se duplican).
// Resultado: al asesor de impuestos no le aparecía nada.
//
// Aquí trabaja sobre el vencimiento MISMO, no sobre una copia: el chulo que
// marca, el valor que digita y el estado que pone son los de esa obligación, así
// que el calendario y Pagos quedan al día solos y no hay dos verdades.

import { useEffect, useState } from 'react';
import TablaDatos, { type Columna } from '@/app/_components/TablaDatos';
import PanelPlegable from '@/app/_components/PanelPlegable';
import { etiquetaDeConteos, siguienteEstado, ASPECTO } from '@/lib/checklist';

type Fila = {
  id: string; obligacion: string; periodo: string | null; fechaVencimiento: string;
  empresa: string; municipio: string | null;
  estadoRevision: string; observacionRevision: string | null; revisor: string | null;
  valorPago: number | null; checklistTotal: number; checklistHechas: number; checklistAplicables: number;
  liberado: boolean; liberadoEn: string | null; vencido: boolean;
};
type Resp = { mes: string; total: number; listos: number; esperando: number; vencidos: number; impuestos: Fila[] };
type Sub = { id: string; texto: string; estado: string };

const REVISION: Record<string, { label: string; color: string; fondo: string }> = {
  sin_iniciar: { label: 'Sin iniciar', color: 'var(--muted)', fondo: 'transparent' },
  en_proceso: { label: 'En proceso', color: 'var(--info-fuerte)', fondo: 'var(--info-suave)' },
  en_revision: { label: 'En revisión', color: 'var(--alerta-fuerte)', fondo: 'var(--alerta-suave)' },
  devuelto: { label: 'Devuelto', color: 'var(--peligro-fuerte)', fondo: 'var(--peligro-suave)' },
  aprobado: { label: 'Aprobado', color: 'var(--exito-fuerte)', fondo: 'var(--exito-suave)' },
};
// Los estados con los que el asesor da por presentada la obligación. 'pendiente'
// no está: se sale de pendiente presentando, no eligiéndolo de una lista.
const ESTADOS_PRESENTAR = [
  { v: 'presentado_sin_pago', label: 'Presentado sin pago' },
  { v: 'presentado_pagado', label: 'Presentado y pagado' },
  { v: 'presentado_cero', label: 'Presentado en ceros' },
  { v: 'no_obligado', label: 'No obligado' },
];

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); } catch { return '—'; }
};
const pesos = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }));

export default function ImpuestosDelDia() {
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mes, setMes] = useState('');
  const [subs, setSubs] = useState<Sub[]>([]);
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function cargar() {
    try {
      const q = /^\d{4}-\d{2}$/.test(mes) ? `?mes=${mes}` : '';
      const r = await fetch(`/api/vencimientos/mi-dia${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) { setData(d as Resp); if (!mes && d?.mes) setMes(d.mes); }
    } catch { /* silencioso: el panel se oculta si no hay datos */ }
    finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function abrir(f: Fila) {
    setSubs([]); setMsg(null);
    setValor(f.valorPago != null ? String(f.valorPago) : '');
    try {
      setUltimaAbierta(f.id);
      const r = await fetch(`/api/vencimientos/${f.id}/detalle`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setSubs(d?.vencimiento?.subtareas ?? []);
    } catch { /* el detalle es complementario; las acciones no dependen de él */ }
  }

  async function marcarSub(id: string, estado: string) {
    setSubs((s) => s.map((x) => (x.id === id ? { ...x, estado } : x))); // respuesta inmediata
    const r = await fetch(`/api/vencimientos/subtareas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'No se pudo marcar.'); await abrirDeNuevo(); }
    else await cargar();
  }
  const [ultimaAbierta, setUltimaAbierta] = useState<string | null>(null);
  async function abrirDeNuevo() {
    if (!ultimaAbierta) return;
    const r = await fetch(`/api/vencimientos/${ultimaAbierta}/detalle`, { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setSubs(d?.vencimiento?.subtareas ?? []);
  }

  async function accion(id: string, acc: string) {
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch(`/api/vencimientos/${id}/revision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: acc }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo completar la acción.'); return; }
      await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  async function guardarValor(id: string) {
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch(`/api/vencimientos/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valorPago: valor === '' ? null : Number(valor) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo guardar el valor.'); return; }
      setMsg('✓ Valor guardado.'); await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  async function presentar(id: string, estado: string) {
    setTrabajando(true); setMsg(null);
    try {
      const r = await fetch(`/api/vencimientos/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, ...(valor === '' ? {} : { valorPago: Number(valor) }) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? 'No se pudo marcar como presentado.'); return; }
      await cargar();
    } catch { setMsg('Error de red.'); } finally { setTrabajando(false); }
  }

  // Se oculta solo si el usuario no tiene impuestos a cargo.
  if (cargando || !data || data.total === 0) return null;

  const rev = (e: string) => REVISION[e] ?? REVISION.sin_iniciar;
  const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--edge-strong)', borderRadius: 6, fontSize: 12.5, background: 'var(--panel)', color: 'var(--ink)' };

  // El valor de cada columna es TAMBIÉN por lo que se filtra y se ordena: si el
  // embudo ofreciera algo distinto de lo que se ve, filtrar dejaría fuera filas
  // que sí cumplen.
  const columnas: Columna<Fila>[] = [
    { clave: 'empresa', label: 'Cliente', valor: (f) => f.empresa, buscar: true, estiloCelda: { fontWeight: 600 } },
    { clave: 'obligacion', label: 'Obligación', buscar: true,
      valor: (f) => (f.municipio ? `${f.obligacion} · ${f.municipio}` : f.obligacion),
      estiloCelda: { color: 'var(--muted)' } },
    { clave: 'periodo', label: 'Período', valor: (f) => f.periodo ?? '—', estiloCelda: { color: 'var(--muted)', whiteSpace: 'nowrap' } },
    { clave: 'vence', label: 'Vence', valor: (f) => fmt(f.fechaVencimiento), orden: (f) => f.fechaVencimiento,
      render: (f) => <span style={{ whiteSpace: 'nowrap', color: f.vencido ? 'var(--peligro-fuerte)' : 'var(--muted)', fontWeight: f.vencido ? 700 : 400 }}>{fmt(f.fechaVencimiento)}</span> },
    { clave: 'insumo', label: 'Insumo', valor: (f) => (f.liberado ? 'listo' : 'esperando'),
      render: (f) => (f.liberado
        ? <span title={f.liberadoEn ? `Liberado el ${fmt(f.liberadoEn)}` : 'Sin cierre mensual del que dependa'} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--exito-fuerte)', whiteSpace: 'nowrap' }}>✓ listo</span>
        : <span title="El auxiliar aún no libera el mes de este cliente" style={{ fontSize: 11.5, color: 'var(--alerta-fuerte)', fontWeight: 700, whiteSpace: 'nowrap' }}>⏳ esperando</span>) },
    { clave: 'estado', label: 'Estado', valor: (f) => rev(f.estadoRevision).label,
      render: (f) => <span style={{ fontSize: 11.5, fontWeight: 700, color: rev(f.estadoRevision).color, background: rev(f.estadoRevision).fondo, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>{rev(f.estadoRevision).label}</span> },
    { clave: 'checklist', label: 'Checklist', filtrable: false,
      valor: (f) => (f.checklistTotal > 0 ? etiquetaDeConteos(f.checklistHechas, f.checklistAplicables, f.checklistTotal) : '—'),
      estiloCelda: { color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' } },
  ];

  return (
    <PanelPlegable
      id="impuestos-del-dia" titulo="🧾 Mis impuestos"
      nota="Se trabajan sobre la obligación misma: el calendario y Pagos se actualizan solos."
      resumen={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, background: 'var(--exito-suave)', border: '1px solid var(--exito-borde)', borderRadius: 20, padding: '4px 12px' }}>
            <b style={{ fontSize: 14, color: 'var(--exito-fuerte)' }}>{data.listos}</b>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>por liquidar</span>
          </span>
          {data.esperando > 0 && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· {data.esperando} esperando insumo</span>}
          {data.vencidos > 0 && <span style={{ fontSize: 11.5, color: 'var(--peligro-fuerte)', fontWeight: 700 }}>· {data.vencidos} vencido(s)</span>}
        </span>
      }
    >
      <div style={{ padding: '10px 14px 4px' }}>
        {msg && <div style={{ background: 'var(--info-suave)', color: 'var(--info-fuerte)', borderRadius: 6, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{msg}</div>}

        {/* La ventana llega hasta el fin del mes elegido, y por defecto es el
            mes en curso: septiembre se habilita solo, sin activar nada. Lo
            vencido de meses anteriores NO se corta — una retención de julio sin
            presentar no deja de existir el 1 de agosto. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Hasta fin de</span>
          <input value={mes} onChange={(e) => setMes(e.target.value)} placeholder="2026-08"
            style={{ ...inp, width: 105, fontFamily: 'var(--mono)', padding: '4px 8px' }} />
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· incluye lo vencido de meses anteriores</span>
        </div>

        <TablaDatos
          filas={data.impuestos}
          columnas={columnas}
          idDe={(f) => f.id}
          vacio="No tienes impuestos pendientes en esta ventana."
          sinCoincidencias="Ninguno cumple los filtros."
          detalle={(f) => <Detalle f={f} subs={subs} valor={valor} setValor={setValor} inp={inp}
            onAbrir={() => abrir(f)} onSub={marcarSub} onAccion={accion}
            onGuardarValor={() => guardarValor(f.id)} onPresentar={(e) => presentar(f.id, e)} trabajando={trabajando} />}
        />
      </div>
    </PanelPlegable>
  );
}

// Detalle de una obligación: checklist, valor a pagar y la acción que
// corresponda al punto del circuito en que está.
function Detalle({ f, subs, valor, setValor, inp, onAbrir, onSub, onAccion, onGuardarValor, onPresentar, trabajando }: {
  f: Fila; subs: Sub[]; valor: string; setValor: (v: string) => void; inp: React.CSSProperties;
  onAbrir: () => void; onSub: (id: string, estado: string) => void; onAccion: (id: string, acc: string) => void;
  onGuardarValor: () => void; onPresentar: (estado: string) => void; trabajando: boolean;
}) {
  useEffect(() => { onAbrir(); /* carga el checklist al desplegar */ }, [f.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Lo devuelto va primero y en rojo: es lo único que el asesor necesita
          leer para saber qué corregir. */}
      {f.estadoRevision === 'devuelto' && f.observacionRevision && (
        <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 12.5, marginBottom: 12 }}>
          <b>Devuelto{f.revisor ? ` por ${f.revisor}` : ''}:</b> {f.observacionRevision}
        </div>
      )}

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 260, flex: '1 1 320px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 6 }}>Checklist</div>
          {subs.length === 0
            ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Esta obligación no tiene checklist configurado.</div>
            : (<>
              {subs.map((s) => {
                const a = ASPECTO[s.estado] ?? ASPECTO.pendiente;
                return (
                  <button key={s.id} onClick={() => onSub(s.id, siguienteEstado(s.estado))} title={a.titulo}
                    style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, padding: '3px 0', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', width: '100%', fontFamily: 'var(--ui)' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${a.borde}`, background: a.fondo, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, flexShrink: 0, marginTop: 1, fontWeight: 800 }}>{a.marca}</span>
                    <span style={{ color: a.color, textDecoration: a.tacha ? 'line-through' : undefined }}>{s.texto}</span>
                  </button>
                );
              })}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                Clic para cambiar: pendiente → <b>hecha</b> → <b>no aplica</b>. Lo que no aplica no cuenta para la medición.
              </div>
            </>)}
        </div>

        <div style={{ minWidth: 240 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 6 }}>Valor a pagar</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="numeric" placeholder="0" style={{ ...inp, width: 140, fontFamily: 'var(--mono)' }} />
            <button className="dbtn" disabled={trabajando} onClick={onGuardarValor} style={{ fontSize: 12, padding: '6px 10px' }}>Guardar</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Actual: {pesos(f.valorPago)} · va directo a Pagos.</div>
        </div>
      </div>

      {/* Solo aparece la acción que corresponde: menos que decidir, menos que explicar. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        {!f.liberado && (
          <span style={{ fontSize: 12, color: 'var(--alerta-fuerte)', fontWeight: 600 }}>
            El auxiliar todavía no libera el mes — podés adelantar, pero el insumo no está confirmado.
          </span>
        )}
        {f.estadoRevision === 'sin_iniciar' && (
          <button className="dbtn" disabled={trabajando} onClick={() => onAccion(f.id, 'iniciar')} style={{ fontSize: 13 }}>Empezar a liquidar</button>
        )}
        {(f.estadoRevision === 'en_proceso' || f.estadoRevision === 'devuelto') && (
          <button className="dbtn primary" disabled={trabajando} onClick={() => onAccion(f.id, 'enviar')} style={{ fontSize: 13 }}>Enviar a revisión</button>
        )}
        {f.estadoRevision === 'en_revision' && (
          <span style={{ fontSize: 12.5, color: 'var(--alerta-fuerte)', fontWeight: 600 }}>En manos del revisor — no lo edites mientras tanto.</span>
        )}
        {f.estadoRevision === 'aprobado' && (
          <>
            <span style={{ fontSize: 12.5, color: 'var(--exito-fuerte)', fontWeight: 700 }}>✓ Aprobado{f.revisor ? ` por ${f.revisor}` : ''} — ya podés presentar:</span>
            {ESTADOS_PRESENTAR.map((e) => (
              <button key={e.v} className="dbtn" disabled={trabajando} onClick={() => onPresentar(e.v)} style={{ fontSize: 12.5 }}>{e.label}</button>
            ))}
          </>
        )}
      </div>
    </>
  );
}
