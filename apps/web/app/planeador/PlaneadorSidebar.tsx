'use client';
// Barra lateral del planeador (React), estilo escritorio. Acordeón por área: cada
// área se despliega y muestra sus funciones al abrirla. "Inicio" queda fijo arriba.
// El área con la ruta activa se abre sola; el resto de aperturas se recuerda en el
// navegador. Los permisos filtran qué áreas y funciones ve cada quien (misma fuente
// que los guardas de ruta). Nombres alineados a la visión (ver docs/vision-plataforma.md).

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { puedeVerRuta } from '@/lib/acceso';

type Item = { label: string; icon: string; href: string };

// "Inicio" no vive dentro de un área: es un acceso fijo arriba del acordeón.
const INICIO: Item = { label: 'Inicio', icon: '🏠', href: '/planeador' };

const SECTIONS: { titulo: string; items: Item[] }[] = [
  {
    titulo: 'Mi Ruta',
    items: [
      { label: 'Mi Día', icon: '☆', href: '/planeador/mi-dia' },
      { label: 'Calendario', icon: '📅', href: '/planeador/calendario' },
      { label: 'Visitas', icon: '🤝', href: '/planeador/visitas' },
      { label: 'Plan de Trabajo', icon: '📊', href: '/planeador/cronograma' },
      { label: 'Tablero', icon: '▦', href: '/planeador/tablero' },
      { label: 'Flujo del cierre', icon: '🔀', href: '/planeador/flujo' },
      { label: 'Lista', icon: '☰', href: '/planeador/lista' },
      { label: 'Asignaciones', icon: '🧑‍🤝‍🧑', href: '/planeador/asignaciones' },
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

const LS_KEY = 'cerpat.sidebar.areas';

export default function PlaneadorSidebar({ roles, esRoot = false }: { roles: string[]; esRoot?: boolean }) {
  const path = usePathname();
  const usuario = { roles, esRoot };

  const esActiva = (href: string) => href === path || (href !== '/planeador' && path.startsWith(href + '/'));

  // Cada ítem/área se muestra según el rol (misma fuente que los guardas de ruta).
  const secciones = SECTIONS
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => puedeVerRuta(usuario, it.href)) }))
    .filter((sec) => sec.items.length > 0);

  const areaActiva = secciones.find((s) => s.items.some((it) => esActiva(it.href)))?.titulo ?? null;

  // Estado inicial (server y primer render): el área activa abierta; si ninguna,
  // la primera. Determinista para no romper la hidratación.
  const [abiertas, setAbiertas] = useState<Set<string>>(
    () => new Set([areaActiva ?? secciones[0]?.titulo].filter(Boolean) as string[]),
  );

  // Tras montar, aplica la preferencia guardada del usuario.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setAbiertas(new Set(JSON.parse(raw) as string[]));
    } catch { /* sin persistencia */ }
  }, []);

  // El área con la ruta activa siempre queda abierta (p. ej. al navegar).
  useEffect(() => {
    if (areaActiva) setAbiertas((prev) => (prev.has(areaActiva) ? prev : new Set(prev).add(areaActiva)));
  }, [areaActiva]);

  const alternar = (titulo: string) => setAbiertas((prev) => {
    const n = new Set(prev);
    if (n.has(titulo)) n.delete(titulo); else n.add(titulo);
    try { localStorage.setItem(LS_KEY, JSON.stringify([...n])); } catch { /* sin persistencia */ }
    return n;
  });

  const item = (it: Item) => {
    const active = esActiva(it.href);
    const base: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 6,
      fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative',
    };
    const activeStyle: React.CSSProperties = active ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-ink)' } : {};
    return (
      <a key={it.label} href={it.href} style={{ ...base, ...activeStyle }}>
        <span style={{ width: 18, textAlign: 'center' }}>{it.icon}</span>
        <span>{it.label}</span>
        {active && <span style={{ position: 'absolute', left: -6, top: 7, bottom: 7, width: 3, borderRadius: 3, background: 'var(--nav-accent)' }} />}
      </a>
    );
  };

  const inicioVisible = puedeVerRuta(usuario, INICIO.href);

  return (
    <aside style={{ background: 'var(--nav-bg)', color: 'var(--nav-ink)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 210 }}>
      {inicioVisible && item(INICIO)}

      {secciones.map((sec) => {
        const abierta = abiertas.has(sec.titulo);
        const tieneActiva = sec.items.some((it) => esActiva(it.href));
        return (
          <div key={sec.titulo}>
            <button
              type="button"
              onClick={() => alternar(sec.titulo)}
              aria-expanded={abierta}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer',
                fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 800,
                opacity: tieneActiva ? 0.9 : 0.6, padding: '14px 10px 6px', fontFamily: 'inherit',
              }}
            >
              <span>{sec.titulo}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.8, transform: abierta ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }}>▾</span>
            </button>
            {abierta && <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{sec.items.map(item)}</div>}
          </div>
        );
      })}
    </aside>
  );
}
