# Estado y plan — Planeador CERPAT

Documento vivo del estado en producción y el roadmap. Actualizar en cada avance.

_Última actualización: 2026-08-02._

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
- **`cerpat.io/`** — **home institucional** de la firma (reemplaza el sitio WordPress
  que vivía en `cerpat.com`): hero, servicios por área, «Sobre CERPAT», contacto
  (tel. 312 432 4791, Villavicencio) y acceso al planeador. Página estática propia.
- **`cerpat.io/app`** — planeador (prototipo `localStorage`) con el **tema
  escritorio**: sidebar en azul rey y tres secciones (Planeador / Gestión /
  Servicios), icono sherpa (🧗) en Usuarios.
- **`cerpat.io/servicios`** — **Herramientas** para equipo y clientes. Disponibles:
  **Calculadora de retenciones** (`/servicios/retenciones`) y **Punto de
  equilibrio** (`/servicios/punto-equilibrio`). En construcción: liquidador de
  intereses, prestaciones sociales, calendario tributario, portal de documentos.
- **`cerpat.io/usuarios`** — vista cableada del personal (26 usuarios) desde la BD.
- **`cerpat.io/clientes`** — vista **cableada**: web → API `GET /empresas` → Postgres, 90 clientes reales (sin correos, por privacidad).
- **`cerpat.io/vencimientos`** — vista **cableada** de obligaciones tributarias por
  cliente (API `GET /vencimientos`). **ICA municipal 2026 cargado** (338 vencimientos:
  ReteICA/AutoICA, ICA Yopal y exógena de ICA) — ver
  [`vencimientos-tributarios.md`](./vencimientos-tributarios.md). El **Administrador**
  edita **estado y fecha** de cada vencimiento en línea; el resto solo consulta.
- **`cerpat.io/coordinacion`** — **Panel de Coordinación** (solo consulta): KPIs de
  cumplimiento del plan por área, asesor, auxiliar y clientes en riesgo
  (API `GET /plan/cumplimiento`). Los ejes asesor/auxiliar se llenan al cargar
  usuarios y asignaciones en la BD.

## Arquitectura decidida
- **Multi-tenant (SaaS multi-firma):** cada firma contable es una `Organizacion` aislada; todo el dominio lleva `organizacionId`. **Root de plataforma** (`Usuario.esRootPlataforma`) por encima. Ver [`arquitectura.md`](./arquitectura.md) → ADR-0001.
- **Regla de aislamiento:** el backend filtra por `organizacionId` de la sesión en cada consulta; nunca confiar en el cliente.
- Stack: Next.js (Vercel) · Express/TS (Railway) · PostgreSQL/Prisma · auth Auth.js/Clerk (pendiente) · n8n (pendiente) · Microsoft 365 correo (pendiente) · Sentry (pendiente).
- **Sistema de diseño "software de escritorio":** paleta **azul rey apagado**
  (`#2E5090` / `#16294A`) como color primario + **verde CERPAT** (`#34C98B`) como
  acento/positivo; marco de ventana con controles estilo Windows, botones rectos
  con relieve 3D sutil y paneles biselados (`apps/web/app/desktop.css`). Lema de
  marca: *"guiamos a nuestros clientes a la cima"* (motivo del sherpa y de las
  tendencias ▲ en los KPIs). Logo oficial en `/public`.
- **Identidad de dominio: todo en `cerpat.io`.** La firma perdió el manejo de
  `cerpat.com`, así que se consolida la identidad (web **y correo**) en
  `cerpat.io`, dominio que el equipo sí controla (Hostinger → Vercel). En el repo
  ya se cambiaron los correos `@cerpat.com` → `@cerpat.io` (usuarios/personal,
  seed y casillas de la firma usadas como contacto de clientes). **Pendiente
  operativo del equipo:** migrar las casillas reales (Microsoft 365) a
  `@cerpat.io`; hasta entonces esos buzones aún no reciben correo. Los correos de
  terceros (clientes) no se tocan.

## Construido en agosto 2026 (calendario · vencimientos · pagos · calidad)

