// apps/api/src/auth/middleware.ts
// Middleware de autenticación: verifica el JWT del header Authorization y adjunta
// el payload en req.user. Usar en rutas que requieran sesión.

import type { Request, Response, NextFunction } from 'express';
import { verifyJwt, type JwtPayload } from './jwt.js';

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'Autenticación no configurada (falta JWT_SECRET).' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyJwt(token, secret) : null;
  if (!payload) return res.status(401).json({ error: 'No autenticado.' });
  req.user = payload;
  next();
}

// Exige que el usuario tenga al menos uno de los roles indicados.
export function requireRol(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u) return res.status(401).json({ error: 'No autenticado.' });
    if (u.esRoot || u.roles.some((r) => roles.includes(r))) return next();
    return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
  };
}
