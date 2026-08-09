// Mapa de navegación del planeador: la ÚNICA fuente de verdad de a dónde se
// puede ir. La usan la barra lateral y el buscador global (Ctrl+K); si un
// destino nuevo se agrega aquí, aparece en ambos sin tocar nada más.
//
// `claves` son palabras con las que alguien podría buscar esa pantalla aunque no
// recuerde su nombre exacto ("impuestos" → Vencimientos, "kanban" → Tablero).

export type Destino = {
  label: string;
  icon: string;      // nombre en ./iconos
  href: string;
  claves?: string[]; // sinónimos para el buscador
};

export type Seccion = { titulo: string; items: Destino[] };

// "Inicio" no vive dentro de un área: es un acceso fijo arriba del acordeón.
export const INICIO: Destino = {
  label: 'Inicio', icon: 'inicio', href: '/planeador',
  claves: ['resumen', 'home', 'principal'],
};

export const SECCIONES: Seccion[] = [
  {
    titulo: 'Mi Ruta',
    items: [
      { label: 'Mi Día', icon: 'dia', href: '/planeador/mi-dia', claves: ['hoy', 'mis tareas', 'pendientes'] },
      { label: 'Calendario', icon: 'calendario', href: '/planeador/calendario', claves: ['agenda', 'mes', 'fechas'] },
      { label: 'Visitas', icon: 'visitas', href: '/planeador/visitas', claves: ['actas', 'compromisos', 'seguimiento'] },
      { label: 'Plan de Trabajo', icon: 'plan', href: '/planeador/cronograma', claves: ['cronograma', 'cumplimiento', 'actividades'] },
      { label: 'Tablero', icon: 'tablero', href: '/planeador/tablero', claves: ['kanban', 'columnas', 'estados'] },
      { label: 'Flujo del cierre', icon: 'flujo', href: '/planeador/flujo', claves: ['cierre', 'proceso'] },
      { label: 'Lista', icon: 'lista', href: '/planeador/lista', claves: ['tareas', 'listado', 'exportar'] },
      { label: 'Asignaciones', icon: 'asignaciones', href: '/planeador/asignaciones', claves: ['asesor', 'auxiliar', 'responsables', 'equipo'] },
      { label: 'Pagos', icon: 'pagos', href: '/planeador/pagos', claves: ['abonos', 'mora', 'sanción', 'por pagar', 'deuda'] },
      { label: 'Vencimientos', icon: 'vencimientos', href: '/vencimientos', claves: ['impuestos', 'obligaciones', 'declaraciones', 'dian', 'ica'] },
      { label: 'Auditoría', icon: 'auditoria', href: '/planeador/auditoria', claves: ['revisar', 'aprobar', 'cola'] },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { label: 'Clientes', icon: 'clientes', href: '/clientes', claves: ['empresas', 'nit', 'cartera'] },
      { label: 'Coordinación', icon: 'coordinacion', href: '/coordinacion', claves: ['indicadores', 'kpi', 'cumplimiento', 'métricas'] },
      { label: 'Usuarios', icon: 'usuarios', href: '/usuarios', claves: ['personal', 'equipo', 'roles', 'contraseñas'] },
      { label: 'Administración', icon: 'administracion', href: '/administracion', claves: ['configuración', 'catálogos', 'parámetros', 'documentos', 'municipios'] },
    ],
  },
  {
    titulo: 'Servicios',
    items: [
      { label: 'Calculadora de retenciones', icon: 'calculadora', href: '/servicios/retenciones', claves: ['retefuente', 'retención'] },
      { label: 'Punto de equilibrio', icon: 'equilibrio', href: '/servicios/punto-equilibrio', claves: ['costos', 'margen'] },
      { label: 'Portal de Hallazgos', icon: 'hallazgos', href: '/hallazgos', claves: ['revisoría', 'riesgos', 'auditoría externa'] },
      { label: 'Más herramientas', icon: 'herramientas', href: '/herramientas', claves: ['calculadoras', 'liquidador'] },
    ],
  },
];

// Todos los destinos en una lista plana, con el área a la que pertenecen.
export const DESTINOS: (Destino & { area: string })[] = [
  { ...INICIO, area: '' },
  ...SECCIONES.flatMap((s) => s.items.map((it) => ({ ...it, area: s.titulo }))),
];

// Búsqueda tolerante: sin tildes, sin mayúsculas y por partes ("plan trab").
export function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function coincide(d: Destino & { area?: string }, consulta: string): boolean {
  const q = normalizar(consulta).trim();
  if (!q) return true;
  const heno = normalizar([d.label, d.area ?? '', ...(d.claves ?? [])].join(' '));
  return q.split(/\s+/).every((parte) => heno.includes(parte));
}
