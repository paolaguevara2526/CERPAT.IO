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
import { hallazgosRouter } from './routes/hallazgos.js';
import { vencimientosRouter } from './routes/vencimientos.js';
import { visitasRouter } from './routes/visitas.js';
import { fichaRouter } from './routes/ficha.js';
import { novedadesRouter } from './routes/novedades.js';
import { promoverRootSiSePide } from './bootstrap-root.js';
import { mensajeDeError } from './errores.js';

const app = express();

// En Railway la API vive detrás de un proxy: sin esto, req.ip sería siempre la
// dirección interna del proxy y todos los usuarios parecerían el mismo.
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
// Límite amplio: la importación masiva de asignaciones (miles de filas) y la
// subida de documentos del cliente (archivos en base64) van en un solo POST y
// superaban el tope por defecto de Express (100 KB).
app.use(express.json({ limit: '30mb' }));

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/tareas', tareasRouter);
app.use('/empresas', empresasRouter);
app.use('/usuarios', usuariosRouter);
app.use('/plan', planRouter);
app.use('/admin', adminRouter);
app.use('/hallazgos', hallazgosRouter);
app.use('/vencimientos', vencimientosRouter);
app.use('/visitas', visitasRouter);
app.use('/ficha', fichaRouter);
app.use('/novedades', novedadesRouter);

// TODO (Claude Code): agregar aquí, en el mismo patrón, los routers de:
// /auth, /usuarios, /empresas, /pagos, /catalogos, /vencimientos, /parametros, /auditoria
// Cada router debe:
//  1) Verificar el token de sesión (middleware de autenticación).
//  2) Verificar el rol del usuario contra la acción solicitada.
//  3) Aplicar las reglas de negocio de CONTEXTO-PARA-CLAUDE-CODE.md antes de tocar la base de datos.

// Último middleware: convierte cualquier error en JSON con un mensaje legible.
// Sin esto, Express responde su página HTML por defecto, el proxy del frontend
// no la puede leer, la vuelve `{}` y la pantalla muestra un genérico del tipo
// "No se pudo guardar" — sin decir qué pasó ni dejar rastro para quien lo mire.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error no controlado]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: mensajeDeError(err) });
});

// Una promesa rechazada sin capturar mata el proceso de Node por defecto. En una
// API eso significa que un solo request malo deja sin servicio a todo el equipo.
// Se registra y se sigue en pie; el request que la provocó ya falló de todos modos.
process.on('unhandledRejection', (razon) => console.error('[promesa sin capturar]', razon));
process.on('uncaughtException', (e) => console.error('[excepción sin capturar]', e));

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
  // Promoción puntual a root si se pidió por variable de entorno (ver el archivo).
  void promoverRootSiSePide();
});