**Vencimientos tributarios (ICA 2026) cargados** — 338 vencimientos por empresa
(ReteICA/AutoICA, ICA Yopal, exógena de ICA). Detalle y reglas por municipio en
[`vencimientos-tributarios.md`](./vencimientos-tributarios.md).

**Estados de un vencimiento** — enum `EstadoPago` con 6 valores: `pendiente`,
`presentado_sin_pago`, `presentado_pagado`, `presentado_cero` ("Presentado en
$0"), `no_presentado`, `no_obligado`. El Administrador los edita en línea.

**`cerpat.io/planeador/calendario` — Calendario unificado.** Fusiona en un solo
mes las **tareas del plan** y los **vencimientos**. Filtros múltiples (etiquetas,
clientes, estado), interruptor para ocultar estados, **arrastrar** para
reprogramar, **imprimir** el mes, y **sábados/domingos/festivos** de Colombia
marcados (festivos calculados en código: fijos + Ley Emiliani + Pascua). Clic en
una tarea abre su **modal completo** (pestañas General/Fiscal/Auditoría) y clic
en un vencimiento su detalle; ambos con **Soporte Documental** (link editable
Drive/OneDrive donde va quedando el trabajo).

**`cerpat.io/planeador/pagos` — Pagos.** Suma las tareas con pago y los
**vencimientos por pagar** (presentados). Los vencimientos ganaron **valor a
pagar** (`valorPago`); al marcarlos "Presentado (sin pago)" aparecen aquí.
Filtros por cliente y estado. Además, sección **"Pagos pendientes"** para
registrar a mano **deudas de años anteriores** o impuestos que no se cargaron al
sistema: el Administrador crea la entrada (cliente, obligación, año, período,
vencimiento, valor, notas), la edita y la elimina. Se guardan como
`VencimientoEmpresa` con `generado=false` (sin migración: el campo ya existía) y
se listan aparte de los vencimientos del generador — API `POST /vencimientos`,
`GET /vencimientos/pendientes`, `DELETE /vencimientos/:id`.

**Regenerar vencimientos por cliente.** En **Administración → Config. tributaria**,
tras corregir un parámetro, el botón **"Regenerar vencimientos"** rehace los
vencimientos **nacionales** del cliente según su config actual (cruce con el
calendario 2026 embebido en la API, `apps/api/src/vencimientos/`, y el NIT). Es
**seguro con los pagos**: crea los que faltan, ajusta fechas y borra los
sobrantes que quedaron **sin trabajar**, pero **conserva** los que ya tienen
valor/estado/nota/soporte, y **nunca toca** el ICA municipal ni las entradas
manuales (`generado=false`). API `POST /vencimientos/regenerar/:empresaId` (solo
Administrador). El calendario `.ts` se regenera desde los CSV de `docs/data/` con
`node apps/api/scripts/build-calendario.mjs`.

**Calidad / infraestructura** — se adoptaron **migraciones versionadas de
Prisma** (fin del SQL manual y del *drift*) y **CI en cada PR** (valida esquema +
compila API y web). Curaduría estructural completa en
[`revision-tecnica.md`](./revision-tecnica.md).

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
- [x] Migraciones versionadas de Prisma (baseline + `prisma migrate deploy`) y CI en cada PR (ago 2026).
- [ ] `api.cerpat.io` (dominio propio de la API); activar `migrate deploy` en el deploy.

### Fase 5 — Portal de clientes (futuro)
- [ ] Aislamiento adicional por empresa cliente (cada cliente ve solo lo suyo) sobre el modelo multi-tenant.

### Módulo Revisoría Fiscal · Portal de Hallazgos 🚧 (en construcción)
Portal para clientes externos (asamblea/gerencia) + revisor fiscal. Ver
[`docs/revisoria-fiscal.md`](./revisoria-fiscal.md).
- [x] Fundación: esquema (`GrupoEmpresarial`, `Hallazgo`, `Usuario.empresaClienteId/grupoClienteId`, `Empresa.grupoId`, enums `RiesgoNivel`/`EstadoHallazgo`) + rol `Cliente` (`db:roles-sync`).
- [x] API de Hallazgos (CRUD revisor + lectura con aislamiento cliente/grupo).
- [x] Vistas React (revisor / empresa / grupo) en `/hallazgos`.
- [x] Administración: grupos (pestaña Grupos), asignar empresa→grupo y usuarios `Cliente` ligados a empresa/grupo.

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
  `PlanClienteActividad.activa`). ✅ **UI en producción**: Administración →
  *Plan por cliente* (marcar actividades por área + periodicidad, y generar las
  tareas del período por cliente).
