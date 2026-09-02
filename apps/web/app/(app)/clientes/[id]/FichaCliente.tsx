'use client';
// Hoja de vida del cliente: identificación + tres listas (actividades económicas,
// representantes legales y registros de cámara de comercio).
//
// ⚠ No hay campos de usuario ni contraseña, a propósito. Guardar credenciales de
// los clientes convertiría una filtración de la base en una filtración de SUS
// cuentas, bajo custodia de la firma. Se registra QUIÉN tiene el acceso y DÓNDE
// está la clave (gestor de contraseñas), nunca la clave.

import { useCallback, useEffect, useState } from 'react';
import ObligacionesCliente from './ObligacionesCliente';
import SituacionTributaria from './SituacionTributaria';
import PickerCiiu from './PickerCiiu';
import { finDeContrato, fechasCoherentes, estadoContrato, diasParaVencer } from '@/lib/contrato';

type Actividad = { id: string; codigo: string; descripcion: string | null; principal: boolean; orden: number };
type Representante = { id: string; nombre: string; documento: string | null; cargo: string | null; principal: boolean; desde: string | null; hasta: string | null; email: string | null; telefono: string | null };
type Camara = { id: string; camara: string; matricula: string | null; ubicacionClave: string | null; notas: string | null; responsable: { id: string; nombre: string } | null };
type Opcion = { id: string; nombre: string };
type Ficha = {
  id: string; nombre: string; nit: string | null; activo: boolean; servicio: string | null;
  direccion: string | null; emailDian: string | null; telefonoDian: string | null;
  emailCamara: string | null; telefonoCamara: string | null; fechaConstitucion: string | null;
  // horasPactadasMes viaja como número del servidor y como texto mientras se
  // edita: el input entrega cadenas.
  contratoDesde: string | null; mesesContrato: number | string | null; contratoHasta: string | null;
  horasPactadasMes: number | string | null; alcanceServicio: string | null;
  tipoId: string | null; regimenId: string | null;
  tipo: { nombre: string } | null; regimen: { nombre: string } | null;
  municipio: { nombre: string; departamento: string | null } | null;
  actividadesEconomicas: Actividad[]; representantes: Representante[]; registrosCamara: Camara[];
};

const inp: React.CSSProperties = {
  padding: '7px 9px', borderRadius: 5, border: '1px solid var(--edge-strong)',
  background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 4 };
