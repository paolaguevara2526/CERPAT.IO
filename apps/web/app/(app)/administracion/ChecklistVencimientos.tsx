'use client';
// Diagnóstico del checklist de los vencimientos.
//
// El checklist de un vencimiento no se escribe en el vencimiento: se HEREDA de
// la actividad del plan vinculada a esa obligación (pestaña "Cat. Tareas"),
// copiando sus subtareas. Por eso, cuando falta, puede ser por tres razones
// distintas y no se sabe cuál sin verlas. Esta pantalla las separa y dice qué
// hacer en cada caso.

import { useCallback, useEffect, useState } from 'react';

type Fila = {
  key: string; obligacion: string; actividad: string | null;
  subtareasPlantilla: number; vencimientos: number; sinChecklist: number; sinResponsable: number;
  diagnostico: 'sin_actividad_vinculada' | 'actividad_sin_checklist' | 'pendiente_de_rellenar' | 'ok';
};
type Totales = { sinChecklist: number; sinResponsable: number; porAplicar: number };

const DIAG: Record<Fila['diagnostico'], { texto: string; color: string; queHacer: string }> = {
  ok: { texto: 'Al día', color: 'var(--exito)', queHacer: '—' },
  pendiente_de_rellenar: {
    texto: 'Falta aplicar', color: 'var(--info)',
    queHacer: 'Está bien configurado, pero estos vencimientos se crearon antes. Se arregla con el botón de abajo.',
  },
  actividad_sin_checklist: {
    texto: 'Actividad sin checklist', color: 'var(--alerta)',
    queHacer: 'La actividad está vinculada pero no tiene subtareas. Agrégalas en "Cat. Tareas".',
  },
  sin_actividad_vinculada: {
    texto: 'Sin actividad vinculada', color: 'var(--peligro)',
    queHacer: 'Ninguna actividad del plan está vinculada a esta obligación. Vincúlala en "Cat. Tareas".',
  },
};

