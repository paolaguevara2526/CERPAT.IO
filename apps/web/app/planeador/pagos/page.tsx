// apps/web/app/planeador/pagos/page.tsx — Vista de Pagos.
// Controla lo que está PENDIENTE DE PAGO: la tabla "Pagos pendientes", donde se
// registran y siguen las obligaciones por pagar (cliente, obligación, año,
// período, vencimiento, valor y estado). Las actividades del Plan de Trabajo y
// los vencimientos tributarios se gestionan en sus propias vistas.

import { apiFetch } from '@/lib/session';
import PendientesManuales from '../PendientesManuales';

export const dynamic = 'force-dynamic';

type Pendiente = {
  id: string; obligacion: string; anio: number; periodo: string | null; municipio: string | null;
  empresa: string | null; fechaVencimiento: string; estado: string; valorPago: number | null; notas: string | null;
};
async function fetchPendientes(): Promise<Pendiente[]> {
  try {
    const res = await apiFetch('/vencimientos/pendientes');
    if (!res.ok) return [];
    return ((await res.json()) as { pendientes: Pendiente[] }).pendientes ?? [];
  } catch { return []; }
}

type EmpresaLite = { id: string; nombre: string };
async function fetchEmpresas(): Promise<EmpresaLite[]> {
  try {
    const res = await apiFetch('/empresas');
    if (!res.ok) return [];
    const data = (await res.json()) as { empresas: EmpresaLite[] };
    return (data.empresas ?? []).map((e) => ({ id: e.id, nombre: e.nombre }));
  } catch { return []; }
}

export default async function PagosPage() {
  const [pendientes, empresas] = await Promise.all([fetchPendientes(), fetchEmpresas()]);

  return (
    <>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Pagos</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
        Control de las obligaciones <strong>pendientes de pago</strong>. Registra el valor y el estado de cada pago.
      </p>
      <PendientesManuales empresas={empresas} pendientes={pendientes} />
    </>
  );
}
