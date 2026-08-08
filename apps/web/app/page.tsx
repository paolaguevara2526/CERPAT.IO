// apps/web/app/page.tsx
//
// Home del sitio institucional (cerpat.io/), migrada del WordPress de cerpat.com
// conservando su identidad visual: Poppins, índigo #392B87, verde #48D597 y
// lavanda. Las páginas interiores son /nosotros, /servicios, /contacto y
// /trabaja-con-nosotros. El planeador (con su propio estilo) vive en /planeador.

import type { Metadata } from 'next';
import {
  Header, Footer, Clientes, FuentePoppins, CONTACTO,
  INDIGO, INDIGO_2, BRAND, LILA, LILA_2, TEXTO, TITULO,
  btnVerde, btnLinea, btnBlanco, card, main,
} from './_sitio/Sitio';

export const metadata: Metadata = {
  title: 'CERPAT Contadores · Asesoría contable, tributaria y revisoría fiscal',
  description:
    'Firma de contadores públicos y asesores financieros en Villavicencio, con cobertura nacional. Asesoría contable, tributaria, revisoría fiscal, auditoría externa y forense. Certificados ISO 9001:2015.',
};

const PILARES = [
  { icono: '🏅', titulo: 'Experiencia Profesional', texto: 'Más de 7 años asesorando empresas con soluciones contables y financieras confiables.' },
  { icono: '🎯', titulo: 'Atención Personalizada', texto: 'Analizamos cada caso para ofrecer estrategias adaptadas a sus necesidades.' },
  { icono: '🛡️', titulo: 'Cumplimiento y Seguridad', texto: 'Garantizamos procesos alineados con la normativa vigente y mejores prácticas.' },
  { icono: '🤝', titulo: 'Acompañamiento Integral', texto: 'Soporte permanente en áreas contables, tributarias, financieras y legales.' },
];

const SERVICIOS = [
  { img: 'foto-apoyo-asesoria-contable-y-financiera', titulo: 'Asesoría Contable y Financiera', texto: 'Soluciones contables y financieras para su empresa.' },
  { img: 'foto-apoyo-asesoria-tributaria', titulo: 'Asesoría Tributaria', texto: 'Estrategias tributarias eficientes para el crecimiento empresarial.' },
  { img: 'foto-apoyo-auditoria-externa-y-revisoria-fiscal', titulo: 'Revisoría Fiscal', texto: 'Control fiscal independiente para seguridad y cumplimiento empresarial.' },
  { img: 'foto-apoyo-4b', titulo: 'Auditoría Externa', texto: 'Evaluación independiente para fortalecer control y transparencia empresarial.' },
  { img: 'foto-apoyo-auditoria-forense', titulo: 'Auditoría Forense', texto: 'Detección de fraudes y análisis financiero especializado.' },
  { img: 'foto-apoyo-servicios-administrativos', titulo: 'Servicios Administrativos', texto: 'Gestión administrativa integral para optimizar procesos empresariales.' },
  { img: 'foto-apoyo-oficial-de-cumplimiento', titulo: 'Oficial de Cumplimiento', texto: 'Gestión de riesgos y cumplimiento normativo empresarial.' },
  { img: 'foto-apoyo-asesoria-juridica-en-derecho-comercial-y-laboral', titulo: 'Asesoría Jurídica', texto: 'Asesoría legal estratégica para protección y cumplimiento empresarial.' },
];

const RAZONES = [
  { titulo: 'Enfoque en Resultados', texto: 'Trabajamos para mejorar la rentabilidad y la estabilidad financiera de su empresa.' },
  { titulo: 'Equipo Especializado', texto: 'Más de 30 profesionales en contabilidad, auditoría, tributación y derecho.' },
  { titulo: 'Respaldo y Certificación', texto: 'Autorizados por la Junta Central de Contadores y certificados ISO 9001:2015.' },
];

