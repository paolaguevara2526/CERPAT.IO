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

### ADR-0006 — Reglas de la PWA: caché y recargas automáticas

- **Contexto:** al activar la PWA con actualización automática, la app quedó
  recargándose sola al perder el foco de un campo (incluido el momento de pulsar
  "Entrar" en el login, que cancelaba el ingreso) y el service worker guardaba
  **todas** las respuestas GET del mismo origen, incluidas páginas HTML que el
  servidor arma con los datos de la persona autenticada.
- **Decisión:** tres reglas fijas para el service worker y su registro:
  1. **Nunca se cachea HTML ni la API.** Solo se guardan archivos estáticos e
     inmutables (`/_next/static/*`, íconos, imágenes, fuentes). Las páginas se
     piden siempre en vivo — llevan datos personales y dependen del despliegue.
  2. **La app nunca se recarga sola.** Cuando hay una versión nueva instalada, el
     service worker se queda *esperando* (no se llama a `skipWaiting()` al
     instalar) y la página muestra un **banner**: "Hay una versión nueva".
     La recarga ocurre únicamente cuando la persona pulsa *Actualizar*.
  3. La primera instalación del service worker **no** cuenta como actualización
     (no hay nada que avisar).
- **Consecuencias:**
  - Sin fuga de páginas de un usuario a otro por la caché del navegador (refuerza
    ADR-0005) ni versiones viejas servidas tras un despliegue.
  - Menos beneficio *offline* (solo la cáscara estática), a cambio de que la
    sesión y los datos siempre sean los reales. Es el intercambio correcto aquí.
  - Alguien puede quedarse un rato en una versión vieja si ignora el banner. Se
    acepta: es preferible a interrumpirle el trabajo, y el aviso reaparece en
    cada versión posterior.
  - Regla general: **la aplicación no cambia de estado por su cuenta durante el
    trabajo de una persona**; si necesita hacerlo, lo pide.

### ADR-0007 — Un solo cromo: marco, menú y app instalada

- **Contexto:** el planeador imita una "ventana de escritorio" (marco redondeado,
  barra de título con botones simulados). Instalada como **PWA**, el sistema
  operativo pone *su* barra de ventana encima: dos marcos superpuestos y un
  cinturón de espacio desperdiciado. Además, la barra del marco era navy fija
  mientras el menú lateral seguía el tema elegido en *Apariencia*: al escoger, por
  ejemplo, el tema verde, quedaban dos colores peleando en la misma esquina.
- **Decisión:** **el cromo es una sola pieza**. La barra superior y la barra
  lateral comparten familia de color por tema (`--chrome-bar` → `--nav-bg`,
  encadenados: la barra termina en el tono con el que arranca el menú) y **todos
  los controles viven en esa única barra** (marca, botón del menú, apariencia,
  controles de ventana) — antes había una segunda banda debajo solo para el botón
  del menú y el tema. **Instalada**, el marco se abre a pantalla completa (sin
  relleno, esquinas ni sombra), se retiran los adornos que el sistema ya provee
  (botones simulados y la ruta) y el menú **arranca colapsado a íconos**.
- **Consecuencias:**
  - La metáfora de escritorio se conserva **en el navegador**, donde sí aporta, y
    se cede ante el sistema operativo cuando la app está instalada.
  - Se recuperan ~90 px de alto útil (una banda + el relleno del marco).
  - Regla: **un tema recolorea todo el cromo, no una parte** — cualquier barra
    nueva debe tomar su color de las variables, nunca escribirlo a mano.

### ADR-0008 — Colores por significado, no por tono

- **Contexto:** el color de cada estado se escribía a mano en cada pantalla. El
  rojo de "vencido" aparecía **81 veces** en cuatro tonos distintos, `#b42318`
  convivía con `#B42318`, y `#2e5090` se repetía 23 veces existiendo ya `--navy`.
  Dos consecuencias: la misma información se veía distinta según la pantalla, y
  **el modo oscuro quedaba ilegible** —un fondo `#fbe4e1` casi blanco sobre un
  panel oscuro— porque un color fijo no puede seguir al tema.
- **Decisión:** los estados se nombran por lo que **significan**:
  `peligro` (vencido, no presentado, sanción) · `alerta` (por vencer, mora) ·
  `exito` (pagado, al día) · `info` (presentado sin pago, programado) ·
  `cero` (presentado en $0) · `neutro` (no obligado, sin dato). Cada uno con sus
  variantes `base` (texto), `fuerte` (énfasis), `suave` (fondo de franja),
  `borde` y `solido` (fondo saturado que lleva texto blanco encima y por eso
  **no** se aclara en oscuro). Definidos en los tres bloques de tema.
  **Regla: ningún estado se escribe con un hex en una pantalla.**
- **Consecuencias:**
  - El modo oscuro funciona en toda la plataforma sin tocar pantalla por pantalla:
    en oscuro el texto se aclara y los fondos pasan a ser un tinte translúcido.
  - Las transparencias de los chips ya no se hacen concatenando el alfa al hex
    (`${color}18`), que solo funciona con hex: se usa `tinte()` con `color-mix`,
    que acepta variables (`apps/web/app/_components/color.ts`).
  - Cambiar el rojo de la firma pasa a ser una línea, no 81.

### ADR-0009 — El tenant sale de la sesión

- **Contexto:** ADR-0001 dejó el diseño de datos multi-tenant, pero la
  implementación quedó pendiente: los endpoints resolvían la organización con el
  texto fijo `slug: 'cerpat'` —**40 veces** repartidas por siete routers—. Con una
  sola firma funcionaba, pero era **el bloqueo para vender la plataforma**
  (ADR-0002): un segundo tenant habría consultado los datos de CERPAT.
- **Decisión:** el `organizacionId` sale **del token de la sesión** y de ningún
  otro lado. Un único resolutor, `auth/tenant.ts → orgDeSesion(req)`, es el punto
  por donde pasa esa decisión. El **login** es la excepción inevitable —no hay
  sesión todavía—: encuentra la cuenta por el correo y, si algún día el mismo
  correo existe en dos firmas, responde pidiendo desambiguar en vez de adivinar.
  Un **root de plataforma** sin organización propia opera sobre la única que
  exista; cuando haya varias, tendrá que elegir, y ese es el único punto a tocar.
- **Consecuencias:**
  - El aislamiento entre firmas deja de depender de que cada endpoint se acuerde
    de filtrar bien: hay un solo lugar donde se decide.
  - Un test de blindaje (`auth/tenant.test.ts`) falla si alguien vuelve a
    resolver la organización por slug dentro de un endpoint. Sin él, una
    regresión rompería el aislamiento **en silencio** hasta que hubiera un
    segundo cliente.
  - Falta el mecanismo de **descubrimiento de firma** en el login (subdominio,
    dominio del correo o selector). No hace falta hoy y no bloquea: se decide
    cuando entre el primer cliente con su propio tenant.

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
