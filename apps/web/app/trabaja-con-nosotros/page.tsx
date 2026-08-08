// apps/web/app/trabaja-con-nosotros/page.tsx
// Página de postulación del sitio institucional. Contenido migrado del WordPress
// de cerpat.com/trabaja-con-nosotros/. La hoja de vida se recibe por correo
// (el formulario anterior usaba un plugin de WordPress con subida de archivo).

import type { Metadata } from 'next';
import { Header, Footer, Hero, FuentePoppins, INDIGO, LILA, TEXTO, CONTACTO, btnPrimario, card, main } from '../_sitio/Sitio';

export const metadata: Metadata = {
  title: 'Trabaja con nosotros · CERPAT Contadores',
  description: 'Únete al equipo de CERPAT: firma de contadores públicos y asesores financieros en Villavicencio, con más de 30 profesionales.',
};

const RAZONES = [
  { icono: '📈', titulo: 'Crecimiento profesional', texto: 'Trabajarás con clientes de distintos sectores y áreas —contable, tributaria, auditoría y cumplimiento—, ampliando tu experiencia técnica.' },
  { icono: '🤝', titulo: 'Equipo que acompaña', texto: 'Cada persona tiene un asesor o coordinador de referencia y un plan de trabajo claro, con seguimiento y retroalimentación.' },
  { icono: '🏔️', titulo: 'Cultura de excelencia', texto: 'Somos una firma certificada ISO 9001:2015, comprometida con la ética, la honestidad y la mejora continua.' },
];

const ASUNTO = encodeURIComponent('Postulación — Trabaja con nosotros');
const CUERPO = encodeURIComponent(
  ['Nombre completo:', 'Teléfono:', 'Ciudad:', 'Cargo de interés:', '', 'Adjunta tu hoja de vida a este correo.', ''].join('\n'),
);

export default function TrabajaPage() {
  return (
    <main style={main}>
      <FuentePoppins />
      <Header activo="/trabaja-con-nosotros" />
      <Hero
        eyebrow="Únete al equipo"
        titulo="Trabaja con Nosotros"
        texto="Únete a nuestro equipo y crece profesionalmente en un entorno dinámico, innovador y en constante evolución."
        imagen="/sitio/gente-disfrutando-deportes-nieve.webp"
      />

      <section style={{ maxWidth: 900, margin: '0 auto', padding: '54px 24px 10px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 27, fontWeight: 700, margin: '0 0 12px' }}>Postúlate ahora</h2>
        <p style={{ color: TEXTO, fontSize: 17, lineHeight: 1.7, margin: 0 }}>
          Buscamos personas talentosas, comprometidas y con ganas de aprender y construir grandes proyectos junto a nosotros.
        </p>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '38px 24px 10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 22 }}>
          {RAZONES.map((r) => (
            <div key={r.titulo} style={card}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: LILA, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 14 }}>{r.icono}</div>
              <h3 style={{ fontSize: 18.5, fontWeight: 800, margin: '0 0 8px' }}>{r.titulo}</h3>
              <p style={{ color: TEXTO, fontSize: 15, lineHeight: 1.65, margin: 0 }}>{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Envío de la hoja de vida */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '44px 24px 70px' }}>
        <div style={{ ...card, textAlign: 'center', padding: '34px 28px' }}>
          <h2 style={{ fontSize: 23, fontWeight: 700, margin: '0 0 10px' }}>Envíanos tu información</h2>
          <p style={{ color: TEXTO, fontSize: 15.5, lineHeight: 1.7, margin: '0 0 22px' }}>
            Escríbenos adjuntando tu <strong>hoja de vida</strong> e indícanos tu nombre, teléfono, ciudad y el cargo que te
            interesa. Revisamos todas las postulaciones y te contactamos si tu perfil se ajusta a una vacante.
          </p>
          <a href={`mailto:${CONTACTO.email}?subject=${ASUNTO}&body=${CUERPO}`} style={btnPrimario}>
            Enviar mi hoja de vida
          </a>
          <p style={{ fontSize: 13, color: '#667085', margin: '16px 0 0' }}>
            O escríbenos directamente a <a href={`mailto:${CONTACTO.email}`} style={{ color: INDIGO, fontWeight: 700 }}>{CONTACTO.email}</a>
            {' · '}PBX <a href={CONTACTO.telefonoHref} style={{ color: INDIGO, fontWeight: 700 }}>{CONTACTO.telefono}</a>
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
