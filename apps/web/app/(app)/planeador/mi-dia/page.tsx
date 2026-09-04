// apps/web/app/planeador/mi-dia/page.tsx — cockpit del ejecutor (auxiliar/asesor).
// Encabezado por "Captura del día" (registra lotes de todos sus clientes en un
// solo lugar) y, debajo, todas sus tareas del período.

import { fetchTareas, TareasTabla, nombrePeriodo } from '../tareas';
import { getSessionUser } from '@/lib/session';
import CapturaDelDia from './CapturaDelDia';
import ListoParaProcesar from './ListoParaProcesar';
import ImpuestosDelDia from './ImpuestosDelDia';
import InsumoDelCliente from './InsumoDelCliente';
import LiberarInsumo from './LiberarInsumo';
import NovedadesDelDia from './NovedadesDelDia';
import PendientesDelDia from './PendientesDelDia';
import PanelPlegable from '@/app/_components/PanelPlegable';
import NavegadorPeriodo from '@/app/_components/NavegadorPeriodo';
import { periodoValido } from '@/lib/periodo';


export const metadata = { title: 'Mi Día' };
export const dynamic = 'force-dynamic';

// El mes se lee de la URL (?periodo=YYYY-MM), igual que en Lista, Tablero y
// Flujo. Mi Día era la única pantalla del plan sin manera de moverse de mes: al
// cerrar agosto no había cómo volver a revisar qué capturó cada auxiliar por
// empresa, aunque el backend siempre supo servir cualquier período.
export default async function MiDiaPage({ searchParams }: { searchParams?: { periodo?: string } }) {
  const periodo = periodoValido(searchParams?.periodo) ? searchParams!.periodo! : null;
  // Eliminar un lote borra trabajo ya registrado: se reserva a la coordinación.
  // El backend además lo permite al asesor/auxiliar de la tarea; acá solo se
  // decide a quién se le muestra el botón.
  const sesion = await getSessionUser();
  const puedeBorrarLotes = !!sesion && (sesion.esRoot || sesion.roles.some((r) => ['Administrador', 'Coordinador'].includes(r)));
  const { data, error } = await fetchTareas(`miDia=1${periodo ? `&periodo=${encodeURIComponent(periodo)}` : ''}`);
  const tareas = data?.tareas ?? [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Mi Día</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{data?.periodo ? nombrePeriodo(data.periodo) : ''} · {tareas.length} tareas</span>
      </div>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13 }}>Las actividades que te toca <strong>ejecutar</strong> en el período. Para ver también lo de tus auxiliares a cargo, usa la <strong>Lista</strong>.</p>

      {/* Sin esto, Mi Día solo existía en el mes en curso: revisar qué se
          capturó en agosto era imposible desde acá. */}
      <div style={{ marginBottom: 14 }}><NavegadorPeriodo /></div>

      {/* Cockpit por rol (cada sección se oculta sola si no aplica al usuario):
          captura del día (auxiliar), listo para procesar e impuestos (asesor).
          Los impuestos van aparte porque no son tareas del plan: se trabajan
          sobre el vencimiento mismo, que es lo que ve el calendario. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
        <CapturaDelDia puedeBorrar={puedeBorrarLotes} />
        <LiberarInsumo />
        <InsumoDelCliente />
        <ListoParaProcesar />
        <ImpuestosDelDia />
        {/* Los pendientes van con lo demás de Mi Día, pero NO son del plan: no
            entran al calendario ni al cumplimiento. Es la agenda del día a día. */}
        <PendientesDelDia />
        <NovedadesDelDia />
      </div>

      {/* El listado completo va plegable: en Mi Día lo primero es lo que se
          ejecuta hoy, no el inventario del mes. Un componente de cliente puede
          envolver contenido rendido en el servidor sin convertirlo. */}
      <PanelPlegable id="mis-tareas-periodo" titulo="Mis tareas del período"
        resumen={<span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{tareas.length} tarea(s)</span>}>
        <div style={{ padding: '12px 16px 16px' }}>
          {error ? (
            <div style={{ color: 'var(--peligro-fuerte)', fontWeight: 600 }}>No se pudieron cargar las tareas: {error}.</div>
          ) : tareas.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>No tienes tareas asignadas este período. Cuando se te asignen actividades por área, aparecerán aquí.</div>
          ) : (
            <TareasTabla tareas={tareas} mostrarAsesor={false} />
          )}
        </div>
      </PanelPlegable>
    </>
  );
}
