// apps/api/src/auth/jwt.ts
// JWT mínimo (HS256) con crypto nativo de Node — sin dependencias externas.

import { createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

export interface JwtPayload {
  sub: string;            // id de usuario
  org: string | null;     // organizacionId
  roles: string[];
  esRoot: boolean;
  iat?: number;
  exp?: number;
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, expiresInSec = 60 * 60 * 12): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [p1, p2, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${p1}.${p2}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(p2, 'base64url').toString('utf8')) as JwtPayload;
    if (body.exp && Math.floor(Date.now() / 1000) > body.exp) return null;
    return body;
  } catch {
    return null;
  }
}
