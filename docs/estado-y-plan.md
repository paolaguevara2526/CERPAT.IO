# Estado y plan — Planeador CERPAT

Documento vivo del estado en producción y el roadmap. Actualizar en cada avance.

_Última actualización: 2026-07-18._

## En producción hoy

| Capa | Servicio | Estado |
|---|---|---|
| Frontend | Vercel — `apps/web` (Next.js) | ✅ desplegado |
| Dominio | `cerpat.io` (+ `www`) en Hostinger → Vercel | ✅ activo (HTTPS) |
| Backend | Railway — `apps/api` (Express) | ✅ Online |
| Base de datos | Railway — PostgreSQL (Prisma) | ✅ conectada |
| Esquema | multi-tenant + rol root aplicado (`db push`) | ✅ |
| Datos | organización **CERPAT** + **90 clientes reales** cargados | ✅ |

### Vistas publicadas
- **`cerpat.io/`** — prototipo funcional del planeador (datos locales `localStorage`, especificación viva).
- **`cerpat.io/clientes`** — primera vista **cableada**: web → API `GET /empresas` → Postgres, muestra los 90 clientes reales (sin correos, por privacidad).

## Arquitectura decidida
- **Multi-tenant (SaaS multi-firma):** cada firma contable es una `Organizacion` aislada; todo el dominio lleva `organizacionId`. **Root de plataforma** (`Usuario.esRootPlataforma`) por encima. Ver [`arquitectura.md`](./arquitectura.md) → ADR-0001.
- **Regla de aislamiento:** el backend filtra por `organizacionId` de la sesión en cada consulta; nunca confiar en el cliente.
- Stack: Next.js (Vercel) · Express/TS (Railway) · PostgreSQL/Prisma · auth Auth.js/Clerk (pendiente) · n8n (pendiente) · Microsoft 365 correo (pendiente) · Sentry (pendiente).

## Roadmap

### Fase 1 — Infraestructura y datos ✅ (hecho)
- [x] Monorepo, esquema, seed, prototipo desplegado.
- [x] Vercel + dominio `cerpat.io`.
- [x] Railway (API + Postgres) conectado.
- [x] Multi-tenancy + root en el modelo de datos.
- [x] 90 clientes reales en Postgres.
- [x] Primer cableado real (`/clientes`).

### Fase 2 — Autenticación y aislamiento (siguiente)
- [ ] Auth (Auth.js/Clerk): login, sesión, hash de contraseñas (bcrypt/argon2).
- [ ] Bootstrap de credenciales para root y admin de CERPAT (hoy `passwordHash` vacío).
- [ ] Middleware de tenant en `apps/api`: resolver `organizacionId` desde la sesión y filtrar cada endpoint.
- [ ] Permisos por rol (Administrador/Asesor/Auditor/Auxiliar) por endpoint.
- [ ] Servir correos de clientes solo autenticado.

### Fase 3 — App real por vistas (reemplazar prototipo)
- [ ] Administración → Empresas (CRUD real sobre los 90 clientes, con correos).
- [ ] Usuarios, Asesores, Catálogos, Parámetros, Apariencia (por organización).
- [ ] Tareas: Tablero (kanban), Calendario (drag&drop), Lista (export), Mi Día.
- [ ] Reglas de negocio §4 en el backend (subtareas, soporte, bloqueo por auditoría, auto-asignación, Mi Día, liquidador de intereses, filtro de Pagos, exclusión de internos, etiquetas dinámicas).
- [ ] Pagos + liquidador de intereses/sanción.
- [ ] Auditoría (aprobar/rechazar/desbloquear + log de desbloqueo).

### Fase 4 — Automatización y operación
- [ ] n8n: recordatorios, recálculo diario de mora, tareas recurrentes, alertas a líderes.
- [ ] Microsoft 365 (Graph API) para correo desde `notificaciones@cerpat.io`.
- [ ] Sentry (monitoreo de errores).
- [ ] `api.cerpat.io` (dominio propio de la API) + migraciones versionadas (`prisma migrate deploy`).

### Fase 5 — Portal de clientes (futuro)
- [ ] Aislamiento adicional por empresa cliente (cada cliente ve solo lo suyo) sobre el modelo multi-tenant.

## Deuda técnica / notas
- El endpoint `/empresas` resuelve la **organización demo fija** (`slug: cerpat`) hasta que exista auth.
- La BD usa `db push` (sin migraciones versionadas todavía); migrar a `prisma migrate` antes de datos productivos críticos.
- `prisma/data/clientes-cerpat.csv` contiene PII de clientes reales; vive en el repo privado por decisión del equipo.
