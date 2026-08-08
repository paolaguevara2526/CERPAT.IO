// apps/api/src/routes/auth.ts
// Autenticación: login (correo + contraseña), datos del usuario en sesión y
// cambio de contraseña (obligatorio en el primer ingreso).

import { Router } from 'express';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signJwt } from '../auth/jwt.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const authRouter = Router();

// ---------- Límite de intentos de login (anti fuerza bruta) ----------
// Ventana deslizante en memoria por IP + correo: tras varios fallos seguidos se
// bloquea un rato. Los intentos correctos limpian el contador. En memoria basta
// para el tamaño actual; si algún día hay varias instancias, mover a la BD/Redis.
const MAX_INTENTOS = 8;
const VENTANA_MS = 15 * 60 * 1000; // 15 minutos
const intentos = new Map<string, { n: number; hasta: number }>();

function claveIntento(req: { ip?: string; body?: any }): string {
  const ip = req.ip ?? 'sin-ip';
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  return `${ip}|${email}`;
}
function bloqueado(clave: string): number {
  const reg = intentos.get(clave);
  if (!reg) return 0;
  if (Date.now() > reg.hasta) { intentos.delete(clave); return 0; }
  return reg.n >= MAX_INTENTOS ? Math.ceil((reg.hasta - Date.now()) / 60000) : 0;
}
function registrarFallo(clave: string): void {
  const ahora = Date.now();
  const reg = intentos.get(clave);
  if (!reg || ahora > reg.hasta) intentos.set(clave, { n: 1, hasta: ahora + VENTANA_MS });
  else intentos.set(clave, { n: reg.n + 1, hasta: reg.hasta });
  // Limpieza oportunista para que el mapa no crezca sin control.
  if (intentos.size > 5000) for (const [k, v] of intentos) if (ahora > v.hasta) intentos.delete(k);
}

async function cargarUsuario(id: string) {
  return prisma.usuario.findUnique({
    where: { id },
    include: { roles: { include: { rol: true } } },
  });
}

// POST /auth/login  { email, password }
authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'Autenticación no configurada (falta JWT_SECRET).' });

  // Demasiados intentos fallidos seguidos: se frena un rato (fuerza bruta).
  const clave = claveIntento(req);
  const minutos = bloqueado(clave);
  if (minutos > 0) {
    return res.status(429).json({ error: `Demasiados intentos fallidos. Espera ${minutos} minuto(s) e intenta de nuevo.` });
  }

  const org = await prisma.organizacion.findFirst({ where: { slug: 'cerpat' } });
  const user = await prisma.usuario.findFirst({
    where: { email, organizacionId: org?.id },
    include: { roles: { include: { rol: true } } },
  });

  // Mismo mensaje para usuario inexistente / clave mala (no filtrar cuáles existen).
  if (!user || !user.activo || !verifyPassword(password, user.passwordHash)) {
    registrarFallo(clave);
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  intentos.delete(clave); // login correcto: se limpia el contador

  const roles = user.roles.map((r) => r.rol.nombre);
  const token = signJwt({ sub: user.id, org: user.organizacionId, roles, esRoot: user.esRootPlataforma, empresaCliente: user.empresaClienteId, grupoCliente: user.grupoClienteId }, secret);
  await prisma.usuario.update({ where: { id: user.id }, data: { ultimoLogin: new Date() } });

  res.json({
    token,
    user: {
      id: user.id, nombre: user.nombre, email: user.email, roles,
      esRoot: user.esRootPlataforma, debeCambiarPassword: user.debeCambiarPassword,
      empresaCliente: user.empresaClienteId, grupoCliente: user.grupoClienteId,
    },
  });
});

// GET /auth/me  (requiere sesión)
authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await cargarUsuario(req.user!.sub);
  if (!user || !user.activo) return res.status(401).json({ error: 'Sesión inválida.' });
  res.json({
    user: {
      id: user.id, nombre: user.nombre, email: user.email,
      roles: user.roles.map((r) => r.rol.nombre), area: user.area, cargo: user.cargo,
      esRoot: user.esRootPlataforma, debeCambiarPassword: user.debeCambiarPassword,
      empresaCliente: user.empresaClienteId, grupoCliente: user.grupoClienteId,
    },
  });
});

// POST /auth/cambiar-password  { actual, nueva }  (requiere sesión)
authRouter.post('/cambiar-password', requireAuth, async (req: AuthedRequest, res) => {
  const actual = String(req.body?.actual ?? '');
  const nueva = String(req.body?.nueva ?? '');
  if (nueva.length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });

  const user = await cargarUsuario(req.user!.sub);
  if (!user) return res.status(401).json({ error: 'Sesión inválida.' });
  if (!verifyPassword(actual, user.passwordHash)) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });

  await prisma.usuario.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(nueva), debeCambiarPassword: false },
  });
  res.json({ ok: true });
});
