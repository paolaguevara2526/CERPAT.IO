// apps/web/lib/acceso.ts
// Permisos de navegación por rol: qué rutas del planeador puede ver cada perfil.
// Fuente ÚNICA para el menú (PlaneadorSidebar) y para los guardas de ruta de cada
// página (bloqueo por URL). Administrador y root siempre pueden ver todo.
//
// Matriz acordada:
//   Auxiliar    → Inicio, Mi Día, Calendario, Tablero, Lista + Servicios básicos.
//   Asesor      → lo del Auxiliar + Visitas, Pagos.
//   Coordinador → lo del Asesor + Vencimientos, Auditoría, Plan de Trabajo,
//                 Flujo del cierre + Coordinación.
//   Auditor     → lo del Coordinador + Portal de Hallazgos.

export type UsuarioAcceso = { esRoot?: boolean; roles: string[] };

// Todos los perfiles de la firma (para las vistas comunes).
const TODOS = ['Administrador', 'Coordinador', 'Asesor', 'Auditor', 'Auxiliar'];

// Roles que ven cada ruta (además de Administrador/root, que siempre pueden).
// Un arreglo vacío = solo Administrador/root.
export const ACCESO_RUTA: Record<string, string[]> = {
  // Planeador
  '/planeador': TODOS,
  '/planeador/mi-dia': TODOS,
  '/planeador/calendario': TODOS,
  '/planeador/visitas': ['Asesor', 'Coordinador', 'Auditor'],
  '/planeador/cronograma': ['Coordinador', 'Auditor'], // Plan de Trabajo
  '/planeador/tablero': TODOS,
  '/planeador/flujo': ['Coordinador', 'Auditor'], // Flujo del cierre
  '/planeador/lista': TODOS,
  '/planeador/asignaciones': TODOS, // cada quien ve las suyas; coordinación/admin ve todo
  '/planeador/pagos': ['Asesor', 'Coordinador', 'Auditor'],
  '/vencimientos': ['Coordinador', 'Auditor'],
  '/planeador/auditoria': ['Coordinador', 'Auditor'],
  // Gestión
  '/clientes': [], // solo Administrador/root
  '/coordinacion': ['Coordinador', 'Auditor'],
  '/usuarios': [], // solo Administrador/root
  '/administracion': ['Coordinador'], // Coordinador: solo Empresas, Config. tributaria y Plan por cliente
  // Servicios
  '/servicios/retenciones': TODOS,
  '/servicios/punto-equilibrio': TODOS,
  '/hallazgos': ['Auditor'], // Portal de Hallazgos
  '/herramientas': TODOS, // Más herramientas (antes /servicios)
};

export function esAdminRol(u: UsuarioAcceso): boolean {
  return !!u.esRoot || u.roles.includes('Administrador');
}

// ¿El usuario puede ver la ruta indicada? Administrador/root: siempre.
export function puedeVerRuta(u: UsuarioAcceso, href: string): boolean {
  if (esAdminRol(u)) return true;
  const permitidos = ACCESO_RUTA[href];
  if (!permitidos) return false; // ruta desconocida: solo admin
  return u.roles.some((r) => permitidos.includes(r));
}
