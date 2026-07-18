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

## Arquitectura multi-tenant (SaaS multi-firma)

El producto es **multi-tenant**: cada **firma contable** es una `Organizacion`
(el *tenant*), completamente aislada de las demás. Todo el dominio (empresas
cliente, usuarios, tareas, pagos, catálogos, parámetros, apariencia) cuelga de
una organización mediante `organizacionId`.

- **Root de plataforma:** un usuario con `esRootPlataforma = true` y
  `organizacionId = null`, que vive por fuera de toda firma y puede administrar
  organizaciones. Es el único actor cross-tenant.
- **Aislamiento:** ninguna consulta debe cruzar organizaciones. El backend
  **inyecta y verifica `organizacionId` en cada endpoint** (a partir de la
  sesión), nunca confía en un `organizacionId` enviado por el cliente. Un usuario
  normal solo ve datos de su propia organización.
- **Unicidad por tenant:** `email` de usuario, `nombre` de rol y `nombre` de
  etiqueta son únicos **por organización** (dos firmas pueden repetirlos).
- **Portal de clientes (fase futura):** dentro de una firma, el aislamiento
  por **empresa cliente** (para que cada cliente vea solo lo suyo) se construye
  encima de este modelo, filtrando por `empresaId` además de `organizacionId`.

Fuente de verdad del esquema: [`../prisma/schema.prisma`](../prisma/schema.prisma).

## Decisiones tomadas

### ADR-0001 — Multi-tenancy por organización (firma contable)

- **Contexto:** el Planeador se ofrecerá como SaaS a varias firmas contables,
  no solo a CERPAT. Cada firma gestiona sus propias empresas cliente, usuarios,
  tareas y catálogos, y sus datos no deben mezclarse jamás con los de otra firma.
- **Decisión:** modelo multi-tenant de **base de datos compartida con columna de
  tenant** (`organizacionId` en cada tabla del dominio), más una entidad
  `Organizacion` como raíz del tenant y un rol **root de plataforma**
  (`Usuario.esRootPlataforma`, `organizacionId` nulo) por encima de todas las
  firmas. Ver esquema en `prisma/schema.prisma` y seed en `prisma/seed.ts`.
- **Consecuencias:**
  - El aislamiento se aplica **en el backend** (filtro obligatorio por
    `organizacionId` derivado de la sesión) — es la regla de seguridad #0.
  - `email`, `Rol.nombre` y `Etiqueta.nombre` pasan a ser únicos por tenant
    (índices compuestos `[organizacionId, …]`).
  - `ParametrosLiquidacion` y `Apariencia` son fila única **por organización**.
  - Pendiente (no incluido en esta decisión, que es solo diseño de datos):
    implementar en `apps/api` el middleware de tenant, el filtrado por endpoint
    y la resolución de la organización desde la sesión/subdominio.

Registrar aquí cada decisión de arquitectura relevante junto con su
justificación (ADR corto: contexto, decisión, consecuencias) a medida que se
tomen durante la implementación.
