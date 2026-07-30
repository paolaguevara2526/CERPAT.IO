// apps/web/app/servicios/page.tsx
//
// Sección "Servicios": herramientas para el equipo y los clientes de CERPAT.
// Estilo "software de escritorio" (desktop.css). Las herramientas ya construidas
// enlazan a su HTML en /public/servicios; las demás quedan como "Próximamente".

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Servicios · Herramientas — CERPAT',
  description: 'Calculadoras y herramientas contables de CERPAT para el equipo y los clientes.',
};

type Tool = { nombre: string; desc: string; href: string | null; icon: React.ReactNode };

const ico = (d: string, extra?: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{extra}
  </svg>
);

const TOOLS: Tool[] = [
  {
    nombre: 'Calculadora de retenciones', desc: 'Retención en la fuente por concepto, con tarifas y bases al día.',
    href: '/servicios/retenciones',
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
        <rect x="5" y="2" width="14" height="20" rx="2" /><rect x="7.5" y="4.5" width="9" height="3.5" rx="0.8" />
        <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01" />
      </svg>
    ),
  },
  {
    nombre: 'Calculadora punto de equilibrio', desc: 'Halla las ventas mínimas para no perder ni ganar: costos fijos y margen.',
    href: '/servicios/punto-equilibrio',
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 3v17h17" /><path d="M6 17L19 6" /><path d="M6 8l13 9" />
      </svg>
    ),
  },
  {
    nombre: 'Liquidador de intereses', desc: 'Intereses de mora y sanciones (DIAN) por número de días.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
        <circle cx="7" cy="7" r="2.4" /><circle cx="17" cy="17" r="2.4" /><path d="M18 6L6 18" />
      </svg>
    ),
  },
  {
    nombre: 'Liquidador de prestaciones sociales', desc: 'Cesantías, intereses, prima y vacaciones según el periodo.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round">
        <rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9v6M18 9v6" />
      </svg>
    ),
  },
  {
    nombre: 'Calendario tributario', desc: 'Vencimientos nacionales y municipales según el NIT.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M8 14l2.5 2.5L16 12" />
      </svg>
    ),
  },
  {
    nombre: 'Portal de documentos', desc: 'Espacio para que los clientes suban y consulten sus soportes.',
    href: null,
    icon: ico('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  },
];

function WinControls() {
  return (
    <div className="win-ctl">
      <button aria-label="Minimizar"><svg viewBox="0 0 12 12"><rect x="1.5" y="6" width="9" height="1.4" fill="currentColor" /></svg></button>
      <button aria-label="Maximizar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x="1.8" y="1.8" width="8.4" height="8.4" /></svg></button>
      <button className="close" aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button>
    </div>
  );
}

export default function ServiciosPage() {
  const disponibles = TOOLS.filter((t) => t.href).length;
  return (
    <main style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 500px at 72% -12%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '26px 18px 44px', display: 'flex', justifyContent: 'center' }}>
      <div className="win" style={{ width: '100%', maxWidth: 1080 }}>
        <div className="win-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
          <span className="win-title">Servicios</span>
          <span className="win-path">cerpat.io/servicios</span>
          <WinControls />
        </div>

        <div className="win-toolbar">
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Herramientas · <b style={{ color: 'var(--ink)' }}>{disponibles} disponibles</b> · {TOOLS.length - disponibles} en construcción</span>
        </div>

        <div className="win-body">
          <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.6 }}>
            Calculadoras y utilidades para el equipo y los clientes de CERPAT. Las marcadas como <em>Próximamente</em> se irán habilitando.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {TOOLS.map((t) => {
              const disponible = Boolean(t.href);
              const card = (
                <div className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', opacity: disponible ? 1 : 0.72 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 46, height: 46, borderRadius: 9, display: 'grid', placeItems: 'center', color: disponible ? 'var(--navy)' : 'var(--muted)', background: disponible ? 'rgba(46,80,144,0.10)' : 'var(--panel-2)', border: '1px solid var(--edge)', flex: 'none' }}>{t.icon}</span>
                    <span style={{ fontWeight: 750, fontSize: 14.5, lineHeight: 1.2 }}>{t.nombre}</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.8, lineHeight: 1.55, flex: 1 }}>{t.desc}</p>
                  <div>
                    {disponible
                      ? <span className="dbtn primary" style={{ fontSize: 12.5, padding: '7px 14px' }}>Abrir →</span>
                      : <span className="chip" style={{ color: 'var(--muted)', background: 'var(--panel-2)' }}>Próximamente</span>}
                  </div>
                </div>
              );
              return disponible
                ? <a key={t.nombre} href={t.href!} style={{ textDecoration: 'none', color: 'inherit' }}>{card}</a>
                : <div key={t.nombre}>{card}</div>;
            })}
          </div>
        </div>

        <div className="win-status">
          <span className="led" /> CERPAT · guiamos a nuestros clientes a la cima
          <span className="sp" />
          <span>{disponibles} de {TOOLS.length} herramientas activas</span>
        </div>
      </div>
    </main>
  );
}
