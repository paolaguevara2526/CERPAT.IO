'use client';
// Barra lateral del planeador (React), estilo escritorio. Tres secciones:
// Planeador / Gestión / Servicios. Resalta el ítem activo por la ruta.

import { usePathname } from 'next/navigation';
import { puedeVerRuta } from '@/lib/acceso';

type Item = { label: string; icon: string; href: string; soon?: boolean };
const SECTIONS: { titulo: string; items: Item[] }[] = [
  {
    titulo: 'Planeador',
    items: [
      { label: 'Inicio', icon: '🏠', href: '/planeador' },
      { label: 'Mi Día', icon: '☆', href: '/planeador/mi-dia' },
      { label: 'Calendario', icon: '📅', href: '/planeador/calendario' },
      { label: 'Visitas', icon: '🤝', href: '/planeador/visitas' },
      { label: 'Plan de Trabajo', icon: '📊', href: '/planeador/cronograma' },
      { label: 'Tablero', icon: '▦', href: '/planeador/tablero' },
      { label: 'Flujo del cierre', icon: '🔀', href: '/planeador/flujo' },
      { label: 'Lista', icon: '☰', href: '/planeador/lista' },
      { label: 'Pagos', icon: '💲', href: '/planeador/pagos' },
      { label: 'Vencimientos', icon: '🗓', href: '/vencimientos' },
      { label: 'Auditoría', icon: '🛡', href: '/planeador/auditoria' },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { label: 'Clientes', icon: '🏢', href: '/clientes' },
      { label: 'Coordinación', icon: '📊', href: '/coordinacion' },
      { label: 'Usuarios', icon: '🧗', href: '/usuarios' },
      { label: 'Administración', icon: '⚙️', href: '/administracion' },
    ],
  },
  {
    titulo: 'Servicios',
    items: [
      { label: 'Calculadora de retenciones', icon: '🧮', href: '/servicios/retenciones' },
      { label: 'Punto de equilibrio', icon: '📈', href: '/servicios/punto-equilibrio' },
      { label: 'Portal de Hallazgos', icon: '🔎', href: '/hallazgos' },
      { label: 'Más herramientas', icon: '🧰', href: '/servicios' },
    ],
  },
];

export default function PlaneadorSidebar({ roles, esRoot = false }: { roles: string[]; esRoot?: boolean }) {
  const path = usePathname();
  const usuario = { roles, esRoot };
  // Cada ítem se muestra según el rol (misma fuente que los guardas de ruta).
  const secciones = SECTIONS
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => puedeVerRuta(usuario, it.href)) }))
    .filter((sec) => sec.items.length > 0); // ocultar secciones vacías (p. ej. Gestión)
  return (
    <aside style={{ background: 'var(--nav-bg)', color: 'var(--nav-ink)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 210 }}>
      {secciones.map((sec) => (
        <div key={sec.titulo}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 800, opacity: 0.55, padding: '12px 10px 5px' }}>{sec.titulo}</div>
          {sec.items.map((it) => {
            const active = it.href && (path === it.href || (it.href !== '/planeador' && path.startsWith(it.href + '/')));
            const base: React.CSSProperties = {
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 6,
              fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'inherit', cursor: it.soon ? 'default' : 'pointer',
              opacity: it.soon ? 0.45 : 1, position: 'relative',
            };
            const activeStyle: React.CSSProperties = active
              ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-ink)' } : {};
            const content = (
              <>
                <span style={{ width: 18, textAlign: 'center' }}>{it.icon}</span>
                <span>{it.label}</span>
                {it.soon && <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.7 }}>pronto</span>}
                {active && <span style={{ position: 'absolute', left: -6, top: 7, bottom: 7, width: 3, borderRadius: 3, background: 'var(--nav-accent)' }} />}
              </>
            );
            return it.href && !it.soon
              ? <a key={it.label} href={it.href} style={{ ...base, ...activeStyle }}>{content}</a>
              : <div key={it.label} style={base}>{content}</div>;
          })}
        </div>
      ))}
    </aside>
  );
}
