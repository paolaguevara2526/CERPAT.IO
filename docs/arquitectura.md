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

### ADR-0002 — Cliente-como-tenant y licenciamiento por módulo

- **Contexto:** además de operar CERPAT por dentro, la plataforma se le **vende a
  los clientes** — algunas herramientas o todas, según su necesidad (ver
  [`vision-plataforma.md`](./vision-plataforma.md)). Un cliente que compra debe
  poder operar por sí mismo, con sus usuarios y sus datos, sin ver los de nadie.
- **Decisión:** el cliente que compra se modela como **su propia `Organizacion`
  (tenant)**, reutilizando el mismo aislamiento de ADR-0001 — no se inventa un
  segundo mecanismo. Sobre eso se agrega una capa de **entitlements**: qué
  **módulos** tiene habilitado cada tenant (Outsourcing, Auditoría/RF, SARLAFT,
  Talento, "Cómo trabajamos"), con su plan. El backend valida el entitlement del
  módulo **además** del `organizacionId` y de los permisos.
- **Consecuencias:**
  - Nace el concepto de **módulo** como unidad de producto y de permiso; cada
    módulo debe tener límites limpios para poder venderse/activarse por separado.
  - Se requiere un modelo de **suscripción/licencia por tenant × módulo** (y, a
    futuro, cobro). Encender/apagar un módulo no borra datos: los oculta.
  - El aislamiento entre tenants deja de ser una comodidad y pasa a ser
    **innegociable** (comercial **y** regulatorio) — refuerza la regla #0.
  - La modalidad "portal del cliente" (CERPAT opera, el cliente observa, aislado
    por `empresaId` dentro del tenant de CERPAT) **convive** con esta: un mismo
    cliente puede ser atendido por CERPAT *y*, si compra, tener su propio tenant.

### ADR-0003 — Permisos en tres niveles

- **Contexto:** la matriz plana de 5 roles (`acceso.ts`) alcanza para la operación
  actual, pero con módulos regulados (SARLAFT) y de datos personales (Talento) hay
  información que **ni un coordinador** debe ver, y con la venta a clientes aparece
  un nivel por encima de la firma.
- **Decisión:** permisos en **tres niveles**: (1) **plataforma** — root de CERPAT
  como operador del SaaS; (2) **organización/tenant** — administrador del cliente;
  (3) **módulo × acción** — qué puede hacer cada rol dentro de cada módulo. La
  navegación (menú por área) y los guardas de ruta se derivan de este modelo.
- **Consecuencias:**
  - `acceso.ts` evoluciona de "rol → rutas" a "rol → módulos → acciones";
    conviene hacerlo configurable, no cableado.
  - El menú por área muestra **solo** las áreas/funciones permitidas — clave para
    que un cliente-tenant vea únicamente lo que contrató (encaja con ADR-0002).
  - Separar el rol **empleado** (autoservicio de Talento) del rol de operación.

### ADR-0004 — Navegación por áreas (acordeón) y nomenclatura

- **Contexto:** la barra lateral actual ("Planeador") ya tiene ~12 ítems mezclando
  el trabajo diario con las áreas de dominio; no escala a cinco módulos.
- **Decisión:** barra lateral organizada como **acordeón por área** — cada área se
  despliega y muestra sus funciones al abrirla (recuerda la última abierta; los
  permisos filtran qué áreas se ven). Búsqueda y notificaciones **globales** arriba.
  Un **selector de módulo** por encima queda como evolución futura si las áreas
  crecen, sin rehacer nada. **Nomenclatura (hilo sherpa):** **Mi Ruta** (día a día,
  transversal y white-label-friendly), **Cómo trabajamos** (sistema de gestión),
  y nombre funcional para SARLAFT, Talento Humano y Auditoría/RF. *Ruta CERPAT* se
  reserva para la metodología/promesa de valor, no para el menú.
- **Consecuencias:**
  - "Mi Ruta" es **transversal**: agrega las tareas de la persona de **todos** los
    módulos (las vistas agregan por persona, no por módulo) — las áreas separadas
    en el menú **no** aíslan el trabajo ni la ficha 360 del cliente.
  - Los nombres no llevan la marca "CERPAT" dentro del producto, para que funcionen
    en instancias white-label de clientes (ADR-0002).

### ADR-0005 — Protección de datos personales y sensibles

- **Contexto:** Talento Humano (salarios, préstamos, hoja de vida) y SARLAFT
  manejan **datos personales y regulados**; además, con la venta a clientes, esos
  datos son de terceros sobre nuestra infraestructura.
- **Decisión:** tratar la protección de datos como **fundación transversal** (no
  como feature de un módulo): acceso restringido por permisos de módulo (ADR-0003),
  **cifrado de campos sensibles**, **bitácora de acceso** (F3) sobre datos
  personales, y **políticas de retención**. Cumplir Ley 1581 / Habeas Data
  (Colombia). Diseñarlo **antes** de guardar el primer dato sensible.
- **Consecuencias:**
  - Se involucra temprano el criterio legal/de cumplimiento de la firma.
  - Los módulos con PII exponen menos por defecto (principio de mínimo acceso).

## Otorgar el rol ROOT de plataforma

El rol **root** (`Usuario.esRootPlataforma`) es el permiso más alto y, en el modelo
multi-tenant, vive **por encima de las firmas**: por eso **no se edita desde la
interfaz** (un administrador de un cliente no debe poder crear roots de plataforma).

Hoy, en la práctica, el rol **Administrador ya da acceso a todo el producto**
(`esAdminRol = esRoot || Administrador`); root añade saltarse *cualquier*
verificación de rol y quedar protegido contra desactivación y borrado.

Dos formas de otorgarlo:

1. **Desde Railway (sin acceso a la base).** En el servicio de la API →
   *Variables*, agregar `PROMOVER_ROOT_EMAIL = <correo>` y redesplegar. Al
   arrancar, la API promueve esa cuenta y lo registra en el log. Después,
   **quitar la variable**. Ver `apps/api/src/bootstrap-root.ts` (idempotente).
2. **Con acceso a la base.** `npx tsx prisma/set-root.ts <correo>` (o
   `--quitar` para revocarlo).

Registrar aquí cada decisión de arquitectura relevante junto con su
justificación (ADR corto: contexto, decisión, consecuencias) a medida que se
tomen durante la implementación.
