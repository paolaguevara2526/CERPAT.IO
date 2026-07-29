# CLAUDE.md

Guía para Claude Code al trabajar en el repositorio del **Planeador CERPAT**.

## Qué es este proyecto

Monorepo del Planeador CERPAT. **Empieza por [`docs/estado-y-plan.md`](./docs/estado-y-plan.md)**
(estado en producción y roadmap vivo), y luego [`CONTEXTO-PARA-CLAUDE-CODE.md`](./CONTEXTO-PARA-CLAUDE-CODE.md)
para el contexto de negocio completo antes de implementar funcionalidad nueva.

**Estado actual (resumen):** infraestructura desplegada y en producción — frontend en
Vercel con dominio `cerpat.io`, API Express + PostgreSQL en Railway, esquema
**multi-tenant** (`Organizacion` = firma; rol root de plataforma) con **90 clientes reales**
cargados. La raíz `cerpat.io` sirve hoy el prototipo (localStorage) con **sistema de temas**
(Apariencia); `cerpat.io/clientes` es la primera vista cableada a la API. En diseño: el
**Plan de Trabajo Contable** (actividades recurrentes por cliente + seguimiento de
cumplimiento) y el **Módulo de Hallazgos y Planes de Acción** (revisoría fiscal) —
ver `docs/estado-y-plan.md`, `docs/mockups/` y la sección de más abajo.

## Estructura

- `apps/web` — Frontend del planeador (**Next.js / React**, App Router).
- `apps/api` — Backend: API y lógica de negocio (**Node.js / Express**, TypeScript).
- `packages/shared` — Tipos, contratos y utilidades compartidas entre `web` y `api`.
- `prisma/` — Esquema de base de datos (`schema.prisma`) y `seed.ts` (**Prisma + PostgreSQL**).
- `prototipo-referencia/` — Prototipo HTML de referencia (`planeador-cerpat.html`).
  Es la **especificación viva** del comportamiento esperado de cada pantalla:
  ábrelo antes de construir cualquier vista.
- `docs/` — Documentación: `estado-y-plan.md` (estado + roadmap), `arquitectura.md`
  (+ `arquitectura.mermaid` y ADR-0001 multi-tenancy), `modelo-de-datos.md`,
  `reglas-de-negocio.md`, `data/` (catálogos base, p. ej. plan de trabajo),
  `mockups/` (bocetos de vistas aprobadas con el equipo) y
  `plantillas/` (plantillas Excel para importar/exportar, p. ej. plan de acción).

El stack tecnológico ya está definido (ver
[`CONTEXTO-PARA-CLAUDE-CODE.md`](./CONTEXTO-PARA-CLAUDE-CODE.md) §2): Next.js en
Vercel, API Express en Railway, PostgreSQL con Prisma, autenticación con
Auth.js/Clerk. **Toda regla de negocio se valida en el backend** — el frontend
nunca debe poder saltarse una validación.

## Convenciones de trabajo

- Todo cambio de negocio relevante (reglas, entidades, decisiones de
  arquitectura) debe reflejarse en `docs/` — no dejar esa información solo en
  el historial de commits o en la conversación.
- Mantén `docs/estado-y-plan.md` al día: márcalo cuando completes una fase o
  tomes una decisión de producto, para que cada sesión retome con contexto real.
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

## Módulo de Hallazgos y Planes de Acción (en diseño)

Portal para que los clientes de la **revisoría fiscal** consulten sus hallazgos de
auditoría y el estado de sus planes de acción, pensado para presentar a la **asamblea /
junta directiva**. Mockup de referencia (HTML autocontenido, sin backend aún):
[`docs/mockups/dashboard-asamblea-hallazgos.html`](./docs/mockups/dashboard-asamblea-hallazgos.html).

- **Acceso reservado por empresa (login).** Cada empresa cliente entra con su propio
  usuario/contraseña y ve **solo su información**; la autenticación real va en el backend
  con contraseñas cifradas y permisos verificados por endpoint (no ocultando UI).
- **Perfiles previstos:**
  - *Revisor Fiscal (Auditor, CERPAT)* — **alimenta** la matriz: crea/edita hallazgos,
    define normatividad, riesgo y prioridad sugerida, y **verifica** los cierres. Tiene
    dashboard resumen por cliente.
  - *Cliente · Asamblea/Gerencia* — **solo lectura** del dashboard (decisión de producto
    vigente: por ahora el cliente no edita; el plan lo carga CERPAT).
  - (Futuro) *Cliente · Responsable de área* — registraría su plan y evidencia.
- **Flujo:** el Revisor crea el hallazgo → se registra el plan (responsable + plazo) →
  se ejecuta y adjunta evidencia → el Revisor verifica → pasa a *Resuelto*.
- **Vistas:** consolidado de grupo (varias empresas), dashboard por empresa (KPIs, nivel
  de resolución, hallazgos por área) y **matriz de auditoría**. Columnas de la matriz:
  Hallazgo · Descripción situación · Normatividad · Riesgo · Prioridad (Sugerida) ·
  Responsable · Acción o plan de remediación · Plazo · Estado · Observaciones seguimiento.
- **Import/Export Excel.** El Revisor puede importar/exportar el plan; la plantilla base
  está en [`docs/plantillas/plantilla-plan-de-accion-hallazgos.xlsx`](./docs/plantillas/plantilla-plan-de-accion-hallazgos.xlsx)
  (mismas columnas que la matriz, con listas desplegables). El portal usa CSV para el
  intercambio (formato nativo de Excel).
- **Pendiente:** modelar entidades (`Hallazgo`, `PlanDeAccion`, área, responsable,
  evidencia, verificación) en `prisma/schema.prisma` y documentarlas en
  `docs/modelo-de-datos.md` y `docs/reglas-de-negocio.md` antes de cablear a la API.
- **Marca:** el isotipo del portal es una reconstrucción provisional; falta incrustar el
  logo oficial de CERPAT en vector (`.svg`).

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
