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
- [x] Sistema de temas (Actual / Sereno / Enfoque) en Apariencia.
- [x] Matrices Excel para cargar clientes y usuarios (entregadas al equipo).

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

## En diseño — Plan de Trabajo Contable (cumplimiento) 🚧

Dirección nueva (idea del equipo): en vez de depender de que cada usuario cargue
tareas, el sistema **genera el plan de trabajo por cliente** a partir de una
plantilla de actividades contables recurrentes, y mide **cumplimiento / atraso**
por cliente y por asesor.

**Concepto en 3 capas:**
1. **Catálogo de actividades del plan** (definido una vez): p. ej. conciliación
   bancaria, cartera, caja, depreciación, amortización, anticipos, conciliación
   de impuestos, obligaciones financieras, parafiscales/seguridad social — cada
   una con grupo, periodicidad, evidencia esperada y si requiere auditoría.
2. **Generación automática de tareas** por *cliente × actividad × período*, con
   fecha límite según periodicidad, asignadas al asesor del cliente.
3. **Ejecución + reporte:** el asesor marca Ejecutada (con evidencia), el auditor
   marca Auditada; la cuadrícula semáforo y las métricas (atraso/adelanto) se
   calculan solas.

**Decisiones tomadas:**
- Asignación del plan **por plantilla de tipo de servicio** (Outsourcing /
  Asesoría Contable / Revisoría), ajustable por excepción.
- El catálogo base es una **lista maestra**; para **cada cliente** se puede
  **agregar o retirar** actividades y **ajustar la periodicidad** que corresponda.
- **Área** como dimensión organizacional: la firma trabaja por secciones —
  **Impuestos, Informes, Cumplimiento, Nómina, Tesorería**. Cada actividad
  pertenece a un área (distinta del "grupo contable" temático).
- Cada actividad/cliente distingue **Asesor (responsable)** de **Auxiliar
  (ejecutor)**. Lo práctico: asignar asesor+auxiliar **por cliente × área** y que
  las tareas hereden esos responsables.
- **Seguimiento en 3 ejes**: por **área**, por **asesor** y por **auxiliar**
  (además de por cliente). Ciclo mensual Programado → Ejecutado → Auditado; RAG
  derivado de fechas.

**Catálogo base (34 actividades, 4 grupos contables + área):**
[`data/plan-trabajo-actividades.csv`](./data/plan-trabajo-actividades.csv) —
columnas `grupo`, `area`, `codigo`, `actividad`, `documento_formato`,
`periodicidad_sugerida`. Grupos: Estados Financieros, Impuestos Nacionales (DIAN),
Impuestos Municipales, Obligaciones Mercantiles. El mapeo a **área** es una
propuesta (Impuestos 12 · Cumplimiento 10 · Tesorería 6 · Informes 4 · Nómina 2):
revisar/ajustar con el equipo. Transcrito del cronograma; borrador.

**Mockup:** [`mockups/plan-trabajo-cumplimiento.html`](./mockups/plan-trabajo-cumplimiento.html)
— cuadrícula semáforo por área + tarjetas de cumplimiento por área/asesor/auxiliar.

**Calendario (conexión):**
- **Base:** el plan alimenta el **Calendario** y **Mi Día** internos de la app,
  filtrables por área/asesor/auxiliar (una vista "Mi Día" por persona).
- **Opcional (fase 4):** sincronizar los vencimientos de cada persona a su
  **Outlook (M365)** o **Google Calendar** (one-way vía n8n/Graph), o un **feed
  `.ics` suscribible** por persona/área.

**Cambios de datos previstos (aún no implementados):**
- `Area` — catálogo de áreas de la firma (Impuestos, Informes, Cumplimiento,
  Nómina, Tesorería), por organización.
- `ActividadPlan` — catálogo base (grupo, **areaId**, código, actividad,
  descripción, documento/evidencia, periodicidad sugerida, requiereAuditoria).
- `PlanClienteActividad` — vínculo empresa↔actividad: `activa` (agregar/retirar) +
  `periodicidad` propia del cliente.
- `AsignacionClienteArea` — por empresa × área: **asesor** (responsable) y
  **auxiliar** (ejecutor); las tareas heredan de aquí.
- `SeguimientoMensual` (o `Tarea` con `actividadPlanId` + `periodo` + `areaId` +
  `asesorId`/`auxiliarId`): estado Programado/Ejecutado/Auditado por cliente ×
  actividad × mes — base de la cuadrícula y de las métricas por 3 ejes.

**Iteración 2 — mejoras del equipo (en el mockup, por implementar):**
- **Subtareas por actividad:** `SubtareaPlantilla` (por `ActividadPlan`, ordenada)
  → se copia a `Subtarea` de la tarea al generarla. Regla ya existente: no se
  marca Ejecutada/Auditada con subtareas pendientes.
- **Registro en software (comprobantes):** bandera `esRegistroSoftware` en
  `ActividadPlan`; en la ejecución se capturan `comprobanteDesde` /
  `comprobanteHasta` → `cantidadRegistros`. Métrica: **registros por auxiliar**
  (causación de compras/ventas/egresos, etc.).
- **Tamaño/complejidad de empresa:** `Empresa.tamano` (S/M/L/XL) — arranque
  manual por el coordinador; opcional afinar con drivers por área (Tesorería
  #bancos/#movimientos, Nómina #empleados, Impuestos #municipios…) → un
  `factorComplejidad` que **pondera la carga y el cumplimiento** para comparar
  justo entre asesores.
- **Panel de Coordinación (solo consulta):** los indicadores de cumplimiento/
  seguimiento viven en una vista aparte, restringida a un rol **Coordinador**;
  la ejecución (subtareas, comprobantes, evidencia) vive en la vista operativa de
  cada asesor/auxiliar.
- **Agregar/quitar actividades por área en cada cliente:** la gestión del plan de
  cada cliente se hace por área (activar/desactivar actividades vía
  `PlanClienteActividad.activa`).

**Mockup de referencia:** [`mockups/plan-trabajo-cumplimiento.html`](./mockups/plan-trabajo-cumplimiento.html)
(cuadrícula semáforo + métricas por asesor y cliente). Próximo paso: afinar el
mockup con el equipo y luego el modelo de datos + generación.

## Deuda técnica / notas
- El endpoint `/empresas` resuelve la **organización demo fija** (`slug: cerpat`) hasta que exista auth.
- La BD usa `db push` (sin migraciones versionadas todavía); migrar a `prisma migrate` antes de datos productivos críticos.
- `prisma/data/clientes-cerpat.csv` contiene PII de clientes reales; vive en el repo privado por decisión del equipo.
