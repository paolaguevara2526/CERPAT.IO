// apps/web/app/api/portal/route.ts
// Proxy de la RAÍZ /api/portal (sin segmento): lista (GET) y creación (POST) de
// hallazgos. El catch-all [...path] solo cubre rutas con segmento, así que esta
// ruta maneja /api/portal y /api/portal?empresaId=…

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL, COOKIE } from '@/lib/session';

async function forward(req: Request, method: string) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const search = new URL(req.url).search;
  const body = method === 'POST' ? await req.text() : undefined;
  const res = await fetch(`${API_URL}/hallazgos${search}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: Request) { return forward(req, 'GET'); }
export async function POST(req: Request) { return forward(req, 'POST'); }
