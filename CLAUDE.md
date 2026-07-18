# CLAUDE.md

Guía para Claude Code al trabajar en el repositorio del **Planeador CERPAT**.

## Qué es este proyecto

Monorepo del Planeador CERPAT. Ver [`CONTEXTO-PARA-CLAUDE-CODE.md`](./CONTEXTO-PARA-CLAUDE-CODE.md)
para el contexto de negocio completo antes de implementar funcionalidad nueva.

## Estructura

- `apps/web` — Frontend del planeador.
- `apps/api` — Backend: API y lógica de negocio.
- `packages/shared` — Tipos, contratos y utilidades compartidas entre `web` y `api`.
- `docs/` — Documentación de arquitectura, modelo de datos y reglas de negocio.

Este repositorio está en fase de **bootstrap**: la estructura de carpetas existe,
pero el stack tecnológico de cada app todavía no está definido. No asumas un
framework específico (React, Vue, Express, etc.) sin confirmarlo primero con el
usuario o sin evidencia en el propio código.

## Convenciones de trabajo

- Todo cambio de negocio relevante (reglas, entidades, decisiones de
  arquitectura) debe reflejarse en `docs/` — no dejar esa información solo en
  el historial de commits o en la conversación.
- Antes de introducir una entidad o relación nueva, revisa
  [`docs/modelo-de-datos.md`](./docs/modelo-de-datos.md) para mantenerlo
  consistente.
- Antes de implementar lógica de dominio, revisa
  [`docs/reglas-de-negocio.md`](./docs/reglas-de-negocio.md).
- `packages/shared` es la fuente de verdad para tipos/contratos usados por
  `web` y `api` simultáneamente; evita duplicarlos en cada app.
- Mantén los documentos en español, consistente con el resto del repositorio.

## Comandos

Aún no hay comandos de build/test/lint definidos (no hay `package.json` con
scripts todavía). Cuando se agregue el stack tecnológico, esta sección debe
actualizarse con los comandos reales (instalación, dev, test, lint, build).
