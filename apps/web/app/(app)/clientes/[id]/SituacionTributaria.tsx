'use client';
// Situación tributaria del cliente, dentro de su propia hoja de vida.
//
// Antes esto vivía repartido en Administración: la configuración en una pestaña
// y el diagnóstico del RUB en otra, ambas como listados de los 90 clientes.
// Revisar UN cliente obligaba a abrir tres pantallas y a acordarse de memoria de
// lo visto en las otras dos — que es exactamente como se cuela un error.
//
// Aquí se ve, en el mismo lugar donde ya están sus cifras y sus obligaciones,
// qué responsabilidades tiene configuradas y qué vencimientos le salieron de
// ellas. Solo lectura: editar la configuración sigue siendo de Administración
// (es un editor pesado, con ICA municipio por municipio) y se llega por enlace.

import { useCallback, useEffect, useState } from 'react';

type Config = {
  ivaPeriodicidad: string | null; consumoPeriodicidad: string | null; rentaTipo: string | null;
  anticipoRstPeriodicidad: string | null; retencionFuente: boolean; fopat: boolean;
  nominaElectronica: boolean; seguridadSocial: boolean;
} | null;
type Ica = {
  id: string; municipio: string | null; departamento: string | null;
  icaPeriodicidad: string | null; reteica: boolean; reteicaPeriodicidad: string | null;
  autoica: boolean; autoicaPeriodicidad: string | null;
};
type Datos = {
  anio: number; tipo: string | null; config: Config; ica: Ica[];
  rub: { aplica: boolean; cargados: number; estado: 'sin_tipo' | 'tipo_no_obligado' | 'falta_regenerar' | 'ok' };
  vencimientos: { obligacion: string; n: number }[];
  puedeAdministrar: boolean;
};

// Mismas etiquetas que el editor de Config. tributaria: si al usuario le
// mostramos "anual_rst" aquí y "Anual (RST)" allá, parecen cosas distintas.
const IVA: Record<string, string> = { bimestral: 'Bimestral', cuatrimestral: 'Cuatrimestral', anual_rst: 'Anual (RST)' };
const CONSUMO: Record<string, string> = { bimestral: 'Bimestral', anual_rst: 'Anual (RST)' };
const RENTA: Record<string, string> = {
  persona_juridica: 'Persona jurídica', persona_natural: 'Persona natural',
  gran_contribuyente: 'Gran contribuyente', rst_consolidada: 'RST consolidada',
};
const PER: Record<string, string> = { mensual: 'Mensual', bimestral: 'Bimestral', cuatrimestral: 'Cuatrimestral', anual: 'Anual', anual_rst: 'Anual (RST)' };

const RUB_EST: Record<Datos['rub']['estado'], { texto: string; color: string; queHacer: string | null }> = {
  ok: { texto: 'Con RUB', color: 'var(--exito)', queHacer: null },
  falta_regenerar: {
    texto: 'Falta regenerar', color: 'var(--info)',
    queHacer: 'Le aplica el RUB pero no lo tiene cargado. Regenera sus vencimientos desde Config. tributaria.',
  },
  sin_tipo: {
    texto: 'Sin tipo de empresa', color: 'var(--peligro)',
    queHacer: 'Sin el tipo de empresa no se puede saber si le aplica el RUB — ni las reglas que dependen de la naturaleza jurídica. Asígnaselo en Administración → Empresas y luego regenera sus vencimientos.',
  },
  tipo_no_obligado: {
    texto: 'No obligado al RUB', color: 'var(--muted)',
    queHacer: null,
  },
};

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 3 };

function Dato({ etiqueta, valor, apagado }: { etiqueta: string; valor: string; apagado?: boolean }) {
  return (
    <div>
      <span style={lbl}>{etiqueta}</span>
      <div style={{ fontSize: 13, fontWeight: apagado ? 400 : 600, color: apagado ? 'var(--muted)' : 'var(--ink)' }}>{valor}</div>
    </div>
  );
}

