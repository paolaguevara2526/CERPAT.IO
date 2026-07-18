// apps/web/app/clientes/page.tsx
//
// Primera vista "cableada": Server Component que consulta la API (server-side,
// sin CORS) y muestra los clientes reales guardados en Postgres.
// Los correos NO se muestran aquí a propósito (página pública sin auth).

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api-production-678b8.up.railway.app';
const BRAND = '#34C98B';

type Empresa = {
  id: string;
  nombre: string;
  nit: string | null;
  tipo: string | null;
  servicio: string | null;
  asesorNombre: string | null;
  regimen: string | null;
};

type Respuesta = {
  organizacion: { nombre: string; slug: string } | null;
  total: number;
  empresas: Empresa[];
};

async function getEmpresas(): Promise<{ data: Respuesta | null; error: string | null }> {
  try {
    const res = await fetch(`${API_URL}/empresas`, { cache: 'no-store' });
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Respuesta, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red al consultar la API' };
  }
}

export default async function ClientesPage() {
  const { data, error } = await getEmpresas();
  const empresas = data?.empresas ?? [];

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#F5F6F8', minHeight: '100vh', margin: 0, color: '#101828' }}>
      <header style={{ background: 'linear-gradient(135deg,#20259C,#11154F)', color: '#fff', padding: '28px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 600 }}>Planeador CERPAT · datos en vivo desde la base</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800 }}>Clientes {data?.organizacion ? `· ${data.organizacion.nombre}` : ''}</h1>
        </div>
      </header>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 60px' }}>
        {error ? (
          <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 12, padding: '18px 20px', fontSize: 14, fontWeight: 600 }}>
            No se pudieron cargar los clientes: {error}.
            <div style={{ fontWeight: 400, marginTop: 6, color: '#7a271d' }}>
              Verifica que la API (<code>{API_URL}</code>) esté en línea y responda en <code>/empresas</code>.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: BRAND }}>{empresas.length}</span>
              <span style={{ fontSize: 14, color: '#667085', fontWeight: 600 }}>empresas cliente cargadas en Postgres</span>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.05),0 4px 14px rgba(16,24,40,0.06)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr>
                      {['Razón social', 'NIT', 'Tipo', 'Servicio', 'Asesor', 'Régimen'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.4, color: '#667085', fontWeight: 800, padding: '12px 14px', borderBottom: '1px solid #E4E7EC', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {empresas.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#667085' }}>No hay empresas cargadas todavía.</td></tr>
                    ) : (
                      empresas.map((e) => (
                        <tr key={e.id}>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', fontWeight: 600 }}>{e.nombre}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467', fontFamily: 'ui-monospace, monospace' }}>{e.nit ?? '—'}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467' }}>{e.tipo ?? '—'}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467' }}>{e.servicio ?? '—'}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467' }}>{e.asesorNombre ?? '—'}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F1F3', color: '#475467' }}>{e.regimen ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: '#667085', marginTop: 14 }}>
              Los correos de contacto no se muestran en esta vista pública por privacidad; se servirán con autenticación.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
