// apps/web/app/nosotros/page.tsx
// Página "Nosotros" del sitio institucional. Contenido migrado del WordPress de
// cerpat.com/nosotros/ (historia, cifras, proceso, misión, visión y equipo).

import type { Metadata } from 'next';
import { Header, Footer, Hero, BRAND, NAVY, NAVY_DARK, MUTED, card, main } from '../_sitio/Sitio';

export const metadata: Metadata = {
  title: 'Nosotros · CERPAT Contadores',
  description: 'Firma de contadores públicos y asesores financieros constituida en 2019, con cobertura nacional, más de 30 profesionales y certificación ISO 9001:2015.',
};

const CIFRAS = [
  { valor: '7', etiqueta: 'Años de experiencia' },
  { valor: '+30', etiqueta: 'Profesionales especializados' },
  { valor: '1K', etiqueta: 'Clientes satisfechos' },
  { valor: '2K', etiqueta: 'Procesos terminados con éxito' },
];

const PROCESO = [
  { n: '1', titulo: 'Consulta', texto: 'Comenzamos con un diagnóstico personalizado para conocer su empresa y sus objetivos.' },
  { n: '2', titulo: 'Asesoramos', texto: 'Elaboramos una estrategia integral alineada con sus objetivos empresariales.' },
  { n: '3', titulo: 'Ejecutamos', texto: 'Nuestro equipo especializado ejecuta cada proceso con exactitud y responsabilidad.' },
];

const EQUIPO = [
  { nombre: 'Paola Guevara', cargo: 'Socia Directora · Gerente General', detalle: 'Especialista en Gestión y Auditoría Tributaria, Finanzas y Revisoría' },
  { nombre: 'Nataly Gualtero', cargo: 'Socia Directora', detalle: 'Magíster en Aseguramiento Financiero y Sostenibilidad Corporativa · Especialista en Control Gerencial Corporativo' },
  { nombre: 'Lidis Pardo', cargo: 'Coordinadora Administrativa y Financiera', detalle: 'Contadora Pública' },
  { nombre: 'Tania Castiblanco', cargo: 'Coordinadora de Auditoría y Revisoría Fiscal', detalle: 'Contadora Pública · Especialista' },
];

export default function NosotrosPage() {
  return (
    <main style={main}>
      <Header activo="/nosotros" />
      <Hero
        eyebrow="Nosotros"
        titulo="Construye el futuro de tu empresa con expertos"
        texto="Acompañamiento contable, financiero y legal para decisiones seguras y crecimiento sostenible."
      />

      {/* Quiénes somos */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 10px' }}>
        <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.75, margin: '0 0 18px' }}>
          Somos una firma de <strong>contadores públicos y asesores financieros</strong>, legalmente constituida desde
          <strong> 2019</strong>, con cobertura en todo el territorio nacional. Acompañamos a empresas de distintos sectores
          en la gestión contable, financiera y fiscal, brindando seguridad, claridad y respaldo técnico en entornos de alta
          exigencia normativa y de control.
        </p>
        <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.75, margin: '0 0 18px' }}>
          Contamos con un equipo de <strong>más de 30 profesionales especializados</strong> que ofrece servicios de auditoría,
          auditoría forense y análisis financiero avanzado. Apoyamos a nuestros clientes en la identificación y mitigación de
          riesgos, detección de fraudes, investigación de irregularidades y fortalecimiento del control interno.
        </p>
        <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.75, margin: 0 }}>
          Estamos registrados ante la <strong>Cámara de Comercio de Villavicencio</strong> y autorizados por la
          <strong> Junta Central de Contadores</strong>. Desde 2020 contamos con la certificación <strong>ISO 9001:2015</strong>,
          otorgada por SGS Colombia S.A.S., que respalda nuestro enfoque en la calidad, la mejora continua y la confianza de
          quienes nos eligen.
        </p>
      </section>

      {/* Cifras */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 18 }}>
          {CIFRAS.map((c) => (
            <div key={c.etiqueta} style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: NAVY, lineHeight: 1 }}>{c.valor}</div>
              <div style={{ color: MUTED, fontSize: 13.5, marginTop: 8, fontWeight: 600 }}>{c.etiqueta}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Misión y visión — con el motivo del sherpa/cumbre de la marca */}
      <section style={{ background: '#F7F9FB', padding: '58px 24px', marginTop: 20 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 22 }}>
          <article style={card}>
            <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: BRAND, marginBottom: 8 }}>La Cima</div>
            <h2 style={{ fontSize: 23, fontWeight: 900, margin: '0 0 12px' }}>Nuestra Misión</h2>
            <p style={{ color: MUTED, fontSize: 15.5, lineHeight: 1.75, margin: 0 }}>
              Brindamos servicios profesionales integrales en contabilidad, finanzas y tributación, orientados a empresas y
              personas que buscan tomar decisiones acertadas basadas en información confiable. Nos enfocamos en ofrecer
              soluciones precisas y oportunas, adaptadas a las necesidades de cada cliente, con el respaldo de un equipo humano
              comprometido con la ética, la honestidad y la excelencia profesional.
            </p>
          </article>
          <article style={card}>
            <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: BRAND, marginBottom: 8 }}>El Camino</div>
            <h2 style={{ fontSize: 23, fontWeight: 900, margin: '0 0 12px' }}>Nuestra Visión</h2>
            <p style={{ color: MUTED, fontSize: 15.5, lineHeight: 1.75, margin: 0 }}>
              Para el año 2028, CERPAT S.A.S. se proyecta como una firma líder en servicios contables, financieros y
              tributarios, reconocida por su compromiso con la sostenibilidad, la excelencia profesional y el desarrollo del
              talento humano. Consolidaremos un modelo de gestión que combine innovación, tecnología y solidez financiera,
              contribuyendo activamente al crecimiento económico y social de la región.
            </p>
          </article>
        </div>
      </section>

      {/* Proceso */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '58px 24px 10px' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: BRAND, marginBottom: 6 }}>Proceso</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Pasos para solicitar asesoría</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22 }}>
          {PROCESO.map((p) => (
            <div key={p.n} style={card}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17, marginBottom: 14 }}>{p.n}</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>{p.titulo}</h3>
              <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.65, margin: 0 }}>{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Equipo */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '58px 24px 70px' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: BRAND, marginBottom: 6 }}>Equipo</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Conócenos</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 22 }}>
          {EQUIPO.map((p) => (
            <div key={p.nombre} style={{ ...card, textAlign: 'center' }}>
              <div style={{ width: 62, height: 62, borderRadius: '50%', margin: '0 auto 14px', background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900 }}>
                {p.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}
              </div>
              <h3 style={{ fontSize: 17.5, fontWeight: 800, margin: '0 0 4px' }}>{p.nombre}</h3>
              <div style={{ color: NAVY, fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>{p.cargo}</div>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{p.detalle}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
