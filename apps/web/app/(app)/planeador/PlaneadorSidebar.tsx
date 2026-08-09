'use client';
// Barra lateral del planeador (React), estilo escritorio. Acordeón por área: cada
// área se despliega y muestra sus funciones al abrirla. "Inicio" queda fijo arriba.
// El área con la ruta activa se abre sola; el resto de aperturas se recuerda en el
// navegador. Los permisos filtran qué áreas y funciones ve cada quien (misma fuente
// que los guardas de ruta). Nombres alineados a la visión (ver docs/vision-plataforma.md).

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { puedeVerRuta } from '@/lib/acceso';
import Ico from './iconos';
import { INICIO, SECCIONES, type Destino } from './navegacion';

const LS_KEY = 'cerpat.sidebar.areas';

export default function PlaneadorSidebar({ roles, esRoot = false, soloIconos = false }: { roles: string[]; esRoot?: boolean; soloIconos?: boolean }) {
  const path = usePathname();
  const usuario = { roles, esRoot };

  const esActiva = (href: string) => href === path || (href !== '/planeador' && path.startsWith(href + '/'));

  // Cada ítem/área se muestra según el rol (misma fuente que los guardas de ruta).
  const secciones = SECCIONES
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

  const item = (it: Destino) => {
    const active = esActiva(it.href);
    const base: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 6,
      fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative',
    };
    const activeStyle: React.CSSProperties = active ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-ink)' } : {};
    // Modo compacto: solo el ícono, centrado (el nombre va en el tooltip).
    const compacto: React.CSSProperties = soloIconos ? { justifyContent: 'center', padding: '9px 0' } : {};
    return (
      <a key={it.label} href={it.href} title={it.label} aria-label={it.label} style={{ ...base, ...activeStyle, ...compacto }}>
        <Ico name={it.icon} />
        {!soloIconos && <span>{it.label}</span>}
        {active && <span style={{ position: 'absolute', left: -6, top: 7, bottom: 7, width: 3, borderRadius: 3, background: 'var(--nav-accent)' }} />}
      </a>
    );
  };

  const inicioVisible = puedeVerRuta(usuario, INICIO.href);

  // Modo compacto (solo íconos): sin acordeón —no hay texto que colapsar—, se
  // listan todos los ítems con un separador sutil entre áreas.
  if (soloIconos) {
    return (
      <aside style={{ background: 'var(--nav-bg)', color: 'var(--nav-ink)', padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 2, width: 56, minWidth: 56, overflowY: 'auto' }}>
        {inicioVisible && item(INICIO)}
        {secciones.map((sec) => (
          <div key={sec.titulo} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div title={sec.titulo} style={{ height: 1, background: 'currentColor', opacity: 0.18, margin: '8px 8px 6px' }} />
            {sec.items.map(item)}
          </div>
        ))}
      </aside>
    );
  }

  return (
    <aside style={{ background: 'var(--nav-bg)', color: 'var(--nav-ink)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 210, overflowY: 'auto' }}>
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
