'use client';
// CRUD de usuarios: crear/editar (roles, cargo, área), activar/desactivar,
// restablecer contraseña y eliminar. Contra la API vía /api/admin/usuarios.

import { useEffect, useState, useCallback } from 'react';

type Rol = { id: string; nombre: string };
type Usuario = {
  id: string; nombre: string; email: string; cargo: string | null; area: string | null;
  activo: boolean; esRoot: boolean; debeCambiarPassword: boolean; roles: { id: string; nombre: string }[];
};
type Form = { nombre: string; email: string; cargo: string; area: string; roles: string[]; activo: boolean; passwordTemporal: string };
const VACIO: Form = { nombre: '', email: '', cargo: '', area: '', roles: [], activo: true, passwordTemporal: '' };

const ROL_COLOR: Record<string, string> = { Administrador: '#20259c', Coordinador: '#7a5af8', Asesor: '#0e9f6e', Auxiliar: '#3f83f8', Auditor: '#d98a00' };
const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 5, border: '1px solid var(--edge-strong)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--ui)', width: '100%' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 };

export default function UsuariosPanel() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editar, setEditar] = useState<Usuario | 'nuevo' | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const res = await fetch('/api/admin/usuarios', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setUsuarios(data.usuarios ?? []); else setError(data.error || 'No se pudo cargar.');
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    fetch('/api/admin/roles', { cache: 'no-store' }).then((r) => r.json()).then((d) => setRoles(d.roles ?? [])).catch(() => {});
  }, [cargar]);

  async function toggleActivo(u: Usuario) {
    const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !u.activo }) });
    if (res.ok) setUsuarios((p) => p.map((x) => (x.id === u.id ? { ...x, activo: !u.activo } : x)));
    else { const d = await res.json(); setError(d.error || 'No se pudo cambiar el estado.'); }
  }
  async function reset(u: Usuario) {
    if (!confirm(`¿Restablecer la contraseña de ${u.nombre}? Se le pedirá cambiarla al ingresar.`)) return;
    const res = await fetch(`/api/admin/usuarios/${u.id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const d = await res.json();
    if (res.ok) setAviso(`Contraseña de ${u.nombre} restablecida a: ${d.passwordTemporal} (deberá cambiarla al ingresar).`);
    else setError(d.error || 'No se pudo restablecer.');
  }
  async function eliminar(u: Usuario) {
    if (!confirm(`¿Eliminar a ${u.nombre}? Si tiene tareas, mejor desactívalo.`)) return;
    const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' });
    if (res.ok) setUsuarios((p) => p.filter((x) => x.id !== u.id));
    else { const d = await res.json(); setError(d.error || 'No se pudo eliminar.'); }
  }

  return (
    <div>
      {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      {aviso && <div style={{ background: '#E7F6EC', color: '#027a48', borderRadius: 6, padding: '9px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>{aviso}<button onClick={() => setAviso(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#027a48', fontWeight: 800 }}>✕</button></div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{usuarios.length} usuarios · {usuarios.filter((u) => u.activo).length} activos</span>
        <button className="dbtn primary" onClick={() => setEditar('nuevo')} style={{ fontSize: 13 }}>＋ Nuevo usuario</button>
      </div>

      <div className="panel">
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Cargo</th><th>Área</th><th>Roles</th><th>Activo</th><th>Acciones</th></tr></thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>No hay usuarios.</td></tr>
              ) : usuarios.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.nombre}{u.esRoot && <span className="chip" style={{ marginLeft: 8, color: '#20259c', background: '#e7e9ff', borderColor: '#c9ccff' }}>ROOT</span>}{u.debeCambiarPassword && <span title="Debe cambiar contraseña" style={{ marginLeft: 6 }}>🔑</span>}</td>
                  <td style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12.5 }}>{u.email}</td>
                  <td style={{ color: 'var(--muted)' }}>{u.cargo ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{u.area ?? '—'}</td>
                  <td>{u.roles.length === 0 ? <span style={{ color: 'var(--muted)' }}>—</span> : u.roles.map((r) => { const c = ROL_COLOR[r.nombre] ?? '#5b6478'; return <span key={r.id} className="chip" style={{ color: c, background: `${c}18`, borderColor: `${c}44`, marginRight: 4 }}>{r.nombre}</span>; })}</td>
                  <td><button onClick={() => toggleActivo(u)} disabled={u.esRoot} title={u.activo ? 'Activo' : 'Inactivo'} style={{ border: 'none', background: 'none', cursor: u.esRoot ? 'default' : 'pointer', fontSize: 20, lineHeight: 1, color: u.activo ? '#22a670' : '#9aa4b2', opacity: u.esRoot ? 0.5 : 1 }}>{u.activo ? '🟢' : '⚪'}</button></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditar(u)} title="Editar" style={ic('var(--navy)')}>✎</button>
                    <button onClick={() => reset(u)} title="Restablecer contraseña" style={ic('#c67c00')}>🔑</button>
                    {!u.esRoot && <button onClick={() => eliminar(u)} title="Eliminar" style={ic('#cf4436')}>🗑</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editar && <Editor usuario={editar} roles={roles} onClose={() => setEditar(null)} onGuardado={(msg) => { setEditar(null); setAviso(msg ?? null); cargar(); }} onError={setError} />}
    </div>
  );
}

const ic = (color: string): React.CSSProperties => ({ border: 'none', background: 'none', cursor: 'pointer', color, fontSize: 14, padding: '2px 5px' });

function Editor({ usuario, roles, onClose, onGuardado, onError }: { usuario: Usuario | 'nuevo'; roles: Rol[]; onClose: () => void; onGuardado: (msg?: string) => void; onError: (m: string) => void }) {
  const nuevo = usuario === 'nuevo';
  const [form, setForm] = useState<Form>(nuevo ? VACIO : {
    nombre: usuario.nombre, email: usuario.email, cargo: usuario.cargo ?? '', area: usuario.area ?? '',
    roles: usuario.roles.map((r) => r.id), activo: usuario.activo, passwordTemporal: '',
  });
  const [guardando, setGuardando] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleRol = (id: string) => setForm((f) => ({ ...f, roles: f.roles.includes(id) ? f.roles.filter((x) => x !== id) : [...f.roles, id] }));

  async function guardar() {
    if (!form.nombre.trim() || (nuevo && !form.email.trim())) { onError('Nombre y correo son obligatorios.'); return; }
    setGuardando(true);
    try {
      if (nuevo) {
        const res = await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        const d = await res.json();
        if (!res.ok) { onError(d.error || 'No se pudo crear.'); setGuardando(false); return; }
        onGuardado(`Usuario ${form.nombre} creado. Contraseña temporal: ${d.passwordTemporal} (deberá cambiarla al ingresar).`);
      } else {
        const res = await fetch(`/api/admin/usuarios/${(usuario as Usuario).id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: form.nombre, cargo: form.cargo, area: form.area, roles: form.roles, activo: form.activo }) });
        const d = await res.json();
        if (!res.ok) { onError(d.error || 'No se pudo guardar.'); setGuardando(false); return; }
        onGuardado();
      }
    } catch { onError('Error de red.'); setGuardando(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,51,0.55)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: '100%', maxWidth: 480 }}>
        <div className="win-bar"><span className="win-title">{nuevo ? 'Nuevo usuario' : 'Editar usuario'}</span>
          <div className="win-ctl"><button className="close" onClick={onClose} aria-label="Cerrar"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>
        </div>
        <div className="win-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label><span style={lbl}>Nombre *</span><input style={input} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} /></label>
          <label><span style={lbl}>Correo {nuevo ? '*' : '(no editable)'}</span><input style={{ ...input, opacity: nuevo ? 1 : 0.6 }} value={form.email} disabled={!nuevo} onChange={(e) => set('email', e.target.value)} placeholder="nombre@cerpat.io" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label><span style={lbl}>Cargo</span><input style={input} value={form.cargo} onChange={(e) => set('cargo', e.target.value)} /></label>
            <label><span style={lbl}>Área</span><input style={input} value={form.area} onChange={(e) => set('area', e.target.value)} /></label>
          </div>
          <div>
            <span style={lbl}>Roles</span>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {roles.map((r) => (
                <label key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.roles.includes(r.id)} onChange={() => toggleRol(r.id)} /> {r.nombre}
                </label>
              ))}
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} /> Usuario activo
          </label>
          {nuevo && <label><span style={lbl}>Contraseña temporal (opcional)</span><input style={input} value={form.passwordTemporal} onChange={(e) => set('passwordTemporal', e.target.value)} placeholder="Por defecto: Cerpat2026*" /></label>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="dbtn" onClick={onClose} style={{ fontSize: 13 }}>Cancelar</button>
            <button className="dbtn primary" onClick={guardar} disabled={guardando} style={{ fontSize: 13 }}>{guardando ? 'Guardando…' : nuevo ? 'Crear usuario' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