export default function SituacionTributaria({ empresaId }: { empresaId: string }) {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/ficha/${empresaId}/tributaria`, { cache: 'no-store' }).then((x) => x.json());
      if (r.error) setError(r.error); else { setD(r); setError(null); }
    } catch { setError('Error de red.'); }
  }, [empresaId]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div className="panel" style={{ padding: '12px 15px', marginBottom: 16, color: 'var(--peligro-fuerte)', background: 'var(--peligro-suave)', borderColor: 'var(--peligro-borde)', fontWeight: 600 }}>{error}</div>;
  if (!d) return <div className="panel" style={{ padding: 20, marginBottom: 16, color: 'var(--muted)' }}>Cargando…</div>;

  const c = d.config;
  const rub = RUB_EST[d.rub.estado];
  const totalVenc = d.vencimientos.reduce((s, v) => s + v.n, 0);

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        Situación tributaria
        <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>
          vencimientos {d.anio}
        </span>
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        {/* Estado del RUB: la razón por la que esta sección existe. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: rub.queHacer ? 8 : 16 }}>
          <span style={lbl}>RUB</span>
          <span className="chip" style={{ color: rub.color, borderColor: rub.color }}>{rub.texto}</span>
          {d.rub.aplica && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{d.rub.cargados} vencimiento(s) cargado(s)</span>}
        </div>
        {rub.queHacer && (
          <div style={{
            padding: '10px 13px', marginBottom: 16, borderRadius: 6, fontSize: 12.5, lineHeight: 1.6,
            background: d.rub.estado === 'sin_tipo' ? 'var(--peligro-suave)' : 'var(--info-suave)',
            color: d.rub.estado === 'sin_tipo' ? 'var(--peligro-fuerte)' : 'var(--info-fuerte)',
          }}>{rub.queHacer}</div>
        )}

        {/* Responsabilidades configuradas */}
        {!c ? (
          <div style={{ padding: '10px 13px', marginBottom: 16, borderRadius: 6, background: 'var(--alerta-suave)', color: 'var(--alerta-fuerte)', fontSize: 12.5, lineHeight: 1.6 }}>
            Este cliente <strong>no tiene configuración tributaria</strong>, así que no se le generan vencimientos
            nacionales. Se define en <em>Administración → Config. tributaria</em>.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
            <Dato etiqueta="IVA" valor={c.ivaPeriodicidad ? (IVA[c.ivaPeriodicidad] ?? c.ivaPeriodicidad) : 'No responsable'} apagado={!c.ivaPeriodicidad} />
            <Dato etiqueta="Impuesto al consumo" valor={c.consumoPeriodicidad ? (CONSUMO[c.consumoPeriodicidad] ?? c.consumoPeriodicidad) : 'No responsable'} apagado={!c.consumoPeriodicidad} />
            <Dato etiqueta="Renta" valor={c.rentaTipo ? (RENTA[c.rentaTipo] ?? c.rentaTipo) : 'No aplica'} apagado={!c.rentaTipo} />
            <Dato etiqueta="Anticipo RST" valor={c.anticipoRstPeriodicidad ? (PER[c.anticipoRstPeriodicidad] ?? c.anticipoRstPeriodicidad) : 'No aplica'} apagado={!c.anticipoRstPeriodicidad} />
            <Dato etiqueta="Retención en la fuente" valor={c.retencionFuente ? 'Agente retenedor' : 'No'} apagado={!c.retencionFuente} />
            <Dato etiqueta="FOPAT" valor={c.fopat ? 'Agente retenedor' : 'No'} apagado={!c.fopat} />
            <Dato etiqueta="Nómina electrónica" valor={c.nominaElectronica ? 'Sí' : 'No'} apagado={!c.nominaElectronica} />
            <Dato etiqueta="Seguridad social · PILA" valor={c.seguridadSocial ? 'Sí' : 'No'} apagado={!c.seguridadSocial} />
          </div>
        )}

        {/* ICA por municipio */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ ...lbl, marginBottom: 6 }}>ICA por municipio</span>
          {d.ica.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Sin municipios de ICA.</div>
          ) : (
            <div className="dt-wrap">
              <table className="dt">
                <thead><tr><th>Municipio</th><th>ICA</th><th>ReteICA</th><th>AutoICA</th></tr></thead>
                <tbody>
                  {d.ica.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>
                        {m.municipio ?? '—'}
                        {m.departamento && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {m.departamento}</span>}
                      </td>
                      <td style={{ color: m.icaPeriodicidad ? 'var(--ink)' : 'var(--muted)' }}>{m.icaPeriodicidad ? (PER[m.icaPeriodicidad] ?? m.icaPeriodicidad) : '—'}</td>
                      <td style={{ color: m.reteica ? 'var(--ink)' : 'var(--muted)' }}>{m.reteica ? (m.reteicaPeriodicidad ? (PER[m.reteicaPeriodicidad] ?? m.reteicaPeriodicidad) : 'Sí') : '—'}</td>
                      <td style={{ color: m.autoica ? 'var(--ink)' : 'var(--muted)' }}>{m.autoica ? (m.autoicaPeriodicidad ? (PER[m.autoicaPeriodicidad] ?? m.autoicaPeriodicidad) : 'Sí') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lo que la configuración produjo: el contraste entre lo que debería
            tener y lo que tiene. Es donde se ve una obligación que falta. */}
        <div>
          <span style={{ ...lbl, marginBottom: 6 }}>Vencimientos {d.anio} · {totalVenc} en total</span>
          {d.vencimientos.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Sin vencimientos generados para {d.anio}.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {d.vencimientos.map((v) => (
                <span key={v.obligacion} className="chip" style={{ borderColor: 'var(--edge-strong)', color: 'var(--ink)', fontWeight: 500 }}>
                  {v.obligacion} <strong style={{ color: 'var(--muted)' }}>· {v.n}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {d.puedeAdministrar && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a href="/administracion?tab=config-tributaria" className="dbtn" style={{ textDecoration: 'none', fontSize: 12.5 }}>Editar configuración y regenerar →</a>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Regenerar rehace los vencimientos según la configuración; te muestra qué va a crear y qué va a eliminar antes de confirmar.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
