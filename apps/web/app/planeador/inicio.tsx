// apps/web/app/planeador/inicio.tsx
// Helper server-side para el resumen global del período (cumplimiento).

import { apiFetch } from '@/lib/session';

export type Kpis = { total: number; ejecutadas: number; vencidas: number; porAuditar: number; cumplimiento: number };
export type CumplimientoResp = { organizacion: { nombre: string } | null; periodo: string | null; kpis: Kpis | null };

export async function fetchCumplimiento(periodo?: string): Promise<{ data: CumplimientoResp | null; error: string | null }> {
  const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
  try {
    const res = await apiFetch(`/plan/cumplimiento${qs}`);
    if (!res.ok) return { data: null, error: `La API respondió ${res.status}` };
    return { data: (await res.json()) as CumplimientoResp, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

export function colorPct(pct: number): string {
  if (pct >= 85) return '#22a670';
  if (pct >= 60) return '#d98a00';
  return '#d64b3f';
}
