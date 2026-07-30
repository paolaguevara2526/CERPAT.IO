// apps/web/lib/session.ts
// Sesión del lado del servidor: lee el token (cookie httpOnly) y resuelve el
// usuario contra la API. Usar en Server Components para proteger vistas.

import { cookies } from 'next/headers';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api-production-678b8.up.railway.app';
export const COOKIE = 'cerpat_token';

export type SessionUser = {
  id: string; nombre: string; email: string; roles: string[];
  esRoot: boolean; debeCambiarPassword: boolean; area?: string | null; cargo?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.user ?? null) as SessionUser | null;
  } catch {
    return null;
  }
}
