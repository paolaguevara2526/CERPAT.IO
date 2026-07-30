// apps/web/app/usuarios/page.tsx
//
// Vista de Usuarios (personal) cableada a la API: Server Component que consulta
// la base real en Postgres. Muestra el listado del personal cargado desde la
// base de personal de la firma (nombre, cargo, área, rol, estado).
//
// TODO (auth): esta vista debe quedar detrás de login (rol Administrador/
// Coordinador) — hoy es pública mientras no existe autenticación.

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api-production-678b8.up.railway.app';
const BRAND = '#34C98B';

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  cargo: string | null;
  area: string | null;
  activo: boolean;
  esRoot: boolean;
  roles: string[];
};

type Respuesta = {
  organizacion: { nombre: string; slug: string } | null;
  total: number;
  usuarios: Usuario[];
};

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
  Administrador: '#20259C',
  Coordinador: '#7A5AF8',
  Asesor: '#0E9F6E',
  Auxiliar: '#3F83F8',
  Auditor: '#E0A100',
};

export default async function UsuariosPage() {
  const { data, error } = await getUsuarios();
  const usuarios = data?.usuarios ?? [];
  const activos = usuarios.filter((u) => u.activo).length;

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#F5F6F8', minHeight: '100vh', margin: 0, color: '#101828' }}>
      <header style={{ background: 'linear-gradient(135deg,#20259C,#11154F)', color: '#fff', padding: '28px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 600 }}>Planeador CERPAT · datos en vivo desde la base</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800 }}>Usuarios {data?.organizacion ? `· ${data.organizacion.nombre}` : ''}</h1>
        </div>
      </header>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 60px' }}>
        {error ? (
          <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 12, padding: '18px 20px', fontSize: 14, fontWeight: 600 }}>
            No se pudieron cargar los usuarios: {error}.
            <div style={{ fontWeight: 400, marginTop: 6, color: '#7a271d' }}>
              Verifica que la API (<code>{API_URL}</code>) esté en línea y responda en <code>/usuarios</code>.
            </div>
          </div>
        ) : usuarios.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px', boxShadow: '0 1px 2px rgba(16,24,40,0.05),0 4px 14px rgba(16,24,40,0.06)', color: '#475467', lineHeight: 1.6 }}>
            <strong style={{ color: '#101828' }}>Todavía no hay usuarios en la base.</strong>
            <div style={{ marginTop: 8 }}>
              El listado del personal aún no se ha cargado. Corre en la consola de Railway:
              <pre style={{ background: '#0B1020', color: '#D6E2FF', padding: '12px 14px', borderRadius: 10, marginTop: 10, overflowX: 'auto', fontSize: 13 }}>{`npx prisma db push
npm run db:generate
npm run db:import-usuarios`}</pre>
              Luego recarga esta página.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: BRAND }}>{usuarios.length}</span>
              <span style={{ fontSize: 14, color: '#667085', fontWeight: 600 }}>usuarios cargados ({activos} activos)</span>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.05),0 4px 14px rgba(16,24,40,0.06)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr>
                      {['Nombre', 'Correo', 'Cargo', 'Área', 'Rol', 'Estado'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.4, color: '#667085', fontWeight: 800, padding: '12px 14px', borderBottom: '1px solid #E4E7EC', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id}>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', fontWeight: 600 }}>
                          {u.nombre}
                          {u.esRoot && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: '#20259C', background: '#E7E9FF', padding: '2px 7px', borderRadius: 999 }}>ROOT</span>}
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467', fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{u.email}</td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467' }}>{u.cargo ?? '—'}</td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467' }}>{u.area ?? '—'}</td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3' }}>
                          {u.roles.length === 0 ? <span style={{ color: '#98A2B3' }}>—</span> : u.roles.map((r) => (
                            <span key={r} style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: ROL_COLOR[r] ?? '#475467', background: `${ROL_COLOR[r] ?? '#475467'}18`, padding: '2px 8px', borderRadius: 999, marginRight: 4 }}>{r}</span>
                          ))}
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: u.activo ? '#027A48' : '#B42318' }}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: '#667085', marginTop: 14 }}>
              Vista provisional (pública). Cuando exista autenticación quedará detrás de login, visible solo para perfiles Administrador/Coordinador.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
