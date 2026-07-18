# packages/shared

Tipos, contratos y validaciones compartidas entre `apps/web` y `apps/api`.

Este paquete es la **fuente de verdad** para cualquier tipo, esquema (p. ej.
Zod) o utilidad usada por ambas apps, para evitar duplicación entre frontend y
backend. El código va en `src/` y se expone desde `src/index.ts`.
