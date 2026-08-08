// apps/web/app/servicios/page.tsx
// Portafolio de servicios (sitio institucional). Contenido migrado del WordPress
// de cerpat.com/servicios/. Las herramientas internas del equipo se movieron a
// /herramientas para que esta URL conserve el SEO del sitio anterior.

import type { Metadata } from 'next';
import { Header, Footer, Hero, Clientes, FuentePoppins, INDIGO, INDIGO_2, BRAND, LILA, LILA_2, TEXTO, TITULO, btnVerde, btnBlanco, card, main } from '../_sitio/Sitio';

export const metadata: Metadata = {
  title: 'Servicios · CERPAT Contadores',
  description: 'Asesoría contable y financiera, tributaria, revisoría fiscal, auditoría externa y forense, servicios administrativos, oficial de cumplimiento y asesoría jurídica.',
};

type Servicio = { img: string; titulo: string; texto: string; items: string[] };

const SERVICIOS: Servicio[] = [
  {
    img: 'foto-apoyo-asesoria-contable-y-financiera', titulo: 'Asesoría Contable y Financiera',
    texto: 'Acompañamiento experto para una gestión contable y financiera eficiente, estratégica y alineada con la normativa vigente. Con herramientas actualizadas y diagnósticos precisos te ayudamos a interpretar tus estados financieros, optimizar recursos y tomar decisiones basadas en información confiable.',
    items: ['Outsourcing contable', 'Presupuestos', 'Estados financieros', 'Sistemas contables', 'Análisis financiero', 'Proyecciones'],
  },
  {
    img: 'foto-apoyo-asesoria-tributaria', titulo: 'Asesoría Tributaria',
    texto: 'Asesoría especializada para garantizar el cumplimiento oportuno y eficiente de las obligaciones fiscales, alineando la gestión tributaria con los objetivos estratégicos de tu empresa. Diseñamos estrategias que minimizan riesgos, mejoran la eficiencia fiscal y aseguran el cumplimiento ante las autoridades.',
    items: ['Planeación tributaria', 'Impuestos municipales y nacionales', 'Información exógena en medios digitales', 'Optimización tributaria'],
  },
  {
    img: 'foto-apoyo-auditoria-externa-y-revisoria-fiscal', titulo: 'Revisoría Fiscal',
    texto: 'Auditoría externa y revisoría fiscal enfocadas en garantizar la transparencia, integridad y confiabilidad de la información financiera. Evaluamos estados financieros, procesos contables y sistemas de control interno, asegurando su cumplimiento con las normas legales y fiscales vigentes.',
    items: ['Auditoría financiera', 'Auditoría de cumplimiento', 'Auditoría de control interno', 'Auditoría de nómina'],
  },
  {
    img: 'foto-apoyo-4b', titulo: 'Auditoría Externa',
    texto: 'Vigilancia permanente del cumplimiento normativo, prevención de riesgos y recomendaciones para la mejora continua. Fortalece la credibilidad de tu empresa ante inversionistas, entidades de control y demás grupos de interés.',
    items: ['Auditoría de estados financieros', 'Evaluación de control interno', 'Auditoría de cumplimiento'],
  },
  {
    img: 'foto-apoyo-auditoria-forense', titulo: 'Auditoría Forense',
    texto: 'Detección, prevención e investigación de fraudes, irregularidades financieras y conductas económicas indebidas, mediante técnicas especializadas de auditoría, contabilidad forense y análisis transaccional, alineadas con la normativa colombiana y estándares internacionales.',
    items: ['Investigación de fraudes', 'Contabilidad forense', 'Análisis transaccional', 'Peritajes y dictámenes'],
  },
  {
    img: 'foto-apoyo-servicios-administrativos', titulo: 'Servicios Administrativos',
    texto: 'Gestión administrativa integral para optimizar los procesos de tu empresa y liberar la carga operativa del equipo, con procedimientos ordenados y trazables.',
    items: ['Gestión documental', 'Nómina y seguridad social', 'Tesorería', 'Procesos administrativos'],
  },
  {
    img: 'foto-apoyo-oficial-de-cumplimiento', titulo: 'Oficial de Cumplimiento',
    texto: 'Gestión de riesgos y cumplimiento normativo empresarial, con acompañamiento en la prevención de lavado de activos y financiación del terrorismo (SARLAFT) y demás obligaciones de cumplimiento.',
    items: ['SARLAFT', 'Matriz de riesgos', 'Debida diligencia', 'Reportes a entidades de control'],
  },
  {
    img: 'foto-apoyo-asesoria-juridica-en-derecho-comercial-y-laboral', titulo: 'Asesoría Jurídica',
    texto: 'Asesoría legal estratégica para la protección y el cumplimiento de tu empresa, con acompañamiento en materia corporativa, laboral y tributaria.',
    items: ['Derecho corporativo', 'Derecho laboral', 'Derecho tributario', 'Contratos'],
  },
];

export default function ServiciosPage() {
  return (
    <main style={main}>
      <FuentePoppins />
      <Header activo="/servicios" />
      <Hero
        eyebrow="Te ofrecemos"
        titulo="Nuestros Servicios"
        texto="Soluciones profesionales que fortalecen la gestión y el crecimiento de su empresa."
        imagen="/sitio/empleados-reunion-negocios.webp"
      />

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 42 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: INDIGO, marginBottom: 10 }}>Portafolio</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.5px' }}>Nuestro portafolio completo de servicios</h2>
          <p style={{ color: TEXTO, fontSize: 16.5, margin: '0 auto', maxWidth: 720, lineHeight: 1.7 }}>
            Explora nuestro portafolio integral de servicios, diseñado para fortalecer la gestión, el cumplimiento y el crecimiento de su empresa.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {SERVICIOS.map((s, i) => (
            <article key={s.titulo} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/sitio/${s.img}.webp`} alt="" style={{ width: '100%', height: '100%', minHeight: 230, objectFit: 'cover', display: 'block', order: i % 2 === 0 ? 0 : 1 }} />
                <div style={{ padding: '30px 30px 32px' }}>
                  <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px', color: INDIGO }}>{s.titulo}</h3>
                  <p style={{ color: TEXTO, fontSize: 15, lineHeight: 1.8, margin: '0 0 18px' }}>{s.texto}</p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {s.items.map((it) => (
                      <li key={it} style={{ fontSize: 12.5, fontWeight: 600, color: INDIGO, background: LILA, border: `1px solid ${LILA_2}`, borderRadius: 999, padding: '5px 13px' }}>{it}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 56 }}><Clientes /></div>

      <section style={{ background: `linear-gradient(120deg, ${INDIGO}, ${INDIGO_2})`, color: '#fff', padding: '64px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.5px' }}>Da el paso hoy hacia una gestión segura</h2>
          <p style={{ opacity: 0.92, fontSize: 17, margin: '0 0 28px', lineHeight: 1.7 }}>
            Tu empresa puede ser nuestro próximo caso de éxito. Los resultados reales comienzan con una decisión inteligente.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contacto" style={btnVerde}>Solicitar cotización</a>
            <a href="/nosotros" style={btnBlanco}>Conócenos</a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
