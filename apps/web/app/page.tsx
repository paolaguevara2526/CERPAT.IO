// apps/web/app/page.tsx
//
// Home institucional de CERPAT (cerpat.io/). Contenido migrado del WordPress que
// vivía en cerpat.com. Las páginas interiores son /nosotros, /servicios,
// /contacto y /trabaja-con-nosotros. El planeador queda en /planeador.

import type { Metadata } from 'next';
import { Header, Footer, BRAND, NAVY, NAVY_DARK, MUTED, CONTACTO, card, main } from './_sitio/Sitio';

export const metadata: Metadata = {
  title: 'CERPAT Contadores · Asesoría contable, tributaria y revisoría fiscal',
  description:
    'Firma de contadores públicos y asesores financieros en Villavicencio, con cobertura nacional. Asesoría contable, tributaria, revisoría fiscal, auditoría externa y forense. Certificados ISO 9001:2015.',
};

const PILARES = [
  { icono: '🏅', titulo: 'Experiencia profesional', texto: 'Más de 7 años asesorando empresas con soluciones contables y financieras confiables.' },
  { icono: '🎯', titulo: 'Atención personalizada', texto: 'Analizamos cada caso para ofrecer estrategias adaptadas a sus necesidades.' },
  { icono: '🛡️', titulo: 'Cumplimiento y seguridad', texto: 'Garantizamos procesos alineados con la normativa vigente y las mejores prácticas.' },
  { icono: '🤝', titulo: 'Acompañamiento integral', texto: 'Soporte permanente en áreas contables, tributarias, financieras y legales.' },
];

const SERVICIOS = [
  { icono: '📊', titulo: 'Asesoría Contable y Financiera', texto: 'Soluciones contables y financieras para su empresa.' },
  { icono: '🧾', titulo: 'Asesoría Tributaria', texto: 'Estrategias tributarias eficientes para el crecimiento empresarial.' },
  { icono: '🛡️', titulo: 'Revisoría Fiscal', texto: 'Control fiscal independiente para seguridad y cumplimiento empresarial.' },
  { icono: '🔍', titulo: 'Auditoría Externa', texto: 'Evaluación independiente para fortalecer control y transparencia empresarial.' },
  { icono: '⚖️', titulo: 'Auditoría Forense', texto: 'Detección de fraudes y análisis financiero especializado.' },
  { icono: '🗂️', titulo: 'Servicios Administrativos', texto: 'Gestión administrativa integral para optimizar procesos empresariales.' },
  { icono: '✅', titulo: 'Oficial de Cumplimiento', texto: 'Gestión de riesgos y cumplimiento normativo empresarial.' },
  { icono: '📜', titulo: 'Asesoría Jurídica', texto: 'Asesoría legal estratégica para protección y cumplimiento empresarial.' },
];

export default function HomePage() {
  return (
    <main style={main}>
      <Header activo="/" />

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${NAVY_DARK}, ${NAVY})`, color: '#fff', padding: '66px 24px 76px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 800, letterSpacing: 0.6, background: 'rgba(72,213,151,0.16)', color: BRAND, padding: '6px 14px', borderRadius: 999, marginBottom: 20 }}>
            Contadores públicos · Villavicencio, cobertura nacional
          </div>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, fontWeight: 900, margin: '0 0 18px' }}>
            Impulsa tu empresa con el <span style={{ color: BRAND }}>respaldo de expertos</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.65, opacity: 0.92, margin: '0 0 30px' }}>
            Acompañamos a empresas y emprendedores con asesoría contable, financiera y legal confiable: cumplimiento
            normativo, optimización de recursos y apoyo permanente para un crecimiento sostenible y seguro.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contacto" className="dbtn primary" style={{ fontSize: 15.5, padding: '13px 26px' }}>Solicita una asesoría</a>
            <a href="/servicios" className="dbtn ghost" style={{ fontSize: 15.5, padding: '13px 26px' }}>Ver servicios</a>
          </div>
        </div>
      </section>

      {/* Pilares */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '54px 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 20 }}>
          {PILARES.map((p) => (
            <div key={p.titulo} style={card}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{p.icono}</div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 7px' }}>{p.titulo}</h3>
              <p style={{ color: MUTED, fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Nosotros (resumen) */}
      <section style={{ background: '#F7F9FB', padding: '62px 24px', marginTop: 56 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: BRAND, marginBottom: 8 }}>Nosotros</div>
          <h2 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 16px' }}>Construye el futuro de tu empresa con expertos</h2>
          <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.75, margin: '0 0 14px' }}>
            Somos una firma de contadores públicos y asesores financieros, legalmente constituida desde <strong>2019</strong>,
            con cobertura en todo el territorio nacional y un equipo de <strong>más de 30 profesionales especializados</strong>.
          </p>
          <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.75, margin: '0 0 26px' }}>
            Estamos autorizados por la Junta Central de Contadores y certificados en <strong>ISO 9001:2015</strong> por
            SGS Colombia S.A.S., garantizando altos estándares de calidad y mejores prácticas.
          </p>
          <a href="/nosotros" className="dbtn navy" style={{ fontSize: 15, padding: '12px 24px' }}>Conócenos</a>
        </div>
      </section>

      {/* Servicios */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '62px 24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h2 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 10px' }}>Nuestros servicios</h2>
          <p style={{ color: MUTED, fontSize: 16.5, margin: '0 auto', maxWidth: 620, lineHeight: 1.6 }}>
            Descubre cómo nuestros servicios impulsan tu crecimiento empresarial.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
          {SERVICIOS.map((s) => (
            <a key={s.titulo} href="/servicios" style={{ ...card, textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(72,213,151,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 13 }}>{s.icono}</div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 7px' }}>{s.titulo}</h3>
              <p style={{ color: MUTED, fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{s.texto}</p>
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="/servicios" className="dbtn navy" style={{ fontSize: 15, padding: '12px 24px' }}>Ver portafolio completo</a>
        </div>
      </section>

      {/* Cierre + contacto */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '62px 24px 70px' }}>
        <div style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, color: '#fff', borderRadius: 14, padding: '44px 32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 27, fontWeight: 900, margin: '0 0 10px' }}>Da el paso hoy hacia una gestión segura</h2>
          <p style={{ opacity: 0.9, fontSize: 16.5, margin: '0 0 24px' }}>
            Tu empresa puede ser nuestro próximo caso de éxito. Los resultados reales comienzan con una decisión inteligente.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contacto" className="dbtn primary" style={{ fontSize: 15.5, padding: '13px 26px' }}>Solicitar cotización</a>
            <a href={CONTACTO.telefonoHref} className="dbtn ghost" style={{ fontSize: 15.5, padding: '13px 26px' }}>PBX {CONTACTO.telefono}</a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
