// apps/web/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/session';

export async function POST() {
  const out = NextResponse.json({ ok: true });
  out.cookies.set(COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return out;
}
