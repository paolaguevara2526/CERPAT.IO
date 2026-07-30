'use client';
// Botón de cerrar sesión: borra la cookie (vía API) y vuelve al login.

export default function LogoutButton({ nombre }: { nombre?: string }) {
  async function salir() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {nombre && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{nombre}</span>}
      <button onClick={salir} className="dbtn" style={{ fontSize: 12, padding: '6px 12px' }}>Salir</button>
    </span>
  );
}
