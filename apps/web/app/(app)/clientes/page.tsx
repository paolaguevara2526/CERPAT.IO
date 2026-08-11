// apps/web/app/(app)/clientes/page.tsx
//
// Vista de Clientes (Gestión): Server Component que consulta la API (server-side,
// sin CORS) y muestra los clientes reales guardados en Postgres. Los correos NO se
// muestran aquí. Acceso restringido a Administrador/root (bloqueo por URL).
//
// Usa el sistema de diseño compartido (panel + tabla .dt). Antes traía su propia
// cabecera, su propio fondo y su propia tabla escritos a mano: era la primera
// vista cableada y se quedó con estilo aparte, que además no seguía al tema.

import { exigirRuta } from '@/lib/acceso-server';
import { apiFetch } from '@/lib/session';
import TablaClientes, { type Empresa } from './TablaClientes';


export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

type Respuesta = {
  organizacion: { nombre: string; slug: string } | null;
  total: number;
  empresas: Empresa[];
};

async function getEmpresas(): Promise<{ data: Respuesta | null; error: string | null }> {
  try {
    // apiFetch adjunta el token de la sesión: /empresas exige autenticación.
    const res = await apiFetch('/empresas');
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as Respuesta, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red al consultar la API' };
  }
}

export default async function ClientesPage() {
  const sesion = await exigirRuta('/clientes');
  // La descarga del listado es de Administración y Coordinación. El backend ya
  // acota QUÉ clientes ve cada quien; esto acota QUIÉN se los puede llevar.
  const puedeExportar = sesion.esRoot || sesion.roles.some((r) => ['Administrador', 'Coordinador'].includes(r));
  const { data, error } = await getEmpresas();
  const empresas = data?.empresas ?? [];

  return (
    <>
  <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>
    Clientes {data?.organizacion ? `· ${data.organizacion.nombre}` : ''}
  </h1>
  <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>
    {puedeExportar
      ? 'Empresas cliente de la firma, en vivo desde la base. Los correos de contacto no se muestran aquí por privacidad.'
      : 'Los clientes que tienes asignados, en vivo desde la base. Los correos de contacto no se muestran aquí por privacidad.'}
  </p>

  {error ? (
    <div className="panel" style={{ background: 'var(--peligro-suave)', color: 'var(--peligro-fuerte)', borderColor: 'var(--peligro-borde)', padding: '16px 18px', fontSize: 14, fontWeight: 600 }}>
      No se pudieron cargar los clientes: {error}.
      <div style={{ fontWeight: 400, marginTop: 6 }}>
        Verifica que la API esté en línea y responda en <code>/empresas</code>.
      </div>
    </div>
  ) : (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--green-2)' }}>{empresas.length}</span>
        <span style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>{puedeExportar ? 'empresas cliente' : 'clientes asignados'}</span>
      </div>

      <TablaClientes empresas={empresas} puedeExportar={puedeExportar} />
    </>
  )}
    </>
  );
}