export default function ChecklistVencimientos() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const d = await fetch('/api/vencimientos/checklist/diagnostico', { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error); else { setFilas(d.filas ?? []); setTotales(d.totales ?? null); setError(null); }
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function rellenar(dryRun: boolean) {
    setTrabajando(true); setResultado(null); setError(null);
    try {
      const r = await fetch('/api/vencimientos/checklist/rellenar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo aplicar.'); setTrabajando(false); return; }
      // El botón hace DOS cosas —checklist y responsable— y antes solo contaba
      // el checklist: cuando lo único que faltaba era el responsable, decía "no
      // hay nada pendiente" y quien lo usaba se iba creyendo que ya estaba.
      const n = d.resumen?.conChecklist ?? 0;
      const r2 = d.resumen?.conResponsable ?? 0;
      const huerfanos = d.resumen?.sinDueno ?? 0;
      const partes = [
        n ? `checklist a ${n}` : '',
        r2 ? `responsable a ${r2}` : '',
      ].filter(Boolean).join(' y ');
      // Los que quedan sin dueño se dicen SIEMPRE, aunque no se haya cambiado
      // nada: es el trabajo que hoy no le aparece a nadie en Mi Día.
      const aviso = huerfanos ? ` Quedan ${huerfanos} sin responsable: son empresas con varios asesores y el área de esa obligación sin asignar.` : '';
      setResultado(
        (!n && !r2
          ? 'No hay vencimientos pendientes de checklist ni de responsable.'
          : dryRun
            ? `Se aplicaría ${partes}.`
            : `Listo: aplicado ${partes}.`) + aviso,
      );
      if (!dryRun) cargar();
    } catch { setError('Error de red.'); }
    setTrabajando(false);
  }

  const porAplicar = totales?.porAplicar ?? filas.reduce((s, f) => s + (f.diagnostico === 'pendiente_de_rellenar' ? f.sinChecklist : 0), 0);
  const sinResponsable = totales?.sinResponsable ?? filas.reduce((s, f) => s + f.sinResponsable, 0);
  const porParametrizar = filas.filter((f) => f.diagnostico === 'sin_actividad_vinculada' || f.diagnostico === 'actividad_sin_checklist').length;
  // El botón aplica DOS cosas. Habilitarlo solo por el checklist dejaba sin
  // arreglo el caso en que lo único que falta es el responsable — que es el que
  // deja trabajo sin aparecer en el Mi Día de nadie.
  const hayAlgoQueAplicar = porAplicar > 0 || sinResponsable > 0;

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Checklist de los vencimientos</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 16px', maxWidth: 760, lineHeight: 1.6 }}>
        Cada vencimiento hereda su checklist de la <strong>actividad del plan</strong> vinculada a esa obligación
        (pestaña <em>Cat. Tareas</em>). Aquí ves obligación por obligación si está configurado y, si no, qué falta.
      </p>

      {error && <div className="panel" style={{ padding: '10px 14px', color: 'var(--peligro-fuerte)', background: 'var(--peligro-suave)', borderColor: 'var(--peligro-borde)', fontWeight: 600, marginBottom: 14 }}>{error}</div>}

      <div className="panel">
        <div className="dt-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>Obligación</th><th>Actividad vinculada</th>
                <th style={{ textAlign: 'right' }}>Subtareas</th>
                <th style={{ textAlign: 'right' }}>Vencimientos</th>
                <th style={{ textAlign: 'right' }}>Sin checklist</th>
                <th style={{ textAlign: 'right' }} title="Vencimientos sin asesor responsable: no le aparecen a nadie en Mi Día">Sin responsable</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
              ) : filas.map((f) => {
                const d = DIAG[f.diagnostico];
                return (
                  <tr key={f.key}>
                    <td style={{ fontWeight: 600 }}>{f.obligacion}</td>
                    <td style={{ color: 'var(--muted)' }}>{f.actividad ?? <em>ninguna</em>}</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{f.subtareasPlantilla || '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{f.vencimientos || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: f.sinChecklist ? 800 : 400, color: f.sinChecklist ? d.color : 'var(--muted)' }}>{f.sinChecklist || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: f.sinResponsable ? 800 : 400, color: f.sinResponsable ? 'var(--peligro)' : 'var(--muted)' }}
                      title={f.sinResponsable ? 'Estos vencimientos no le aparecen a nadie en Mi Día' : undefined}>{f.sinResponsable || '—'}</td>
                    <td><span className="chip" style={{ color: d.color, borderColor: d.color }} title={d.queHacer}>{d.texto}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!cargando && (
        <div className="panel" style={{ marginTop: 14, padding: '14px 16px' }}>
          {porParametrizar > 0 && (
            <p style={{ fontSize: 13, margin: '0 0 10px', lineHeight: 1.6 }}>
              <strong>{porParametrizar} obligación(es)</strong> no tienen checklist configurado todavía. Eso se arregla
              en <em>Cat. Tareas</em>: vincula la actividad a la obligación y dale sus subtareas. Aquí no se puede
              inventar un checklist que nadie ha definido.
            </p>
          )}
          <p style={{ fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
            {porAplicar > 0
              ? <>Hay <strong>{porAplicar} vencimiento(s)</strong> que ya tienen su checklist definido pero se crearon antes de configurarlo.</>
              : <>Todos los vencimientos con checklist definido ya lo tienen aplicado.</>}
          </p>
          {/* El responsable se informa aparte del checklist: son problemas
              distintos y el de arriba es el cosmético. Un vencimiento sin dueño
              no le aparece a nadie en Mi Día — eso es trabajo que nadie está
              viendo, y hay obligaciones (FOPAT, PILA, AutoICA) que no tienen
              actividad vinculada y aun así SÍ se les puede resolver el
              responsable por la empresa. */}
          {sinResponsable > 0 && (
            <p style={{ fontSize: 13, margin: '0 0 12px', lineHeight: 1.6, color: 'var(--peligro-fuerte)' }}>
              Hay <strong>{sinResponsable} vencimiento(s) sin responsable</strong>: hoy no le aparecen a nadie en <em>Mi Día</em>.
              El botón les asigna el asesor del área de la obligación y, si esa no se puede resolver, el de la empresa cuando
              tiene uno solo. Los que queden son empresas con <strong>varios asesores</strong> y esa área sin asignar: se
              arreglan en <em>Asignaciones</em>.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="dbtn" onClick={() => rellenar(true)} disabled={trabajando} style={{ fontSize: 13 }}>
              Simular
            </button>
            <button className="dbtn green" onClick={() => rellenar(false)} disabled={trabajando || !hayAlgoQueAplicar} style={{ fontSize: 13 }}>
              {trabajando ? 'Aplicando…' : 'Aplicar checklist y responsables'}
            </button>
            {resultado && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{resultado}</span>}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '12px 0 0', lineHeight: 1.6 }}>
            Esta acción <strong>solo agrega</strong>: no borra ni desmarca nada. Es distinta de
            «Regenerar vencimientos», que sí puede dar de baja obligaciones que la configuración ya no contemple.
          </p>
        </div>
      )}
    </div>
  );
}