const soloFecha = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
// Hoy en día calendario local. No sirve toISOString(): en Colombia devolvería
// el día siguiente después de las 7 p.m., y un contrato aparecería vencido una
// tarde antes de tiempo.
const hoyISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function FichaCliente({ empresaId }: { empresaId: string }) {
  const [f, setF] = useState<Ficha | null>(null);
  const [tipos, setTipos] = useState<Opcion[]>([]);
  const [regimenes, setRegimenes] = useState<Opcion[]>([]);
  const [editable, setEditable] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const d = await fetch(`/api/ficha/${empresaId}`, { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error); else { setF(d.ficha); setEditable(!!d.editable); setError(null); }
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, [empresaId]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch('/api/ficha/catalogos', { cache: 'no-store' }).then((r) => r.json())
      .then((d) => { setTipos(d.tipos ?? []); setRegimenes(d.regimenes ?? []); }).catch(() => {});
  }, []);

  async function guardarDatos() {
    if (!f) return;
    setError(null);
    const r = await fetch(`/api/ficha/${empresaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direccion: f.direccion, emailDian: f.emailDian, telefonoDian: f.telefonoDian,
        emailCamara: f.emailCamara, telefonoCamara: f.telefonoCamara,
        fechaConstitucion: soloFecha(f.fechaConstitucion),
        contratoDesde: soloFecha(f.contratoDesde),
        mesesContrato: f.mesesContrato ?? '',
        contratoHasta: soloFecha(f.contratoHasta),
        horasPactadasMes: f.horasPactadasMes ?? '',
        alcanceServicio: f.alcanceServicio ?? '',
        tipoId: f.tipoId ?? '', regimenId: f.regimenId ?? '',
      }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo guardar.'); return; }
    setOk(true); setTimeout(() => setOk(false), 1600);
    // El tipo cambia lo que la ficha calcula (RUB, revisor fiscal, 368-2), así
    // que se recarga para que lo de abajo deje de contradecir a lo de arriba.
    cargar();
  }

  async function agregar(lista: string, datos: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/ficha/${empresaId}/${lista}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo agregar.'); return false; }
    cargar(); return true;
  }
  async function borrar(lista: string, id: string, que: string) {
    if (!confirm(`¿Eliminar ${que}?`)) return;
    const r = await fetch(`/api/ficha/${lista}/${id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); return; }
    cargar();
  }

  // Sin genéricos: en .tsx una función flecha genérica se confunde con JSX.
  const set = (k: keyof Ficha, v: string) => setF((p) => (p ? ({ ...p, [k]: v } as Ficha) : p));

  if (cargando) return <div className="panel" style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>;
  if (error && !f) return <div className="panel" style={{ padding: '16px 18px', color: 'var(--peligro-fuerte)', background: 'var(--peligro-suave)', borderColor: 'var(--peligro-borde)', fontWeight: 600 }}>{error}</div>;
  if (!f) return null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 2 }}>
        <a href="/clientes" className="dbtn" style={{ textDecoration: 'none', fontSize: 12.5 }}>‹ Clientes</a>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{f.nombre}</h1>
        {!f.activo && <span className="chip" style={{ color: 'var(--neutro)', borderColor: 'var(--neutro)' }}>inactivo</span>}
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 18px' }}>
        NIT {f.nit ?? '—'} · {f.tipo?.nombre ?? 'sin tipo de empresa'}
        {f.regimen?.nombre ? ` · ${f.regimen.nombre}` : ''}
        {f.servicio ? ` · ${f.servicio}` : ''}
      </p>

      {error && <div className="panel" style={{ padding: '10px 14px', color: 'var(--peligro-fuerte)', background: 'var(--peligro-suave)', borderColor: 'var(--peligro-borde)', fontWeight: 600, marginBottom: 14 }}>{error}</div>}

      {/* ---- Identificación y notificación ---- */}
      <div className="panel" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div className="panel-head" style={{ margin: '-16px -18px 14px', borderRadius: '10px 10px 0 0' }}>Identificación y notificación</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Los correos de notificación son los <strong>registrados ante cada entidad</strong>, que no siempre
          coinciden con los de contacto del día a día.
        </p>
        {editable && !f.tipoId && (
          <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.6, marginBottom: 14 }}>
            <strong>Falta el tipo de empresa.</strong> De él sale la naturaleza jurídica, y de ella dependen
            el <strong>RUB</strong>, el <strong>revisor fiscal</strong> y el <strong>art. 368-2</strong>: mientras
            falte, esas reglas no se evalúan. Asígnalo abajo y después regenera sus vencimientos.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          {/* Tipo y régimen se editan aquí, no solo en Administración: quien ve
              el hueco es quien está revisando la ficha del cliente. */}
          <div>
            <span style={lbl}>Tipo de empresa</span>
            <select style={{ ...inp, ...(f.tipoId ? {} : { borderColor: 'var(--peligro-borde)' }) }} disabled={!editable}
              value={f.tipoId ?? ''} onChange={(e) => set('tipoId', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Régimen tributario</span>
            <select style={inp} disabled={!editable} value={f.regimenId ?? ''} onChange={(e) => set('regimenId', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {regimenes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Dirección física</span><input style={inp} disabled={!editable} value={f.direccion ?? ''} onChange={(e) => set('direccion', e.target.value)} /></div>
          <div><span style={lbl}>Fecha de constitución</span><input type="date" style={inp} disabled={!editable} value={soloFecha(f.fechaConstitucion)} onChange={(e) => set('fechaConstitucion', e.target.value)} /></div>
          <div><span style={lbl}>Municipio</span><input style={{ ...inp, background: 'var(--panel-2)' }} disabled value={f.municipio ? `${f.municipio.nombre}${f.municipio.departamento ? ` · ${f.municipio.departamento}` : ''}` : '—'} /></div>
          <div><span style={lbl}>Correo notificación DIAN</span><input style={inp} disabled={!editable} value={f.emailDian ?? ''} onChange={(e) => set('emailDian', e.target.value)} /></div>
          <div><span style={lbl}>Teléfono DIAN</span><input style={inp} disabled={!editable} value={f.telefonoDian ?? ''} onChange={(e) => set('telefonoDian', e.target.value)} /></div>
          <div><span style={lbl}>Correo notificación cámara</span><input style={inp} disabled={!editable} value={f.emailCamara ?? ''} onChange={(e) => set('emailCamara', e.target.value)} /></div>
          <div><span style={lbl}>Teléfono cámara</span><input style={inp} disabled={!editable} value={f.telefonoCamara ?? ''} onChange={(e) => set('telefonoCamara', e.target.value)} /></div>
        </div>
        {editable && (
          <div style={{ marginTop: 14 }}>
            <button className="dbtn primary" onClick={guardarDatos} style={{ fontSize: 13 }}>{ok ? '✓ Guardado' : 'Guardar'}</button>
          </div>
        )}
      </div>

      {/* Contrato de servicio. Es el OTRO LADO de la medición de horas: el acta
          de cada visita dice cuántas se ejecutaron, pero sin lo pactado no se
          puede decir si se cumple. Cada cliente tiene lo suyo, por eso vive en
          su ficha y no en un catálogo por servicio.
          Se guarda con el mismo botón de arriba: es la misma ficha. */}
      <div className="panel" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div className="panel-head" style={{ margin: '-16px -18px 14px', borderRadius: '10px 10px 0 0' }}>Contrato de servicio</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <div>
            <span style={lbl}>Fecha inicial del contrato</span>
            <input type="date" style={inp} disabled={!editable} value={soloFecha(f.contratoDesde)} onChange={(e) => set('contratoDesde', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Meses del contrato</span>
            <input type="number" min={1} step={1} inputMode="numeric" style={inp} disabled={!editable}
              value={f.mesesContrato ?? ''} placeholder="Ej. 12"
              onChange={(e) => {
                const meses = e.target.value;
                // La terminación se PROPONE a partir del plazo, y solo si está
                // vacía: si ya hay una fecha guardada manda esa, porque una
                // prórroga puede terminar donde no cuadra con la aritmética.
                const propuesta = !soloFecha(f.contratoHasta) ? finDeContrato(soloFecha(f.contratoDesde), meses) : null;
                setF((p) => (p ? { ...p, mesesContrato: meses, ...(propuesta ? { contratoHasta: propuesta } : {}) } : p));
              }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
              Al escribirlo se propone la fecha de terminación, si está vacía.
            </span>
          </div>
          <div>
            <span style={lbl}>Fecha de terminación</span>
            <input type="date" style={inp} disabled={!editable} value={soloFecha(f.contratoHasta)} onChange={(e) => set('contratoHasta', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Horas pactadas al mes</span>
            <input type="number" min={0} step={0.5} inputMode="decimal" style={inp} disabled={!editable}
              value={f.horasPactadasMes ?? ''} onChange={(e) => set('horasPactadasMes', e.target.value)} placeholder="Ej. 8" />
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
              Son horas por mes. Contra esto se comparan las de las visitas y reuniones del mes.
            </span>
          </div>
        </div>

        {/* Vigencia. Avisa antes de que se venza, que es cuando todavía se
            puede renovar; después ya se está atendiendo sin papel vigente. */}
        {(() => {
          const hasta = soloFecha(f.contratoHasta);
          const estado = estadoContrato(hasta, hoyISO());
          const dias = diasParaVencer(hasta, hoyISO());
          const coherente = fechasCoherentes(soloFecha(f.contratoDesde), f.mesesContrato, hasta);
          const calculada = finDeContrato(soloFecha(f.contratoDesde), f.mesesContrato);
          if (estado === 'sin_fecha' && coherente) return null;
          const tono = estado === 'vencido'
            ? { color: 'var(--peligro-fuerte)', background: 'var(--peligro-suave)', borderColor: 'var(--peligro-borde)' }
            : estado === 'por_vencer'
              ? { color: 'var(--alerta-fuerte)', background: 'var(--alerta-suave)', borderColor: 'var(--alerta-borde)' }
              : { color: 'var(--muted)', background: 'var(--panel-2)', borderColor: 'var(--edge)' };
          return (
            <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 6, border: '1px solid', fontSize: 12.5, lineHeight: 1.6, ...tono }}>
              {estado === 'vencido' && <div><strong>⚠ Contrato vencido</strong> hace {Math.abs(dias ?? 0)} día{Math.abs(dias ?? 0) === 1 ? '' : 's'}.</div>}
              {estado === 'por_vencer' && <div><strong>⏳ Vence en {dias} día{dias === 1 ? '' : 's'}.</strong> Es el momento de renovar o prorrogar.</div>}
              {estado === 'vigente' && <div>✓ Vigente. Faltan {dias} días para la terminación.</div>}
              {!coherente && (
                // No se corrige sola: si el papel dice otra cosa, manda el papel.
                <div style={{ marginTop: estado === 'sin_fecha' ? 0 : 6 }}>
                  La fecha de terminación no cuadra con el plazo: {f.mesesContrato} meses desde el inicio
                  darían el <strong>{calculada}</strong>. Si es una prórroga, déjala como está.
                </div>
              )}
            </div>
          );
        })()}
        <div style={{ marginTop: 12 }}>
          <span style={lbl}>Alcance del servicio</span>
          <textarea style={{ ...inp, minHeight: 92, resize: 'vertical', lineHeight: 1.5 }} disabled={!editable}
            value={f.alcanceServicio ?? ''} onChange={(e) => set('alcanceServicio', e.target.value)}
            placeholder="Qué cubre el acompañamiento: áreas, entregables, periodicidad, lo que queda por fuera…" />
        </div>
        {editable && (
          <div style={{ marginTop: 14 }}>
            <button className="dbtn primary" onClick={guardarDatos} style={{ fontSize: 13 }}>{ok ? '✓ Guardado' : 'Guardar'}</button>
          </div>
        )}
      </div>

      <SituacionTributaria empresaId={empresaId} />

      <ObligacionesCliente empresaId={empresaId} />

      <Lista
        titulo="Actividades económicas (CIIU)"
        nota="La principal va de primera. Puedes registrar todas las que tenga el cliente."
        editable={editable}
        filas={f.actividadesEconomicas}
        columnas={[['Código', (a: Actividad) => <span style={{ fontFamily: 'var(--mono)' }}>{a.codigo}</span>], ['Descripción', (a: Actividad) => a.descripcion ?? '—'], ['', (a: Actividad) => (a.principal ? <span className="chip" style={{ color: 'var(--exito)', borderColor: 'var(--exito)' }}>principal</span> : null)]]}
        // 'ciiu' abre el buscador de la nomenclatura del DANE y llena de paso
        // la descripción, que es el cuarto elemento de la tupla.
        campos={[['codigo', 'Código CIIU', 'ciiu', 'descripcion'], ['descripcion', 'Descripción', 'text'], ['principal', '¿Es la principal?', 'check']]}
        onAgregar={(d) => agregar('actividades', d)}
        onBorrar={(id, n) => borrar('actividades', id, `la actividad ${n}`)}
        nombreDe={(a: Actividad) => a.codigo}
      />

      <Lista
        titulo="Representantes legales"
        nota="Principal, suplentes y apoderados, con su vigencia. Dejar «hasta» vacío significa vigente."
        editable={editable}
        filas={f.representantes}
        columnas={[['Nombre', (r: Representante) => r.nombre], ['Documento', (r: Representante) => r.documento ?? '—'], ['Cargo', (r: Representante) => r.cargo ?? '—'], ['Vigencia', (r: Representante) => `${soloFecha(r.desde) || '—'} → ${soloFecha(r.hasta) || 'vigente'}`]]}
        campos={[['nombre', 'Nombre completo', 'text'], ['documento', 'Documento', 'text'], ['cargo', 'Cargo', 'text'], ['desde', 'Desde', 'date'], ['hasta', 'Hasta (vacío = vigente)', 'date'], ['email', 'Correo', 'text'], ['telefono', 'Teléfono', 'text'], ['principal', '¿Es el principal?', 'check']]}
        onAgregar={(d) => agregar('representantes', d)}
        onBorrar={(id, n) => borrar('representantes', id, `a ${n}`)}
        nombreDe={(r: Representante) => r.nombre}
      />

      <Lista
        titulo="Cámaras de comercio"
        nota="⚠ Sin usuario ni contraseña, a propósito: guardar credenciales de los clientes convertiría una filtración de la base en una filtración de sus cuentas. Se registra quién tiene el acceso y dónde está la clave."
        editable={editable}
        filas={f.registrosCamara}
        columnas={[['Cámara', (c: Camara) => c.camara], ['Matrícula', (c: Camara) => c.matricula ?? '—'], ['Acceso a cargo de', (c: Camara) => c.responsable?.nombre ?? '—'], ['Clave guardada en', (c: Camara) => c.ubicacionClave ?? '—']]}
        campos={[['camara', 'Cámara de comercio', 'text'], ['matricula', 'Matrícula mercantil', 'text'], ['ubicacionClave', 'Dónde está la clave (p. ej. Bitwarden · bóveda Clientes)', 'text'], ['notas', 'Notas', 'text']]}
        onAgregar={(d) => agregar('camaras', d)}
        onBorrar={(id, n) => borrar('camaras', id, `el registro de ${n}`)}
        nombreDe={(c: Camara) => c.camara}
      />
    </>
  );
}

// Bloque genérico para las tres listas de la ficha: tabla + formulario de alta.
function Lista<T extends { id: string }>({ titulo, nota, editable, filas, columnas, campos, onAgregar, onBorrar, nombreDe }: {
  titulo: string; nota: string; editable: boolean; filas: T[];
  columnas: [string, (f: T) => React.ReactNode][];
  /** [clave, etiqueta, tipo, claveAcompañante] — la última solo la usa 'ciiu'. */
  campos: [string, string, 'text' | 'date' | 'check' | 'ciiu', string?][];
  onAgregar: (datos: Record<string, unknown>) => Promise<boolean>;
  onBorrar: (id: string, nombre: string) => void;
  nombreDe: (f: T) => string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">{titulo}</div>
      <div style={{ padding: '12px 16px 16px' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.6 }}>{nota}</p>
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr>{columnas.map(([h]) => <th key={h}>{h}</th>)}{editable && <th style={{ width: 44 }} />}</tr></thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={columnas.length + (editable ? 1 : 0)} style={{ padding: 22, textAlign: 'center', color: 'var(--muted)' }}>Sin registros.</td></tr>
              ) : filas.map((f) => (
                <tr key={f.id}>
                  {columnas.map(([h, get]) => <td key={h}>{get(f)}</td>)}
                  {editable && <td><button className="dbtn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onBorrar(f.id, nombreDe(f))}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editable && (abierto ? (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              {campos.map(([k, etiqueta, tipo, acompanante]) => (
                <div key={k}>
                  <span style={lbl}>{etiqueta}</span>
                  {tipo === 'check' ? (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!form[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.checked }))} style={{ accentColor: 'var(--navy)' }} /> Sí
                    </label>
                  ) : tipo === 'ciiu' ? (
                    <PickerCiiu
                      estilo={inp}
                      valor={String(form[k] ?? '')}
                      descripcion={String(form[acompanante ?? ''] ?? '')}
                      onElegir={(codigo, desc) => setForm((p) => ({ ...p, [k]: codigo, ...(acompanante ? { [acompanante]: desc } : {}) }))}
                    />
                  ) : (
                    <input type={tipo} style={inp} value={String(form[k] ?? '')} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="dbtn green" style={{ fontSize: 13 }} onClick={async () => { if (await onAgregar(form)) { setForm({}); setAbierto(false); } }}>Agregar</button>
              <button className="dbtn" style={{ fontSize: 13 }} onClick={() => { setForm({}); setAbierto(false); }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button className="dbtn" style={{ fontSize: 12.5, marginTop: 12 }} onClick={() => setAbierto(true)}>+ Agregar</button>
        ))}
      </div>
    </div>
  );
}
