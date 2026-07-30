// apps/web/app/usuarios/page.tsx
//
// Vista de Usuarios (personal) cableada a la API, con estilo "software de
// escritorio" (marco de ventana + relieve 3D sutil, ver desktop.css).
//
// TODO (auth): debe quedar detrás de login (rol Administrador/Coordinador).

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api-production-678b8.up.railway.app';

type Usuario = {
  id: string; nombre: string; email: string; cargo: string | null; area: string | null;
  activo: boolean; esRoot: boolean; roles: string[];
};
type Respuesta = { organizacion: { nombre: string; slug: string } | null; total: number; usuarios: Usuario[] };

async function getUsuarios(): Promise<{ data: Respuesta | null; error: string | null }> {
  try {
    const res = await fetch(`${API_URL}/usuarios`, { cache: 'no-store' });
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Respuesta, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red al consultar la API' };
  }
}

const ROL_COLOR: Record<string, string> = {
  Administrador: '#20259c', Coordinador: '#7a5af8', Asesor: '#0e9f6e', Auxiliar: '#3f83f8', Auditor: '#d98a00',
};

export default async function UsuariosPage() {
  const { data, error } = await getUsuarios();
  const usuarios = data?.usuarios ?? [];
  const activos = usuarios.filter((u) => u.activo).length;

  return (
    <main style={{ fontFamily: 'var(--ui)', background: 'radial-gradient(1100px 500px at 70% -10%, rgba(52,201,139,0.10), transparent 60%), var(--desk-bg)', minHeight: '100vh', color: 'var(--ink)', padding: '26px 18px 44px', display: 'flex', justifyContent: 'center' }}>
      <div className="win" style={{ width: '100%', maxWidth: 1080 }}>
        <div className="win-bar">
          <span className="win-lights"><i className="r" /><i className="y" /><i className="g" /></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="win-logo" src="/logo-cerpat-blanco.svg" alt="CERPAT" />
          <span className="win-title">Usuarios{data?.organizacion ? ` · ${data.organizacion.nombre}` : ''}</span>
          <span className="win-path">cerpat.io/usuarios</span>
        </div>

        <div className="win-toolbar">
          <span className="dbtn primary">＋ Nuevo usuario</span>
          <span className="dbtn">Importar</span>
          <span className="dbtn">Exportar</span>
          <span className="sp" />
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>
            {usuarios.length} usuarios · {activos} activos
          </span>
        </div>

        <div className="win-body">
          {error ? (
            <div className="panel" style={{ padding: '18px 20px', color: '#b42318', fontWeight: 600 }}>
              No se pudieron cargar los usuarios: {error}.
              <div style={{ fontWeight: 400, marginTop: 6, color: 'var(--muted)' }}>
                Verifica que la API (<code>{API_URL}</code>) responda en <code>/usuarios</code>.
              </div>
            </div>
          ) : usuarios.length === 0 ? (
            <div className="panel" style={{ padding: 26, color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink)' }}>Todavía no hay usuarios en la base.</strong>
              <div style={{ marginTop: 8 }}>Corre en la consola de Railway:
                <pre style={{ background: '#0b1020', color: '#d6e2ff', padding: '12px 14px', borderRadius: 8, marginTop: 10, overflowX: 'auto', fontSize: 13 }}>{`npx prisma db push
npm run db:generate
npm run db:import-usuarios`}</pre>
                Luego recarga esta página.
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="dt-wrap">
                <table className="dt">
                  <thead>
                    <tr>{['Nombre', 'Correo', 'Cargo', 'Área', 'Rol', 'Estado'].map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>
                          {u.nombre}
                          {u.esRoot && <span className="chip" style={{ marginLeft: 8, color: '#20259c', background: '#e7e9ff', borderColor: '#c9ccff' }}>ROOT</span>}
                        </td>
                        <td style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12.5 }}>{u.email}</td>
                        <td style={{ color: 'var(--muted)' }}>{u.cargo ?? '—'}</td>
                        <td style={{ color: 'var(--muted)' }}>{u.area ?? '—'}</td>
                        <td>
                          {u.roles.length === 0 ? <span style={{ color: 'var(--muted)' }}>—</span> : u.roles.map((r) => {
                            const c = ROL_COLOR[r] ?? '#5b6478';
                            return <span key={r} className="chip" style={{ color: c, background: `${c}18`, borderColor: `${c}44`, marginRight: 4 }}>{r}</span>;
                          })}
                        </td>
                        <td style={{ fontWeight: 700, color: u.activo ? '#027a48' : '#b42318' }}>{u.activo ? 'Activo' : 'Inactivo'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="win-status">
          <span className="led" /> Conectado · PostgreSQL
          <span className="sp" />
          <span>Vista provisional · quedará tras login (Administrador/Coordinador)</span>
        </div>
      </div>
    </main>
  );
}
