'use client';
// Navegador de mes del plan de trabajo.
//
// El backend siempre supo servir cualquier período —casi todos los endpoints del
// plan aceptan ?periodo=—, pero ninguna pantalla tenía cómo pedirlo: generado
// septiembre, agosto quedaba fuera de alcance aunque estuviera completo en la
// base. Un plan mensual del que solo se ve el mes en curso no deja hacer lo que
// se hace al cerrar el mes: revisar qué pasó.
//
// Escribe el período en la URL (?periodo=YYYY-MM) y no en un estado interno, así
// que el mes que estás viendo se puede compartir, marcar y recargar.

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { nombrePeriodo, periodoAnterior, periodoSiguiente, periodoDeHoy, avisoPeriodo, periodoAMostrar } from '@/lib/periodo';

const btn: React.CSSProperties = {
  border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)',
  borderRadius: 5, padding: '5px 10px', fontSize: 13, fontFamily: 'var(--ui)', cursor: 'pointer', lineHeight: 1.2,
};

export default function NavegadorPeriodo({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hoy = periodoDeHoy();
  const actual = periodoAMostrar(params.get('periodo'), hoy);
  const [conPlan, setConPlan] = useState<Set<string> | null>(null);

  // Qué meses tienen plan generado. Si la consulta falla no se bloquea nada: se
  // deja navegar a ciegas, que es mejor que quedarse sin poder moverse.
  useEffect(() => {
    fetch('/api/plan/periodos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setConPlan(new Set((d.periodos ?? []).map((p: { periodo: string }) => p.periodo))))
      .catch(() => setConPlan(null));
  }, []);

  const ir = (p: string | null) => {
    if (!p) return;
    const q = new URLSearchParams(params.toString());
    if (p === hoy) q.delete('periodo'); else q.set('periodo', p);
    const qs = q.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const anterior = periodoAnterior(actual);
  const siguiente = periodoSiguiente(actual);
  const aviso = avisoPeriodo(actual, hoy);
  const vacio = conPlan !== null && !conPlan.has(actual);
  // "Sin plan" se dice del mes que se está viendo, no del botón: adivinar que el
  // mes de al lado está vacío antes de entrar solo sirve para que la flecha
  // parezca dañada.
  const marcaVacio = (p: string | null) => (p && conPlan !== null && !conPlan.has(p) ? ' (sin plan)' : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={btn} onClick={() => ir(anterior)}
          title={anterior ? `Ir a ${nombrePeriodo(anterior)}${marcaVacio(anterior)}` : ''} aria-label="Mes anterior">‹</button>
        <span style={{
          fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize', minWidth: compacto ? 0 : 132,
          textAlign: 'center', color: aviso?.tipo === 'actual' ? 'var(--ink)' : 'var(--alerta-fuerte)',
        }}>{nombrePeriodo(actual)}</span>
        <button type="button" style={btn} onClick={() => ir(siguiente)}
          title={siguiente ? `Ir a ${nombrePeriodo(siguiente)}${marcaVacio(siguiente)}` : ''} aria-label="Mes siguiente">›</button>
        {aviso?.tipo !== 'actual' && (
          <button type="button" style={{ ...btn, fontWeight: 700 }} onClick={() => ir(hoy)}>Mes actual</button>
        )}
      </div>

      {/* Dos avisos distintos y no se pisan: uno dice que no es el mes de hoy,
          el otro que ese mes no tiene plan. Confundirlos deja creyendo que el
          planeador falló cuando lo que pasa es que ese mes no se generó. */}
      {aviso && aviso.tipo !== 'actual' && (
        <div style={{
          fontSize: 12, fontWeight: 600, lineHeight: 1.5, borderRadius: 5, padding: '5px 9px',
          color: 'var(--alerta-fuerte)', background: 'var(--alerta-suave)', border: '1px solid var(--alerta-borde)',
        }}>{aviso.texto}</div>
      )}
      {vacio && (
        <div style={{
          fontSize: 12, fontWeight: 600, lineHeight: 1.5, borderRadius: 5, padding: '5px 9px',
          color: 'var(--muted)', background: 'var(--panel-2)', border: '1px solid var(--edge)',
        }}>
          {nombrePeriodo(actual)} no tiene plan generado. No es que esté vacío: nunca se generó.
        </div>
      )}
    </div>
  );
}
