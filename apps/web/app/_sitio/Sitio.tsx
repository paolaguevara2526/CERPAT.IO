// Marco compartido del sitio institucional (cerpat.io): cabecera, pie y tokens.
//
// El sitio público conserva la identidad del sitio anterior (cerpat.com):
// tipografía Poppins, índigo #392B87 como color principal, verde #48D597 de
// acento y lavanda #F2F0FE en los fondos. El planeador mantiene su propio estilo
// de "software de escritorio" (desktop.css) — son dos lenguajes distintos a propósito.

export const INDIGO = '#392B87';       // color principal de marca (sitio)
export const INDIGO_2 = '#2B3487';     // variante para degradados
export const INDIGO_DARK = '#0F172A';  // fondos oscuros
export const BRAND = '#48D597';        // verde CERPAT
export const BRAND_DARK = '#41BA85';
export const LILA = '#F2F0FE';         // fondo suave
export const LILA_2 = '#D8D8F5';       // bordes / detalles
export const TEXTO = '#454F5E';        // texto corrido
export const TITULO = '#0F172A';

export const CONTACTO = {
  telefono: '(+57) 312 432 4791',
  telefonoHref: 'tel:+573124324791',
  email: 'info@cerpat.com',
  direccion: 'Calle 26B #39-24, Piso 4',
  ciudad: 'Villavicencio, Meta — Colombia',
};

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/servicios', label: 'Servicios' },
  { href: '/trabaja-con-nosotros', label: 'Trabaja con nosotros' },
  { href: '/contacto', label: 'Contacto' },
];

// Poppins desde Google Fonts, igual que el sitio anterior.
export const FUENTE = "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function FuentePoppins() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    </>
  );
}

export function Logo({ variant = 'blanco', height = 34 }: { variant?: 'blanco' | 'color'; height?: number }) {
  const src = variant === 'blanco' ? '/logo-cerpat-blanco.svg' : '/logo-cerpat.svg';
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="CERPAT Contadores" style={{ height, width: 'auto', display: 'block' }} />;
}

export function Header({ activo }: { activo?: string }) {
  return (
    <header style={{ background: '#fff', borderBottom: `1px solid ${LILA_2}`, position: 'sticky', top: 0, zIndex: 50 }}>
      <nav style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Logo variant="color" height={34} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {NAV.map((n) => (
            <a key={n.href} href={n.href}
              style={{
                color: activo === n.href ? INDIGO : TEXTO, textDecoration: 'none', fontWeight: activo === n.href ? 700 : 500,
                fontSize: 14.5, borderBottom: activo === n.href ? `2px solid ${BRAND}` : '2px solid transparent', paddingBottom: 3,
              }}>
              {n.label}
            </a>
          ))}
          <a href="/contacto" style={btnPrimario}>Solicitar asesoría</a>
          <a href="/planeador" style={{ ...btnLinea, padding: '9px 16px', fontSize: 13.5 }}>Acceder</a>
        </div>
      </nav>
    </header>
  );
}

export const btnPrimario: React.CSSProperties = {
  display: 'inline-block', background: INDIGO, color: '#fff', textDecoration: 'none',
  fontWeight: 600, fontSize: 14.5, padding: '11px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
};
export const btnVerde: React.CSSProperties = { ...btnPrimario, background: BRAND, color: '#08301F' };
export const btnLinea: React.CSSProperties = {
  display: 'inline-block', background: 'transparent', color: INDIGO, textDecoration: 'none',
  fontWeight: 600, fontSize: 14.5, padding: '10px 21px', borderRadius: 999, border: `1.5px solid ${INDIGO}`, cursor: 'pointer',
};
export const btnBlanco: React.CSSProperties = {
  display: 'inline-block', background: '#fff', color: INDIGO, textDecoration: 'none',
  fontWeight: 600, fontSize: 14.5, padding: '11px 22px', borderRadius: 999,
};

