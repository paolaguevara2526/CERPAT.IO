// apps/web/app/api/vencimientos/route.ts
// Proxy de la RAÍZ /api/vencimientos (lista del año y alta de pagos pendientes).
// El catch-all [...path] cubre /resumen, /empresas, /pendientes, /pagos,
// PATCH /:id y DELETE /:id.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL, COOKIE } from '@/lib/session';

export async function GET(req: Request) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const search = new URL(req.url).search;
  const res = await fetch(`${API_URL}/vencimientos${search}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

// Alta de un pago pendiente a mano.
export async function POST(req: Request) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const body = await req.text();
  const res = await fetch(`${API_URL}/vencimientos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
