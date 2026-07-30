// apps/web/app/api/auth/login/route.ts
// Proxy de login: recibe correo+contraseña, llama a la API y, si es correcto,
// guarda el token en una cookie httpOnly (el navegador no puede leerla por JS).

import { NextResponse } from 'next/server';
import { API_URL, COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data.error || 'No se pudo iniciar sesión.' }, { status: res.status });
  }
  const out = NextResponse.json({ ok: true, debeCambiarPassword: !!data.user?.debeCambiarPassword });
  out.cookies.set(COOKIE, data.token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 });
  return out;
}
