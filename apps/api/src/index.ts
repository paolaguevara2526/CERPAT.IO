// apps/api/src/index.ts
// Punto de entrada del backend. Mantener este archivo simple:
// cada dominio (tareas, pagos, usuarios, etc.) va en su propio archivo bajo src/routes/.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { tareasRouter } from './routes/tareas.js';
import { empresasRouter } from './routes/empresas.js';
import { usuariosRouter } from './routes/usuarios.js';
import { planRouter } from './routes/plan.js';
import { adminRouter } from './routes/admin.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json());

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/tareas', tareasRouter);
app.use('/empresas', empresasRouter);
app.use('/usuarios', usuariosRouter);
app.use('/plan', planRouter);
app.use('/admin', adminRouter);

// TODO (Claude Code): agregar aquí, en el mismo patrón, los routers de:
// /auth, /usuarios, /empresas, /pagos, /catalogos, /vencimientos, /parametros, /auditoria
// Cada router debe:
//  1) Verificar el token de sesión (middleware de autenticación).
//  2) Verificar el rol del usuario contra la acción solicitada.
//  3) Aplicar las reglas de negocio de CONTEXTO-PARA-CLAUDE-CODE.md antes de tocar la base de datos.

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