- **Tamaño por área con tallas:** la talla (S/M/L/XL) es **por empresa × área**
  (una empresa puede ser L en Tesorería y S en Nómina) → campo `talla` en
  `AsignacionClienteArea`.

**Estado de implementación:**
- ✅ **Fase 1 — modelo de datos (schema Prisma):** agregadas `Area`,
  `ActividadPlan`, `SubtareaPlantilla`, `PlanClienteActividad`,
  `AsignacionClienteArea` (asesor/auxiliar/talla), y campos de plan en `Tarea`
  (`actividadPlanId`, `areaId`, `periodo`, `asesorId`, `auxiliarId`,
  `comprobanteDesde/Hasta`, `cantidadRegistros`). El rol Coordinador es una fila
  de `Rol` (seed). Aplicado a la BD.
- ✅ Fase 2 — aplicado a la BD (`db push`) + catálogo sembrado (34 `ActividadPlan`
  desde el CSV) + 5 áreas + rol Coordinador.
- ✅ Fase 3 — asignación del plan a los 90 clientes (3060 `PlanClienteActividad`)
  y generación de tareas por período (2070 `Tarea` para 2026-07).
- 🟡 Fase 4 — en curso. Hecho: **Panel de Coordinación** con datos reales
  (`GET /plan/cumplimiento` + vista `/coordinacion`, solo consulta: KPIs,
  cumplimiento por área y clientes en riesgo); **ejecución con subtareas**
  (checklist + regla "no Ejecutada con subtareas pendientes"); y **registro en
  el software** (comprobante inicial/final → cantidad de registros calculada del
  rango y editable) en el modal de tarea, guardado por el ejecutor
  (asesor/auxiliar) o coordinación vía `PATCH /plan/tareas/:id/registro`.
  Pendiente: métrica **registros por auxiliar** en Coordinación (ya hay datos).
- 🟡 Usuarios / personal — cargado el catálogo de personal desde la base de la
  firma: 26 usuarios (Paola Guevara como root/administradora + 25 empleados
  activos) con su cargo, área y rol (Administrador, Asesor, Auxiliar, Auditor,
  Coordinador). Sólo se importan campos operativos (nombre, correo corporativo,
  cargo, área, rol); los datos sensibles de RR. HH. no entran al repo. Con esto
  se podrán poblar las asignaciones asesor/auxiliar por área y activar esos ejes
  en el Panel de Coordinación. Falta el bootstrap de autenticación (claves).
- 🟡 Asignaciones por área (asesor/auxiliar) — asignación automática "por área
  del empleado": `db:plan-asignaciones` reparte round-robin, por empresa×área,
  el asesor responsable y el auxiliar ejecutor entre las personas de esa área
  (`AsignacionClienteArea`), y rellena esos ejes en las tareas ya generadas.
  `plan-generar` hereda la asignación en meses futuros. El Panel de Coordinación
  ya muestra **seguimiento por asesor y por auxiliar**. Es un punto de partida
  aproximado; se ajusta por cliente cuando haga falta.
- ⬜ Fase 5 — calendario (interno + sync opcional Outlook/Google).

**Mockup de referencia:** [`mockups/plan-trabajo-cumplimiento.html`](./mockups/plan-trabajo-cumplimiento.html)
(cuadrícula semáforo + métricas por asesor y cliente). Próximo paso: afinar el
mockup con el equipo y luego el modelo de datos + generación.

## Deuda técnica / notas
- El endpoint `/empresas` resuelve la **organización demo fija** (`slug: cerpat`) hasta que exista auth.
- La BD usa `db push` (sin migraciones versionadas todavía); migrar a `prisma migrate` antes de datos productivos críticos.
- `prisma/data/clientes-cerpat.csv` contiene PII de clientes reales; vive en el repo privado por decisión del equipo.
