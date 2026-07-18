# Arquitectura — Planeador CERPAT

> Estado: plantilla inicial (bootstrap). Completar a medida que se tomen
> decisiones de arquitectura reales con el usuario.

## Visión general

El Planeador CERPAT es un monorepo con tres componentes principales:

- **`apps/web`** — Frontend: interfaz con la que los usuarios interactúan para
  planificar y consultar operaciones.
- **`apps/api`** — Backend: expone la API, contiene la lógica de negocio y
  gestiona la persistencia de datos.
- **`packages/shared`** — Código compartido (tipos, contratos, utilidades)
  entre `web` y `api`, para evitar duplicación y mantener consistencia en los
  contratos de datos.

## Decisiones pendientes

Estas decisiones aún no se han tomado y deben documentarse aquí cuando se
definan:

- [ ] Stack tecnológico de `apps/web` (framework, bundler, gestor de estado).
- [ ] Stack tecnológico de `apps/api` (runtime, framework).
- [ ] Base de datos y estrategia de persistencia.
- [ ] Estrategia de autenticación y autorización.
- [ ] Estrategia de despliegue e infraestructura.
- [ ] Gestión de dependencias del monorepo (workspaces, herramienta de build).

## Diagrama de componentes

_Pendiente — agregar diagrama cuando la arquitectura esté definida._

## Decisiones tomadas

_Ninguna todavía. Registrar aquí cada decisión de arquitectura relevante junto
con su justificación (ADR corto: contexto, decisión, consecuencias)._
