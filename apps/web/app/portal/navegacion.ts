// Mapa de navegación del Portal del Cliente: fuente única del menú y del
// buscador, igual que la del personal. Todo aquí es de solo lectura y está
// aislado al NIT/grupo del cliente (lo valida el backend).

import type { Destino, Seccion } from '@/app/(app)/planeador/navegacion';

export const INICIO_PORTAL: Destino = {
  label: 'Inicio', icon: 'inicio', href: '/portal', claves: ['resumen', 'principal'],
};

export const SECCIONES_PORTAL: Seccion[] = [
  {
    titulo: 'Mi empresa',
    items: [
      { label: 'Calendario', icon: 'calendario', href: '/portal/calendario', claves: ['agenda', 'fechas', 'vencimientos'] },
      { label: 'Visitas', icon: 'visitas', href: '/portal/visitas', claves: ['actas', 'compromisos'] },
      { label: 'Plan de Trabajo', icon: 'plan', href: '/portal/plan', claves: ['cumplimiento', 'actividades'] },
      { label: 'Pagos', icon: 'pagos', href: '/portal/pagos', claves: ['impuestos', 'mora', 'por pagar'] },
      { label: 'Hallazgos', icon: 'hallazgos', href: '/portal/hallazgos', claves: ['revisoría', 'riesgos'] },
    ],
  },
  {
    titulo: 'Servicios',
    items: [
      { label: 'Calculadora de retenciones', icon: 'calculadora', href: '/servicios/retenciones', claves: ['retefuente'] },
      { label: 'Punto de equilibrio', icon: 'equilibrio', href: '/servicios/punto-equilibrio', claves: ['costos', 'margen'] },
      { label: 'Más herramientas', icon: 'herramientas', href: '/herramientas', claves: ['calculadoras'] },
    ],
  },
];

export const DESTINOS_PORTAL: (Destino & { area: string })[] = [
  { ...INICIO_PORTAL, area: '' },
  ...SECCIONES_PORTAL.flatMap((s) => s.items.map((it) => ({ ...it, area: s.titulo }))),
];