export default function HomePage() {
  return (
    <main style={main}>
      <FuentePoppins />
      <Header activo="/" />

      {/* Hero con la foto de la cumbre (motivo de marca del sitio anterior) */}
      <section style={{
        background: `linear-gradient(105deg, rgba(57,43,135,.94) 0%, rgba(43,52,135,.86) 55%, rgba(15,23,42,.72) 100%), url('/sitio/vista-cima-montana.webp') center/cover`,
        color: '#fff', padding: '86px 24px 96px',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ maxWidth: 660 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: BRAND, marginBottom: 16 }}>
              Contadores públicos · Cobertura nacional
            </div>
            <h1 style={{ fontSize: 46, lineHeight: 1.14, fontWeight: 700, margin: '0 0 18px', letterSpacing: '-0.8px' }}>
              Impulsa tu empresa con el <span style={{ color: BRAND }}>respaldo de expertos</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.7, opacity: 0.93, margin: '0 0 30px' }}>
              Acompañamos a empresas y emprendedores con asesoría contable, financiera y legal confiable:
              cumplimiento normativo, optimización de recursos y apoyo permanente para un crecimiento
              sostenible y seguro del negocio.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <a href="/contacto" style={btnVerde}>Solicita una asesoría</a>
              <a href="/servicios" style={btnBlanco}>Ver servicios</a>
            </div>
          </div>
        </div>
      </section>

      {/* Pilares */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '58px 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22 }}>
          {PILARES.map((p) => (
            <div key={p.titulo} style={card}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: LILA, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, marginBottom: 14 }}>{p.icono}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: TITULO }}>{p.titulo}</h3>
              <p style={{ color: TEXTO, fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Nosotros con foto */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '70px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 44, alignItems: 'center' }}>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sitio/grupo-personas-que-elaboran-plan-negocios-oficina.webp" alt="Equipo de CERPAT trabajando" style={{ width: '100%', height: 'auto', borderRadius: 18, display: 'block' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: BRAND, marginBottom: 10 }}>Nosotros</div>
            <h2 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.25, letterSpacing: '-0.5px' }}>
              Impulsa tu Empresa con el Respaldo de Expertos
            </h2>
            <p style={{ color: TEXTO, fontSize: 16, lineHeight: 1.8, margin: '0 0 20px' }}>
              Somos un equipo profesional comprometido con brindar soluciones contables, financieras y legales
              confiables. Acompañamos a empresas y emprendedores con asesoría estratégica, garantizando cumplimiento
              normativo, optimización de recursos y apoyo permanente para el crecimiento sostenible y seguro del negocio.
            </p>
            <ul style={{ margin: '0 0 26px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {['Crece con respaldo profesional', 'Tu éxito, nuestra prioridad', 'Gestión segura y estratégica'].map((t) => (
                <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 11, color: TITULO, fontSize: 15.5, fontWeight: 500 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: BRAND, color: '#08301F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <a href="/nosotros" style={btnLinea}>Ver más</a>
          </div>
        </div>
      </section>

      {/* Servicios con fotos */}
      <section style={{ background: LILA, padding: '70px 24px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: INDIGO, marginBottom: 10 }}>Nuestros Servicios</div>
            <h2 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.5px' }}>Descubre cómo impulsamos tu crecimiento</h2>
            <p style={{ color: TEXTO, fontSize: 16.5, margin: '0 auto', maxWidth: 640, lineHeight: 1.7 }}>
              Un portafolio integral para fortalecer la gestión, el cumplimiento y el crecimiento de su empresa.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(268px,1fr))', gap: 24 }}>
            {SERVICIOS.map((s) => (
              <a key={s.titulo} href="/servicios" style={{ ...card, padding: 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/sitio/${s.img}.webp`} alt="" style={{ width: '100%', height: 168, objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '20px 22px 24px' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: TITULO }}>{s.titulo}</h3>
                  <p style={{ color: TEXTO, fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>{s.texto}</p>
                </div>
              </a>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 38 }}>
            <a href="/servicios" style={btnLinea}>Ver más</a>
          </div>
        </div>
      </section>

      {/* Por qué nosotros */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '70px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: BRAND, marginBottom: 10 }}>¿Por qué nosotros?</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Nuestro compromiso con la excelencia</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {RAZONES.map((r, i) => (
            <div key={r.titulo} style={{ ...card, borderTop: `4px solid ${i === 1 ? BRAND : INDIGO}` }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 9px' }}>{r.titulo}</h3>
              <p style={{ color: TEXTO, fontSize: 15, lineHeight: 1.7, margin: 0 }}>{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <Clientes />

      {/* Cierre */}
      <section style={{ background: `linear-gradient(120deg, ${INDIGO}, ${INDIGO_2})`, color: '#fff', padding: '64px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.5px' }}>Da el paso hoy hacia una gestión segura</h2>
          <p style={{ opacity: 0.92, fontSize: 17, margin: '0 0 28px', lineHeight: 1.7 }}>
            Tu empresa puede ser nuestro próximo caso de éxito. Los resultados reales comienzan con una decisión inteligente.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contacto" style={btnVerde}>Solicitar cotización</a>
            <a href={CONTACTO.telefonoHref} style={btnBlanco}>PBX {CONTACTO.telefono}</a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
