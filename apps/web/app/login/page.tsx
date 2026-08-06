'use client';
// apps/web/app/login/page.tsx — pantalla de inicio de sesión.
// Hero fotográfico (foto de cumbre en /public/login-cumbre.webp) + formulario
// separado en HTML/CSS, con capas de animación sutil (parallax, nieve, niebla que
// deriva, brillo por la ruta a la cima) y velo de legibilidad tras la tarjeta.
// Respeta prefers-reduced-motion. Si la imagen no existe, degrada a navy.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const VERDE = '#34C98B';

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

type Copo = { left: number; size: number; dur: number; delay: number; dx: number; op: number };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const [copos, setCopos] = useState<Copo[]>([]);
  const [anim, setAnim] = useState(false);
  const bgRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const nieveRef = useRef<HTMLDivElement>(null);

  // Solo en cliente (evita desajuste de hidratación) y respeta reduce-motion.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    setAnim(true);
    setCopos(Array.from({ length: 46 }, () => ({
      left: Math.random() * 100, size: Math.random() * 2.6 + 1.4, dur: Math.random() * 8 + 7,
      delay: Math.random() * 9, dx: Math.random() * 8 - 4, op: Math.random() * 0.35 + 0.22,
    })));
    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      if (bgRef.current) bgRef.current.style.transform = `scale(1.07) translate(${x * -16}px, ${y * -12}px)`;
      if (skyRef.current) skyRef.current.style.transform = `translate(${x * -34}px, ${y * -20}px)`;
      if (nieveRef.current) nieveRef.current.style.transform = `translate(${x * -22}px, ${y * -14}px)`;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo iniciar sesión.'); setCargando(false); return; }
      router.replace(data.debeCambiarPassword ? '/cambiar-clave' : data.esCliente ? '/portal' : '/planeador');
    } catch {
      setError('Error de red. Intenta de nuevo.'); setCargando(false);
    }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: 6, border: '1px solid var(--edge-strong)',
    background: 'var(--panel)', color: 'var(--ink)', fontSize: 14, fontFamily: 'var(--ui)',
    boxShadow: 'inset 0 1px 2px var(--lo)', outlineColor: 'var(--navy)',
  };

  return (
    <main style={{ fontFamily: 'var(--ui)', minHeight: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#0f1d33' }}>
      <style>{`
        @keyframes cerpat-caer { 0%{transform:translate(0,-8vh);opacity:0} 12%{opacity:1} 100%{transform:translate(var(--dx),104vh);opacity:.15} }
        @keyframes cerpat-derivar { from{transform:translateX(-4%)} to{transform:translateX(4%)} }
        @keyframes cerpat-brillo { 0%{opacity:0} 20%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
      `}</style>

      {/* Capa 0 · foto de fondo (parallax) */}
      <div ref={bgRef} aria-hidden style={{
        position: 'absolute', inset: 0, transform: 'scale(1.07)', transformOrigin: 'center',
        transition: 'transform .18s ease-out', willChange: 'transform',
        backgroundColor: '#0f1d33', backgroundImage: "url('/login-cumbre.webp')",
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      }} />

      {/* Capa 1 · niebla/nubosidad que deriva muy lento */}
      {anim && (
        <div ref={skyRef} aria-hidden style={{ position: 'absolute', inset: '-6%', pointerEvents: 'none', transition: 'transform .3s ease-out', willChange: 'transform' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.5, mixBlendMode: 'screen',
            background: 'radial-gradient(60% 40% at 25% 30%, rgba(255,255,255,0.10), transparent 60%), radial-gradient(50% 35% at 75% 22%, rgba(255,255,255,0.08), transparent 60%)',
            animation: 'cerpat-derivar 26s ease-in-out infinite alternate' }} />
        </div>
      )}

      {/* Capa 2 · nieve */}
      {anim && (
        <div ref={nieveRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transition: 'transform .3s ease-out' }}>
          {copos.map((c, i) => (
            <span key={i} style={{
              position: 'absolute', top: 0, left: `${c.left}%`, width: c.size, height: c.size, borderRadius: '50%',
              background: '#fff', opacity: c.op, filter: 'blur(0.3px)',
              // @ts-expect-error variable CSS personalizada
              '--dx': `${c.dx}vw`,
              animation: `cerpat-caer ${c.dur}s linear ${c.delay}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Capa 3 · brillo recorriendo la ruta a la cima (aprox. sobre el pico derecho) */}
      {anim && (
        <svg aria-hidden viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', top: 0, right: 0, width: '46%', height: '100%', pointerEvents: 'none', opacity: 0.9 }}>
          <defs>
            <filter id="cerpat-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <path id="cerpat-ruta" d="M150 486 C 190 420 210 380 250 322 S 322 200 360 96" fill="none" />
          </defs>
          <use href="#cerpat-ruta" stroke={VERDE} strokeOpacity="0.28" strokeWidth="1.6" strokeDasharray="2 8" strokeLinecap="round" />
          <circle r="3.6" fill={VERDE} filter="url(#cerpat-glow)" style={{ animation: 'cerpat-brillo 5.5s ease-in-out infinite' }}>
            <animateMotion dur="5.5s" repeatCount="indefinite" rotate="auto"><mpath href="#cerpat-ruta" /></animateMotion>
          </circle>
        </svg>
      )}

      {/* Capa 4 · velos de legibilidad: global muy leve + oscurecido sutil tras la tarjeta */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(9,17,33,0.34) 0%, rgba(9,17,33,0.04) 28%, rgba(9,17,33,0.10) 64%, rgba(9,17,33,0.55) 100%), radial-gradient(620px 500px at 50% 46%, rgba(6,12,24,0.30), transparent 72%)' }} />

      {/* Contenido */}
      <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '30px 20px 20px' }}>
        <header style={{ textAlign: 'center', maxWidth: 620 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-cerpat-blanco.svg" alt="CERPAT" style={{ height: 46, width: 'auto', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,.5))' }} />
          <p style={{ margin: '12px 0 0', color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>
            Guiamos a nuestros clientes a <span style={{ color: VERDE, borderBottom: `2px solid ${VERDE}`, paddingBottom: 1 }}>la cima</span>
          </p>
        </header>

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

        <footer style={{ width: '100%', maxWidth: 1100, background: 'rgba(9,17,33,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
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
