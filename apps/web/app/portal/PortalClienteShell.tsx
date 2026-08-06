'use client';
// Shell del Portal del Cliente: marco de ventana + menú lateral propio (Portal /
// Servicios) + contenido. Todo lo del cliente es SOLO LECTURA y aislado a su
// NIT/grupo (el backend lo valida). Los Servicios son herramientas públicas.

import { usePathname } from 'next/navigation';
import LogoutButton from '@/app/_components/LogoutButton';
import TemaSelector from '@/app/planeador/TemaSelector';

type Item = { label: string; icon: string; href: string; soon?: boolean; externo?: boolean };
const SECCIONES: { titulo: string; items: Item[] }[] = [
  {
    titulo: 'Portal',
    items: [
      { label: 'Inicio', icon: '🏠', href: '/portal' },
      { label: 'Calendario', icon: '📅', href: '/portal/calendario', soon: true },
      { label: 'Visitas', icon: '🤝', href: '/portal/visitas' },
      { label: 'Plan de Trabajo', icon: '📊', href: '/portal/plan', soon: true },
      { label: 'Pagos', icon: '💲', href: '/portal/pagos' },
      { label: 'Hallazgos', icon: '🔎', href: '/portal/hallazgos' },
    ],
  },
  {
    titulo: 'Servicios',
    items: [
      { label: 'Calculadora de retenciones', icon: '🧮', href: '/servicios/retenciones', externo: true },
      { label: 'Punto de equilibrio', icon: '📈', href: '/servicios/punto-equilibrio', externo: true },
      { label: 'Más herramientas', icon: '🧰', href: '/servicios', externo: true },
    ],
  },
];

export default function PortalClienteShell({ nombre, esPreview, children }: { nombre: string; esPreview: boolean; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <main style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 520px at 72% -12%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '14px', display: 'flex', justifyContent: 'center' }}>
      <div className="win" style={{ width: '100%', minHeight: 'calc(100vh - 28px)', display: 'flex', flexDirection: 'column' }}>
        <div className="win-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
          <span className="win-title">Portal del Cliente</span>
          <span className="win-path">cerpat.io/portal</span>
          <div className="win-ctl">
            <button aria-label="Minimizar"><svg viewBox="0 0 12 12"><rect x="1.5" y="6" width="9" height="1.4" fill="currentColor" /></svg></button>
            <button aria-label="Maximizar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x="1.8" y="1.8" width="8.4" height="8.4" /></svg></button>
            <button className="close" aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <aside style={{ background: 'var(--nav-bg)', color: 'var(--nav-ink)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 210, flexShrink: 0 }}>
            {SECCIONES.map((sec) => (
              <div key={sec.titulo}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 800, opacity: 0.55, padding: '12px 10px 5px' }}>{sec.titulo}</div>
                {sec.items.map((it) => {
                  const active = !it.soon && !it.externo && (it.href === '/portal' ? path === '/portal' : path === it.href || path.startsWith(it.href + '/'));
                  const base: React.CSSProperties = {
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 6,
                    fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'inherit',
                    cursor: it.soon ? 'default' : 'pointer', opacity: it.soon ? 0.45 : 1, position: 'relative',
                    ...(active ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-ink)' } : {}),
                  };
                  const content = (
                    <>
                      <span style={{ width: 18, textAlign: 'center' }}>{it.icon}</span>
                      <span>{it.label}</span>
                      {it.soon && <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.7 }}>pronto</span>}
                      {it.externo && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>↗</span>}
                      {active && <span style={{ position: 'absolute', left: -6, top: 7, bottom: 7, width: 3, borderRadius: 3, background: 'var(--nav-accent)' }} />}
                    </>
                  );
                  if (it.soon) return <div key={it.label} style={base} title="Próximamente">{content}</div>;
                  if (it.externo) return <a key={it.label} href={it.href} target="_blank" rel="noopener noreferrer" style={base}>{content}</a>;
                  return <a key={it.label} href={it.href} style={base}>{content}</a>;
                })}
              </div>
            ))}
          </aside>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{esPreview ? 'Vista de la firma · previsualización' : 'Acceso del cliente · solo consulta'}</span>
              <span style={{ flex: 1 }} />
              <TemaSelector />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>{children}</div>
          </div>
        </div>

        <div className="win-status">
          <span className="led" /> Información confidencial · uso exclusivo del cliente
          <span className="sp" />
          <LogoutButton nombre={nombre} />
        </div>
      </div>
    </main>
  );
}
