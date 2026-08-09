'use client';
// apps/web/app/cambiar-clave/page.tsx — cambio de contraseña (obligatorio en el
// primer ingreso).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function CambiarClavePage() {
  const router = useRouter();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    setCargando(true);
    try {
      const res = await fetch('/api/auth/cambiar-clave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo cambiar la contraseña.'); setCargando(false); return; }
      router.replace('/planeador');
    } catch {
      setError('Error de red. Intenta de nuevo.');
      setCargando(false);
    }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: 6, border: '1px solid var(--edge-strong)',
    background: 'var(--panel)', color: 'var(--ink)', fontSize: 14, fontFamily: 'var(--ui)',
    boxShadow: 'inset 0 1px 2px var(--lo)', marginTop: 5,
  };

  return (
    <main style={{ fontFamily: 'var(--ui)', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20,
      background: 'radial-gradient(1100px 560px at 70% -10%, rgba(52,201,139,0.10), transparent 60%), linear-gradient(160deg, #0f1d33, #16294a)' }}>
      <div className="win" style={{ width: '100%', maxWidth: 420 }}>
        <div className="win-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
          <span className="win-title">Cambiar contraseña</span>
        </div>
        <div className="win-body" style={{ padding: 24 }}>
          <p style={{ margin: '0 0 18px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            Por seguridad, define una contraseña nueva antes de continuar.
          </p>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>Contraseña actual (temporal)
              <input style={input} type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} placeholder="••••••••" />
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>Nueva contraseña
              <input style={input} type="password" autoComplete="new-password" required value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="mínimo 8 caracteres" />
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>Confirmar nueva contraseña
              <input style={input} type="password" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="repite la nueva" />
            </label>
            {error && <div style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600 }}>{error}</div>}
            <button type="submit" className="dbtn primary" disabled={cargando} style={{ justifyContent: 'center', padding: '11px', fontSize: 14, opacity: cargando ? 0.7 : 1 }}>
              {cargando ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
