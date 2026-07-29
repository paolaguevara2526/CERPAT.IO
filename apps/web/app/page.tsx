// apps/web/app/page.tsx
//
// Home institucional de CERPAT (cerpat.io/). Reemplaza al sitio WordPress que
// vivía en cerpat.com. Página estática, marca verde + navy del planeador.
// El planeador (app) queda en cerpat.io/app.
//
// NOTA: los datos de contacto marcados como [PENDIENTE] deben confirmarse con el
// equipo (teléfono, dirección, logo). Correo y ciudad tomados de la operación.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CERPAT · Contadores — Asesoría contable y tributaria',
  description:
    'Firma contable en Villavicencio: impuestos, informes financieros, cumplimiento, nómina y tesorería para empresas y personas.',
};

const BRAND = '#34C98B';
const NAVY = '#20259C';
const NAVY_DARK = '#11154F';
const INK = '#101828';

const SERVICIOS = [
  { icono: '📊', titulo: 'Impuestos', texto: 'Declaraciones, obligaciones nacionales y municipales, y planeación tributaria al día con la norma.' },
  { icono: '📈', titulo: 'Informes financieros', texto: 'Estados financieros y reportes bajo NIIF para la toma de decisiones y el cumplimiento legal.' },
  { icono: '🛡️', titulo: 'Cumplimiento', texto: 'Control de vencimientos y requisitos legales para que ninguna obligación se pase por alto.' },
  { icono: '👥', titulo: 'Nómina', texto: 'Liquidación de nómina, seguridad social y prestaciones con total exactitud y confidencialidad.' },
  { icono: '💵', titulo: 'Tesorería', texto: 'Conciliaciones, causación y control de movimientos para una operación financiera ordenada.' },
];

const linkStyle: React.CSSProperties = { color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 14.5, opacity: 0.92 };

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', margin: 0, color: INK, background: '#fff' }}>
      {/* Barra superior */}
      <header style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, color: '#fff' }}>
        <nav style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 9, background: BRAND, color: NAVY_DARK, fontWeight: 900, alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>C</span>
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.5 }}>CERPAT</span>
            <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600, marginLeft: 2 }}>Contadores</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <a href="#servicios" style={linkStyle}>Servicios</a>
            <a href="#nosotros" style={linkStyle}>Nosotros</a>
            <a href="#contacto" style={linkStyle}>Contacto</a>
            <a href="/app" style={{ background: BRAND, color: NAVY_DARK, textDecoration: 'none', fontWeight: 800, fontSize: 14, padding: '9px 16px', borderRadius: 9 }}>Acceder al planeador</a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${NAVY_DARK}, ${NAVY})`, color: '#fff', padding: '64px 28px 80px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, letterSpacing: 0.5, background: 'rgba(52,201,139,0.16)', color: BRAND, padding: '6px 14px', borderRadius: 999, marginBottom: 20 }}>
            Firma contable · Villavicencio, Meta
          </div>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, fontWeight: 900, margin: '0 0 18px' }}>
            Tu contabilidad al día, <span style={{ color: BRAND }}>sin sorpresas</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, opacity: 0.9, margin: '0 0 30px' }}>
            Acompañamos a empresas y personas en impuestos, informes financieros, cumplimiento, nómina y tesorería —
            con un equipo por áreas y seguimiento del trabajo mes a mes.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#contacto" style={{ background: BRAND, color: NAVY_DARK, textDecoration: 'none', fontWeight: 800, fontSize: 15.5, padding: '13px 26px', borderRadius: 11 }}>Solicita una asesoría</a>
            <a href="#servicios" style={{ background: 'transparent', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15.5, padding: '13px 26px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.35)' }}>Ver servicios</a>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios" style={{ maxWidth: 1120, margin: '0 auto', padding: '70px 28px 20px' }}>
        <h2 style={{ fontSize: 30, fontWeight: 900, textAlign: 'center', margin: '0 0 10px' }}>Nuestros servicios</h2>
        <p style={{ textAlign: 'center', color: '#667085', fontSize: 16.5, margin: '0 auto 42px', maxWidth: 620 }}>
          Cinco áreas de trabajo que cubren el ciclo contable y tributario completo de tu organización.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
          {SERVICIOS.map((s) => (
            <div key={s.titulo} style={{ background: '#fff', border: '1px solid #EAECF0', borderRadius: 16, padding: '26px 24px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.05)' }}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(52,201,139,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>{s.icono}</div>
              <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px' }}>{s.titulo}</h3>
              <p style={{ color: '#475467', fontSize: 15, lineHeight: 1.6, margin: 0 }}>{s.texto}</p>
            </div>
          ))}
          <div style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, color: '#fff', borderRadius: 16, padding: '26px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px' }}>¿Necesitas otro servicio?</h3>
            <p style={{ opacity: 0.9, fontSize: 15, lineHeight: 1.6, margin: '0 0 16px' }}>Cuéntanos tu caso y armamos un plan a la medida de tu empresa.</p>
            <a href="#contacto" style={{ color: BRAND, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>Escríbenos →</a>
          </div>
        </div>
      </section>

      {/* Nosotros */}
      <section id="nosotros" style={{ background: '#F7F9FB', padding: '70px 28px', marginTop: 60 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 18px' }}>Sobre CERPAT</h2>
          <p style={{ color: '#475467', fontSize: 17, lineHeight: 1.7, margin: '0 0 16px' }}>
            Somos una firma de contadores que acompaña a empresas y personas en el cumplimiento de sus obligaciones
            contables y tributarias. Trabajamos organizados por áreas —impuestos, informes, cumplimiento, nómina y
            tesorería— con asesores y auxiliares asignados a cada cliente y un seguimiento del plan de trabajo mes a mes.
          </p>
          <p style={{ color: '#475467', fontSize: 17, lineHeight: 1.7, margin: 0 }}>
            Nuestro objetivo es que tu información esté siempre al día, para que puedas tomar decisiones con tranquilidad.
          </p>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" style={{ maxWidth: 1120, margin: '0 auto', padding: '70px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 22 }}>
          {[
            { icono: '✉️', titulo: 'Correo', valor: 'contacto@cerpat.io', href: 'mailto:contacto@cerpat.io' },
            { icono: '📍', titulo: 'Ubicación', valor: 'Villavicencio, Meta — Colombia', href: null },
            { icono: '📞', titulo: 'Teléfono', valor: '[PENDIENTE: confirmar]', href: null },
          ].map((c) => (
            <div key={c.titulo} style={{ background: '#fff', border: '1px solid #EAECF0', borderRadius: 16, padding: '26px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{c.icono}</div>
              <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#98A2B3', fontWeight: 800, marginBottom: 6 }}>{c.titulo}</div>
              {c.href
                ? <a href={c.href} style={{ color: NAVY, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>{c.valor}</a>
                : <div style={{ color: INK, fontWeight: 700, fontSize: 16 }}>{c.valor}</div>}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a href="/app" style={{ background: NAVY, color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 15.5, padding: '14px 30px', borderRadius: 11 }}>Acceder al planeador →</a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: NAVY_DARK, color: '#fff', padding: '30px 28px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 8, background: BRAND, color: NAVY_DARK, fontWeight: 900, alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>C</span>
            <span style={{ fontWeight: 800 }}>CERPAT Contadores</span>
          </div>
          <div style={{ fontSize: 13.5, opacity: 0.75 }}>© {new Date().getFullYear()} CERPAT · Villavicencio, Meta</div>
        </div>
      </footer>
    </main>
  );
}
