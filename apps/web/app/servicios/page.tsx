// apps/web/app/servicios/page.tsx
// Portafolio de servicios (sitio institucional). Contenido migrado del WordPress
// de cerpat.com/servicios/. Las herramientas internas del equipo se movieron a
// /herramientas para que esta URL conserve el SEO del sitio anterior.

import type { Metadata } from 'next';
import { Header, Footer, Hero, BRAND, NAVY, NAVY_DARK, MUTED, card, main } from '../_sitio/Sitio';

export const metadata: Metadata = {
  title: 'Servicios · CERPAT Contadores',
  description: 'Asesoría contable y financiera, tributaria, revisoría fiscal, auditoría externa y forense, servicios administrativos, oficial de cumplimiento y asesoría jurídica.',
};

type Servicio = { icono: string; titulo: string; texto: string; items: string[] };

const SERVICIOS: Servicio[] = [
  {
    icono: '📊', titulo: 'Asesoría Contable y Financiera',
    texto: 'Acompañamiento experto para una gestión contable y financiera eficiente, estratégica y alineada con la normativa vigente. Con herramientas actualizadas y diagnósticos precisos te ayudamos a interpretar tus estados financieros, optimizar recursos y tomar decisiones basadas en información confiable.',
    items: ['Outsourcing contable', 'Presupuestos', 'Estados financieros', 'Sistemas contables', 'Análisis financiero', 'Proyecciones'],
  },
  {
    icono: '🧾', titulo: 'Asesoría Tributaria',
    texto: 'Asesoría especializada para garantizar el cumplimiento oportuno y eficiente de las obligaciones fiscales, alineando la gestión tributaria con los objetivos estratégicos de tu empresa. Diseñamos estrategias que minimizan riesgos, mejoran la eficiencia fiscal y aseguran el cumplimiento ante las autoridades.',
    items: ['Planeación tributaria', 'Impuestos municipales y nacionales', 'Información exógena en medios digitales', 'Optimización tributaria'],
  },
  {
    icono: '🛡️', titulo: 'Revisoría Fiscal',
    texto: 'Auditoría externa y revisoría fiscal enfocadas en garantizar la transparencia, integridad y confiabilidad de la información financiera. Evaluamos estados financieros, procesos contables y sistemas de control interno, asegurando su cumplimiento con las normas legales y fiscales vigentes.',
    items: ['Auditoría financiera', 'Auditoría de cumplimiento', 'Auditoría de control interno', 'Auditoría de nómina'],
  },
  {
    icono: '🔍', titulo: 'Auditoría Externa',
    texto: 'Vigilancia permanente del cumplimiento normativo, prevención de riesgos y recomendaciones para la mejora continua. Fortalece la credibilidad de tu empresa ante inversionistas, entidades de control y demás grupos de interés.',
    items: ['Auditoría de estados financieros', 'Evaluación de control interno', 'Auditoría de cumplimiento'],
  },
  {
    icono: '⚖️', titulo: 'Auditoría Forense',
    texto: 'Detección, prevención e investigación de fraudes, irregularidades financieras y conductas económicas indebidas, mediante técnicas especializadas de auditoría, contabilidad forense y análisis transaccional, alineadas con la normativa colombiana y estándares internacionales.',
    items: ['Investigación de fraudes', 'Contabilidad forense', 'Análisis transaccional', 'Peritajes y dictámenes'],
  },
  {
    icono: '🗂️', titulo: 'Servicios Administrativos',
    texto: 'Gestión administrativa integral para optimizar los procesos de tu empresa y liberar la carga operativa del equipo, con procedimientos ordenados y trazables.',
    items: ['Gestión documental', 'Nómina y seguridad social', 'Tesorería', 'Procesos administrativos'],
  },
  {
    icono: '✅', titulo: 'Oficial de Cumplimiento',
    texto: 'Gestión de riesgos y cumplimiento normativo empresarial, con acompañamiento en la prevención de lavado de activos y financiación del terrorismo (SARLAFT) y demás obligaciones de cumplimiento.',
    items: ['SARLAFT', 'Matriz de riesgos', 'Debida diligencia', 'Reportes a entidades de control'],
  },
  {
    icono: '📜', titulo: 'Asesoría Jurídica',
    texto: 'Asesoría legal estratégica para la protección y el cumplimiento de tu empresa, con acompañamiento en materia corporativa, laboral y tributaria.',
    items: ['Derecho corporativo', 'Derecho laboral', 'Derecho tributario', 'Contratos'],
  },
];

export default function ServiciosPage() {
  return (
    <main style={main}>
      <Header activo="/servicios" />
      <Hero
        eyebrow="Te ofrecemos"
        titulo="Nuestros Servicios"
        texto="Soluciones profesionales que fortalecen la gestión y el crecimiento de su empresa."
      />

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 20px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: 'center', margin: '0 0 10px' }}>Nuestro portafolio completo</h2>
        <p style={{ textAlign: 'center', color: MUTED, fontSize: 16.5, margin: '0 auto 40px', maxWidth: 700, lineHeight: 1.6 }}>
          Explora nuestro portafolio integral de servicios, diseñado para fortalecer la gestión, el cumplimiento y el crecimiento de su empresa.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 22 }}>
          {SERVICIOS.map((s) => (
            <article key={s.titulo} style={card}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(72,213,151,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 14 }}>{s.icono}</div>
              <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}>{s.titulo}</h3>
              <p style={{ color: MUTED, fontSize: 14.5, lineHeight: 1.65, margin: '0 0 14px' }}>{s.texto}</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {s.items.map((i) => (
                  <li key={i} style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, background: 'rgba(46,80,144,0.08)', border: '1px solid rgba(46,80,144,0.16)', borderRadius: 999, padding: '4px 11px' }}>{i}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 24px 70px' }}>
        <div style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, color: '#fff', borderRadius: 14, padding: '40px 32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 10px' }}>Da el paso hoy hacia una gestión segura</h2>
          <p style={{ opacity: 0.9, fontSize: 16.5, margin: '0 0 22px' }}>
            Tu empresa puede ser nuestro próximo caso de éxito. Los resultados reales comienzan con una decisión inteligente.
          </p>
          <a href="/contacto" className="dbtn primary" style={{ fontSize: 15.5, padding: '13px 28px' }}>Solicitar cotización</a>
        </div>
      </section>

      <Footer />
    </main>
  );
}