export function Footer() {
  return (
    <footer style={{ background: INDIGO_DARK, color: '#fff', padding: '46px 24px 26px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 30 }}>
        <div>
          <Logo variant="blanco" height={30} />
          <p style={{ opacity: 0.78, fontSize: 13.5, lineHeight: 1.7, marginTop: 14 }}>
            Firma de contadores públicos y asesores financieros. Constituida en 2019, con cobertura en todo el territorio nacional.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sitio/logo-iso-9001.webp" alt="Certificación ISO 9001:2015" style={{ height: 44, width: 'auto', background: '#fff', borderRadius: 6, padding: 4 }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sitio/logo-junta-central-de-contadores.webp" alt="Junta Central de Contadores" style={{ height: 44, width: 'auto', background: '#fff', borderRadius: 6, padding: 4 }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: BRAND, marginBottom: 12 }}>Navegación</div>
          {NAV.map((n) => (
            <a key={n.href} href={n.href} style={{ display: 'block', color: '#fff', opacity: 0.8, textDecoration: 'none', fontSize: 13.5, marginBottom: 8 }}>{n.label}</a>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: BRAND, marginBottom: 12 }}>Servicios</div>
          {['Asesoría Contable y Financiera', 'Asesoría Tributaria', 'Revisoría Fiscal', 'Auditoría Forense', 'Oficial de Cumplimiento'].map((s) => (
            <a key={s} href="/servicios" style={{ display: 'block', color: '#fff', opacity: 0.8, textDecoration: 'none', fontSize: 13.5, marginBottom: 8 }}>{s}</a>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: BRAND, marginBottom: 12 }}>Contacto</div>
          <a href={CONTACTO.telefonoHref} style={{ display: 'block', color: '#fff', opacity: 0.8, textDecoration: 'none', fontSize: 13.5, marginBottom: 8 }}>PBX: {CONTACTO.telefono}</a>
          <a href={`mailto:${CONTACTO.email}`} style={{ display: 'block', color: '#fff', opacity: 0.8, textDecoration: 'none', fontSize: 13.5, marginBottom: 8 }}>{CONTACTO.email}</a>
          <div style={{ opacity: 0.8, fontSize: 13.5, lineHeight: 1.6 }}>{CONTACTO.direccion}<br />{CONTACTO.ciudad}</div>
        </div>
      </div>
      <div style={{ maxWidth: 1180, margin: '30px auto 0', paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.14)', fontSize: 13, opacity: 0.65 }}>
        © {new Date().getFullYear()} CERPAT S.A.S. · Villavicencio, Meta — Colombia
      </div>
    </footer>
  );
}

// Encabezado de página interior: título sobre el índigo de marca.
export function Hero({ eyebrow, titulo, texto, imagen }: { eyebrow?: string; titulo: string; texto?: string; imagen?: string }) {
  return (
    <section style={{
      background: imagen
        ? `linear-gradient(rgba(57,43,135,.86), rgba(15,23,42,.90)), url('${imagen}') center/cover`
        : `linear-gradient(120deg, ${INDIGO}, ${INDIGO_2})`,
      color: '#fff', padding: '68px 24px 74px',
    }}>
      <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        {eyebrow && (
          <div style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BRAND, marginBottom: 14 }}>{eyebrow}</div>
        )}
        <h1 style={{ fontSize: 42, lineHeight: 1.15, fontWeight: 700, margin: '0 0 14px', letterSpacing: '-0.5px' }}>{titulo}</h1>
        {texto && <p style={{ fontSize: 17.5, lineHeight: 1.7, opacity: 0.92, margin: 0, fontWeight: 400 }}>{texto}</p>}
      </div>
    </section>
  );
}

export const card: React.CSSProperties = {
  background: '#fff', border: `1px solid ${LILA_2}`, borderRadius: 16, padding: '26px 24px',
  boxShadow: '0 2px 14px rgba(57,43,135,0.06)',
};

export const main: React.CSSProperties = {
  fontFamily: FUENTE, margin: 0, color: TITULO, background: '#fff',
};

// Franja de logos de clientes (la traía el sitio anterior en la home).
const CLIENTES = [
  'cliente-asdisan', 'cliente-business-group', 'cliente-distransllanos', 'cliente-ecomantos',
  'cliente-ecoplanta', 'cliente-grasscol', 'cliente-servicasinos', 'cliente-sky', 'cliente-transportes-gayco-sas',
];

export function Clientes() {
  return (
    <section style={{ background: LILA, padding: '48px 24px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <p style={{ textAlign: 'center', color: TEXTO, fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 26px' }}>
          Empresas que confían en nosotros
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30, justifyContent: 'center', alignItems: 'center' }}>
          {CLIENTES.map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c} src={`/sitio/${c}.webp`} alt="" style={{ height: 46, width: 'auto', objectFit: 'contain', opacity: 0.75 }} />
          ))}
        </div>
      </div>
    </section>
  );
}
