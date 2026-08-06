'use client';
// apps/web/app/login/page.tsx — pantalla de inicio de sesión.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <main style={{ fontFamily: 'var(--ui)', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20,
      background: 'radial-gradient(1100px 560px at 70% -10%, rgba(52,201,139,0.10), transparent 60%), linear-gradient(160deg, #0f1d33, #16294a)' }}>
      <div className="win" style={{ width: '100%', maxWidth: 400 }}>
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
    </main>
  );
}
