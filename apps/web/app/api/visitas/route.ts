// apps/web/app/api/visitas/route.ts
// Proxy de la RAÍZ /api/visitas (lista del mes y alta de una visita).
// El catch-all [...path] cubre GET/PATCH/DELETE /:id y los compromisos.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL, COOKIE } from '@/lib/session';

export async function GET(req: Request) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const search = new URL(req.url).search;
  const res = await fetch(`${API_URL}/visitas${search}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const body = await req.text();
  const res = await fetch(`${API_URL}/visitas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
