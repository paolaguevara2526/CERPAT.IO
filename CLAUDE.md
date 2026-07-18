# CLAUDE.md

Guía para Claude Code al trabajar en el repositorio del **Planeador CERPAT**.

## Qué es este proyecto

Monorepo del Planeador CERPAT. Ver [`CONTEXTO-PARA-CLAUDE-CODE.md`](./CONTEXTO-PARA-CLAUDE-CODE.md)
para el contexto de negocio completo antes de implementar funcionalidad nueva.

## Estructura

- `apps/web` — Frontend del planeador (**Next.js / React**, App Router).
- `apps/api` — Backend: API y lógica de negocio (**Node.js / Express**, TypeScript).
- `packages/shared` — Tipos, contratos y utilidades compartidas entre `web` y `api`.
- `prisma/` — Esquema de base de datos (`schema.prisma`) y `seed.ts` (**Prisma + PostgreSQL**).
- `prototipo-referencia/` — Prototipo HTML de referencia (`planeador-cerpat.html`).
  Es la **especificación viva** del comportamiento esperado de cada pantalla:
  ábrelo antes de construir cualquier vista.
- `docs/` — Documentación de arquitectura, modelo de datos y reglas de negocio
  (incluye `arquitectura.mermaid`, el diagrama del sistema).

El stack tecnológico ya está definido (ver
[`CONTEXTO-PARA-CLAUDE-CODE.md`](./CONTEXTO-PARA-CLAUDE-CODE.md) §2): Next.js en
Vercel, API Express en Railway, PostgreSQL con Prisma, autenticación con
Auth.js/Clerk. **Toda regla de negocio se valida en el backend** — el frontend
nunca debe poder saltarse una validación.

## Convenciones de trabajo

- Todo cambio de negocio relevante (reglas, entidades, decisiones de
  arquitectura) debe reflejarse en `docs/` — no dejar esa información solo en
  el historial de commits o en la conversación.
- Antes de introducir una entidad o relación nueva, revisa
  [`docs/modelo-de-datos.md`](./docs/modelo-de-datos.md) y `prisma/schema.prisma`
  (fuente de verdad del esquema) para mantenerlo consistente.
- Antes de implementar lógica de dominio, revisa
  [`docs/reglas-de-negocio.md`](./docs/reglas-de-negocio.md) y §4 de
  `CONTEXTO-PARA-CLAUDE-CODE.md` (reglas ya validadas, no reinterpretar).
- `packages/shared` es la fuente de verdad para tipos/contratos usados por
  `web` y `api` simultáneamente; evita duplicarlos en cada app.
- Nunca subir credenciales al código: usar variables de entorno (ver los
  `.env.example`). Contraseñas siempre con hash, nunca en texto plano.
- Mantén los documentos en español, consistente con el resto del repositorio.

## Comandos

Monorepo con **npm workspaces** (`apps/*`, `packages/*`). Desde la raíz:

```bash
npm install            # instala todas las dependencias del monorepo

npm run dev:web        # arranca el frontend (Next.js)
npm run dev:api        # arranca el backend (Express, con recarga)

npm run db:generate    # genera el cliente de Prisma
npm run db:migrate     # crea/aplica migraciones en desarrollo
npm run db:seed        # carga roles y catálogos base (prisma/seed.ts)
npm run db:studio      # abre Prisma Studio
```

Por app (`apps/web`, `apps/api`) hay además `build`, `start` y, en web, `lint`.
Requiere una `DATABASE_URL` de PostgreSQL configurada (ver `apps/api/.env.example`)
antes de correr los comandos `db:*`.
