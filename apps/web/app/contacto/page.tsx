// apps/web/app/contacto/page.tsx
// Página de contacto del sitio institucional. Contenido migrado del WordPress de
// cerpat.com/contacto/ (datos de contacto, formulario y ubicación).

import type { Metadata } from 'next';
import { Header, Footer, Hero, FuentePoppins, INDIGO, INDIGO_2, TEXTO, CONTACTO, btnVerde, card, main } from '../_sitio/Sitio';
import FormContacto from './FormContacto';

export const metadata: Metadata = {
  title: 'Contacto · CERPAT Contadores',
  description: 'Contáctanos para agendar una asesoría contable, tributaria o de revisoría fiscal. Villavicencio, Meta — Colombia.',
};

const MAPA = 'https://www.google.com/maps?q=Calle+26B+%2339-24+Villavicencio+Meta&output=embed';

export default function ContactoPage() {
  const datos = [
    { icono: '📞', titulo: 'Llámanos', valor: `PBX: ${CONTACTO.telefono}`, href: CONTACTO.telefonoHref },
    { icono: '✉️', titulo: 'Envía un email', valor: CONTACTO.email, href: `mailto:${CONTACTO.email}` },
    { icono: '📍', titulo: 'Visítanos', valor: `${CONTACTO.direccion} · ${CONTACTO.ciudad}`, href: null },
  ];

  return (
    <main style={main}>
      <FuentePoppins />
      <Header activo="/contacto" />
      <Hero
        eyebrow="Contacto"
        titulo="Contáctanos"
        texto="Contáctenos hoy para agendar una asesoría o conocer más sobre nuestros servicios."
        imagen="/sitio/scale.webp"
      />

      {/* Datos de contacto */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '52px 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
          {datos.map((d) => (
            <div key={d.titulo} style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{d.icono}</div>
              <div style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.5, color: '#98A2B3', fontWeight: 800, marginBottom: 6 }}>{d.titulo}</div>
              {d.href
                ? <a href={d.href} style={{ color: INDIGO, fontWeight: 700, fontSize: 15.5, textDecoration: 'none' }}>{d.valor}</a>
                : <div style={{ fontWeight: 700, fontSize: 15.5 }}>{d.valor}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Formulario + mapa */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 26, alignItems: 'start' }}>
          <div style={card}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Realiza tu solicitud</h2>
            <p style={{ color: TEXTO, fontSize: 14.5, margin: '0 0 20px' }}>Cuéntanos qué necesitas y te contactamos.</p>
            <FormContacto />
          </div>

          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 22px 14px' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Encuéntranos</h2>
              <p style={{ color: TEXTO, fontSize: 14.5, margin: 0 }}>
                {CONTACTO.direccion} — {CONTACTO.ciudad}
              </p>
            </div>
            <iframe
              src={MAPA}
              title="Ubicación de CERPAT en Villavicencio"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{ width: '100%', height: 320, border: 0, display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 70px' }}>
        <div style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_2})`, color: '#fff', borderRadius: 18, padding: '44px 30px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 25, fontWeight: 700, margin: '0 0 8px' }}>Da el paso hoy hacia una gestión segura</h2>
          <p style={{ opacity: 0.9, fontSize: 16, margin: '0 0 20px' }}>Tu empresa puede ser nuestro próximo caso de éxito.</p>
          <a href={CONTACTO.telefonoHref} style={btnVerde}>Llámanos ahora</a>
        </div>
      </section>

      <Footer />
    </main>
  );
}
