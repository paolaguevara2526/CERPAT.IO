'use client';
// apps/web/app/login/page.tsx — pantalla de inicio de sesión.
// Hero fotográfico (foto de cumbre en /public/login-cumbre.jpg) + tarjeta de
// login + 4 pilares de marca. Si la imagen aún no existe, degrada a fondo navy y
// el login sigue funcionando.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const VERDE = '#34C98B';

// Íconos de los pilares (línea, verde de marca).
const ico = (d: string, extra?: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={VERDE} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{extra}
  </svg>
);
const PILARES: { titulo: string; desc: string; icon: React.ReactNode }[] = [
  { titulo: 'Experiencia', desc: 'Años impulsando proyectos de alto impacto.', icon: ico('M3 20l6-11 4 6 3-5 5 10z') },
  { titulo: 'Orientación', desc: 'Estrategia y planificación para llegar a la cima.', icon: ico('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', <path d="M15.5 8.5 11 11l-2.5 4.5L13 13z" />) },
  { titulo: 'Confianza', desc: 'Acompañamiento cercano en cada paso del camino.', icon: ico('M9.5 14.5l5-5', <><path d="M11 6.5l1-1a3.6 3.6 0 0 1 5 5l-1 1" /><path d="M13 17.5l-1 1a3.6 3.6 0 0 1-5-5l1-1" /></>) },
  { titulo: 'Resultados', desc: 'Alcanzamos juntos nuevas alturas.', icon: ico('M6 21V4m0 0h11l-2 3 2 3H6') },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo iniciar sesión.'); setCargando(false); return; }
      router.replace(data.debeCambiarPassword ? '/cambiar-clave' : data.esCliente ? '/portal' : '/planeador');
    } catch {
      setError('Error de red. Intenta de nuevo.');
      setCargando(false);
    }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: 6, border: '1px solid var(--edge-strong)',
    background: 'var(--panel)', color: 'var(--ink)', fontSize: 14, fontFamily: 'var(--ui)',
    boxShadow: 'inset 0 1px 2px var(--lo)', outlineColor: 'var(--navy)',
  };

  return (
    <main style={{
      fontFamily: 'var(--ui)', minHeight: '100vh', position: 'relative',
      backgroundColor: '#0f1d33',
      backgroundImage: "linear-gradient(180deg, rgba(9,17,33,0.55) 0%, rgba(9,17,33,0.18) 26%, rgba(9,17,33,0.28) 62%, rgba(9,17,33,0.72) 100%), url('/login-cumbre.jpg')",
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed',
    }}>
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '30px 20px 20px' }}>

        {/* Encabezado: logo + lema */}
        <header style={{ textAlign: 'center', maxWidth: 620 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-cerpat-blanco.svg" alt="CERPAT" style={{ height: 46, width: 'auto', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,.5))' }} />
          <p style={{ margin: '12px 0 0', color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>
            Guiamos a nuestros clientes a <span style={{ color: VERDE, borderBottom: `2px solid ${VERDE}`, paddingBottom: 1 }}>la cima</span>
          </p>
        </header>

        {/* Tarjeta de login */}
        <div className="win" style={{ width: '100%', maxWidth: 400, boxShadow: '0 26px 70px rgba(0,0,0,.55)' }}>
          <div className="win-bar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
            <span className="win-title">Iniciar sesión</span>
          </div>
          <div className="win-body" style={{ padding: 24 }}>
            <p style={{ margin: '0 0 18px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
              Planeador CERPAT · ingresa con tu correo <strong style={{ color: 'var(--ink)' }}>@cerpat.io</strong>.
            </p>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                Correo
                <input style={{ ...input, marginTop: 5 }} type="email" autoComplete="username" required
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="gerencia@cerpat.io" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                Contraseña
                <input style={{ ...input, marginTop: 5 }} type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </label>
              {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600 }}>{error}</div>}
              <button type="submit" className="dbtn primary" disabled={cargando} style={{ justifyContent: 'center', padding: '11px', fontSize: 14, opacity: cargando ? 0.7 : 1 }}>
                {cargando ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
          <div className="win-status"><span className="led" /> CERPAT · guiamos a nuestros clientes a la cima</div>
        </div>

        {/* Pilares de marca */}
        <footer style={{ width: '100%', maxWidth: 1100, background: 'rgba(9,17,33,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
            {PILARES.map((p) => (
              <div key={p.titulo} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ flex: '0 0 auto', marginTop: 1 }}>{p.icon}</span>
                <div>
                  <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>{p.titulo}</div>
                  <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 1.4 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
