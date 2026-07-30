// apps/web/app/api/auth/cambiar-clave/route.ts
// Proxy de cambio de contraseña: usa el token de la cookie para llamar a la API.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL, COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/auth/cambiar-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ actual: body.actual, nueva: body.nueva }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.error || 'No se pudo cambiar la contraseña.' }, { status: res.status });
  return NextResponse.json({ ok: true });
}
