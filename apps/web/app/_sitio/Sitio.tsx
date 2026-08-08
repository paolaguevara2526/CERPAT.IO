// Marco compartido del sitio institucional (cerpat.io): cabecera, pie y tokens de
// marca. Lo usan la home y las páginas migradas desde el WordPress de cerpat.com
// (Nosotros, Servicios, Contacto, Trabaja con nosotros).

export const BRAND = '#48D597';      // verde oficial CERPAT
export const NAVY = '#2E5090';
export const NAVY_DARK = '#0F1D33';
export const INK = '#101828';
export const MUTED = '#475467';

// Datos de contacto de la firma (fuente: sitio anterior cerpat.com).
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

export function Logo({ variant = 'blanco', height = 30 }: { variant?: 'blanco' | 'color'; height?: number }) {
  const src = variant === 'blanco' ? '/logo-cerpat-blanco.svg' : '/logo-cerpat.svg';
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="CERPAT Contadores" style={{ height, width: 'auto', display: 'block' }} />;
}

export function Header({ activo }: { activo?: string }) {
  return (
    <header style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, color: '#fff' }}>
      <nav style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Logo variant="blanco" height={28} />
          <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600, color: '#fff' }}>Contadores</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {NAV.map((n) => (
            <a key={n.href} href={n.href}
              style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 14.5, opacity: activo === n.href ? 1 : 0.86, borderBottom: activo === n.href ? `2px solid ${BRAND}` : '2px solid transparent', paddingBottom: 2 }}>
              {n.label}
            </a>
          ))}
          <a href="/planeador" className="dbtn primary" style={{ fontSize: 14 }}>Acceder</a>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={{ background: NAVY_DARK, color: '#fff', padding: '38px 24px 26px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 26 }}>
        <div>
          <Logo variant="blanco" height={26} />
          <p style={{ opacity: 0.75, fontSize: 13.5, lineHeight: 1.6, marginTop: 12 }}>
            Firma de contadores públicos y asesores financieros. Constituida en 2019, con cobertura nacional.
          </p>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.6, marginBottom: 10 }}>Navegación</div>
          {NAV.map((n) => (
            <a key={n.href} href={n.href} style={{ display: 'block', color: '#fff', opacity: 0.82, textDecoration: 'none', fontSize: 13.5, marginBottom: 6 }}>{n.label}</a>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.6, marginBottom: 10 }}>Contacto</div>
          <a href={CONTACTO.telefonoHref} style={{ display: 'block', color: '#fff', opacity: 0.82, textDecoration: 'none', fontSize: 13.5, marginBottom: 6 }}>PBX: {CONTACTO.telefono}</a>
          <a href={`mailto:${CONTACTO.email}`} style={{ display: 'block', color: '#fff', opacity: 0.82, textDecoration: 'none', fontSize: 13.5, marginBottom: 6 }}>{CONTACTO.email}</a>
          <div style={{ opacity: 0.82, fontSize: 13.5 }}>{CONTACTO.direccion}<br />{CONTACTO.ciudad}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.6, marginBottom: 10 }}>Respaldo</div>
          <div style={{ opacity: 0.82, fontSize: 13.5, lineHeight: 1.7 }}>
            Junta Central de Contadores<br />
            ISO 9001:2015 — SGS Colombia<br />
            Cámara de Comercio de Villavicencio
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1120, margin: '26px auto 0', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.14)', fontSize: 13, opacity: 0.7 }}>
        © {new Date().getFullYear()} CERPAT S.A.S. · Villavicencio, Meta
      </div>
    </footer>
  );
}

// Encabezado de página interior (título + bajada sobre el navy de marca).
export function Hero({ eyebrow, titulo, texto }: { eyebrow?: string; titulo: string; texto?: string }) {
  return (
    <section style={{ background: `linear-gradient(135deg, ${NAVY_DARK}, ${NAVY})`, color: '#fff', padding: '58px 24px 64px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        {eyebrow && (
          <div style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', background: 'rgba(72,213,151,0.16)', color: BRAND, padding: '6px 14px', borderRadius: 999, marginBottom: 18 }}>{eyebrow}</div>
        )}
        <h1 style={{ fontSize: 40, lineHeight: 1.12, fontWeight: 900, margin: '0 0 14px' }}>{titulo}</h1>
        {texto && <p style={{ fontSize: 17.5, lineHeight: 1.65, opacity: 0.92, margin: 0 }}>{texto}</p>}
      </div>
    </section>
  );
}

export const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #d8deea', borderRadius: 12, padding: '24px 22px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(16,24,40,0.10)',
};

export const main: React.CSSProperties = {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', margin: 0, color: INK, background: '#fff',
};
