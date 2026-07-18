# Arquitectura — Planeador CERPAT

> El stack ya está decidido y validado con el equipo. El resumen de negocio y
> las decisiones completas viven en
> [`../CONTEXTO-PARA-CLAUDE-CODE.md`](../CONTEXTO-PARA-CLAUDE-CODE.md) §2.
> El diagrama del sistema está en [`arquitectura.mermaid`](./arquitectura.mermaid).

## Visión general

Monorepo con tres componentes principales más la capa de datos:

- **`apps/web`** — Frontend en **Next.js (React)**, desplegado en **Vercel**
  (`app.cerpat.io`). Interfaz de planificación y consulta de operaciones.
- **`apps/api`** — Backend en **Node.js / Express** (TypeScript), desplegado en
  **Railway** (`api.cerpat.io`). Contiene **toda** la lógica de negocio y las
  validaciones. El frontend nunca debe poder saltarse una validación.
- **`packages/shared`** — Tipos, contratos y validaciones compartidas entre
  `web` y `api`, para evitar duplicación y mantener consistencia.
- **Base de datos** — **PostgreSQL** en Railway, gestionada con **Prisma**
  (esquema en [`../prisma/schema.prisma`](../prisma/schema.prisma)).

## Servicios y decisiones

- **Autenticación:** Auth.js (NextAuth) o Clerk — nunca contraseñas en texto
  plano ni lógica de auth hecha a mano. Permisos por rol verificados en cada
  endpoint del backend.
- **Automatización/notificaciones:** n8n (Railway). Lee de Postgres solo con un
  usuario de solo lectura; para crear/modificar datos **llama a la API**, nunca
  escribe directo a la base de datos (respeta las mismas reglas de negocio).
- **Correo:** Microsoft 365 (`notificaciones@cerpat.io`) vía Microsoft Graph API
  (OAuth2, no SMTP con contraseña).
- **Archivos de soporte:** por ahora solo un link (campo de texto); a futuro
  Cloudflare R2 / AWS S3.
- **Monitoreo:** Sentry.
- **Dominio:** `cerpat.io` — raíz para correo, subdominios por servicio.

## Aislamiento por empresa (fase futura: portal de clientes)

El portal de solo lectura para los equipos contables de los clientes es una
fase futura, pero el **aislamiento por empresa debe diseñarse desde el modelo de
datos**, no improvisarse después. Ver
[`../CONTEXTO-PARA-CLAUDE-CODE.md`](../CONTEXTO-PARA-CLAUDE-CODE.md) §1.

## Decisiones tomadas

Registrar aquí cada decisión de arquitectura relevante junto con su
justificación (ADR corto: contexto, decisión, consecuencias) a medida que se
tomen durante la implementación.
