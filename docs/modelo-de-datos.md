# Modelo de datos — Planeador CERPAT

> **Fuente de verdad del esquema:** [`../prisma/schema.prisma`](../prisma/schema.prisma).
> Este documento explica el modelo; el detalle de columnas y relaciones se
> mantiene sincronizado con el `schema.prisma` y con
> [`../CONTEXTO-PARA-CLAUDE-CODE.md`](../CONTEXTO-PARA-CLAUDE-CODE.md) §3.
> Cualquier cambio en el modelo debe reflejarse en el mismo cambio que lo
> introduce en el código.

## Multi-tenancy (leer primero)

El modelo es **multi-tenant**: cada firma contable es una **`Organizacion`**
(el *tenant*) y **todas las entidades del dominio llevan `organizacionId`**. Ver
[`arquitectura.md`](./arquitectura.md) → ADR-0001.

- **`Organizacion`** — la firma contable. `nombre`, `slug` (único), `nit`,
  `activo`. Raíz de todo: usuarios, empresas cliente, tareas, pagos, catálogos,
  parámetros y apariencia cuelgan de ella (con borrado en cascada).
- **Root de plataforma** — `Usuario` con `esRootPlataforma = true` y
  `organizacionId = null`; único actor cross-tenant, administra organizaciones.
- **Unicidad por tenant** — índices compuestos: `Usuario [organizacionId, email]`,
  `Rol [organizacionId, nombre]`, `Etiqueta [organizacionId, nombre]`.
  `ParametrosLiquidacion` y `Apariencia` tienen `organizacionId` único (una fila
  por organización).
- **Regla de aislamiento** — el backend filtra por `organizacionId` (derivado de
  la sesión) en cada consulta; nunca confiar en un `organizacionId` del cliente.

## Entidades principales

Todas (salvo `Organizacion` y el root) pertenecen a una organización vía
`organizacionId`:

- **`Empresa`** (clientes) — nombre, NIT y FKs a catálogos (tipo, sector,
  régimen, periodicidad de IVA, municipio). Hoy ~60 empresas, proyectado a 200.
  Contrato de servicio: `contratoDesde`, `mesesContrato`, `contratoHasta`,
  `horasPactadasMes` (decimal, **por mes**) y `alcanceServicio`. Los tres datos
  de vigencia se guardan **tal como los registre la firma**: el esquema no impone
  que `contratoHasta` cuadre con `contratoDesde + mesesContrato`, porque una
  prórroga puede no cuadrar; la ficha avisa de la discrepancia (ver
  [reglas de negocio](./reglas-de-negocio.md)).
- **`Usuario`** — nombre, email (único por organización), `passwordHash`,
  `activo`, `esRootPlataforma`. Roles vía `Rol` + `UsuarioRol` (muchos-a-muchos):
  Administrador, Asesor, Auditor, Auxiliar (roles definidos por organización).
- **`Asesor`** — vinculable a un `Usuario` (`usuarioId` opcional): puede haber
  asesores sin cuenta de login.
- **`Tarea`** — entidad central. Estado (`por_iniciar`, `en_curso`,
  `en_revision`, `terminado`, `auditado`, `no_realizado`), prioridad, fechas,
  FKs a catálogos, banderas (`requiereRevisionTecnica`, `generaPago`,
  `generaIneficacia`, `requiereSoporte`, `interno`), auditoría y soporte.
  Relaciones: `TareaAsignado`, `TareaEtiqueta`, `Subtarea`.
- **`Subtarea`** — texto, estado (`pendiente`, `realizada`, `no_aplica`,
  `no_realizada`), orden.
- **`Pago`** — seguimiento de obligaciones de pago (valor, vencimiento, estado
  de tarea y de pago); base del liquidador de intereses.
- **`Vencimiento`** — calendario tributario general (no ligado a una tarea).
- **Catálogos** — `TipoEmpresa`, `Sector`, `RegimenTributario`,
  `PeriodicidadIva`, `TipoServicio`, `Municipio` (con `departamento`),
  `TipoTarea`, `TipoObligacion`, `Periodicidad`, `Etiqueta`.
- **Configuración (fila única por organización)** — `ParametrosLiquidacion`
  (tasa de mora, UVT, SMMLV, etc.) y `Apariencia` (marca de la app).

### Flujo del cierre (F1 — ver [`metodologia-operacion.md`](./metodologia-operacion.md))

- **`ActividadPlan.fase`** (`FaseActividad?`: `captura` / `procesamiento` /
  `revision`) — ubica la actividad en la cadena del cierre. La captura (auxiliar)
  habilita el procesamiento (asesor). `null` = sin clasificar (no bloquea).
- **`EntregaInsumo`** — entrega del insumo de un cliente por período. `areaId`
  `null` = **general** (habilita todas las áreas); `areaId` ≠ null = **por área**.
  `origen` (`auto` / `manual`), `entregadoPor`, `entregadoEn`. Único por
  (`empresaId`, `periodo`, `areaId`).
- **`EventoTarea`** — bitácora de una tarea (`tipo` `estado`/`entrega`, estado
  anterior/nuevo, usuario, fecha); base para medir tiempos de ciclo y de handoff.
- **`AsignacionClienteArea.insumoCliente`** (`Boolean`) — el insumo de esa área lo
  provee el **cliente** (auxiliar externo), no la firma: la entrega se marca a mano
  y su demora no es de la firma.
- **`ActividadPlan.esCapturaDocumentos`** (`Boolean`) — marca la actividad especial
  *Captura de documentos*: su tarea muestra el detalle de lotes.
- **`LoteCaptura`** — lote capturado dentro de la tarea de captura: `tipoDocumento`,
  consecutivo `desde`–`hasta`, `cantidad`, `fecha`. Registro diario del auxiliar
  dentro de la tarea mensual.

### Novedades del día

- **`TipoNovedad`** — catálogo de causas (Internet, Acceso al sistema, Equipo
  lento, …), administrable en *Administración → Tipos de novedad*. Único por
  (`organizacionId`, `nombre`). Catálogo y no texto libre, para que la suma por
  causa dé un número y no tres variantes de la misma palabra.
- **`Novedad`** — lo que impidió trabajar: `usuarioId` (quien reporta), `tipoId`,
  `fecha`, `descripcion`, **`planAccion` (obligatorio)**, `horaDesde`/`horaHasta`
  (`"HH:MM"`, opcionales) y `minutos` (calculado en el backend al guardar),
  `empresaId?`/`areaId?` (contexto opcional), `estado` (`abierta`/`resuelta`) y
  el registro del cierre: `cerradaEn`, `cerradaPorId`. **Sin FK a `Tarea` a
  propósito**: una novedad nunca cambia el estado de una tarea.

### Visitas a clientes (asesor / auditor)

- **`Visita`** — visita de un asesor o auditor a un cliente, con su **acta** hecha
  en la app: `empresaId`, `responsableId` (asesor/auditor), `fecha`, `hora?`,
  `objetivo?`, `recomendaciones?`, `estado` (`EstadoVisita`: `programada` /
  `realizada` / `cancelada`), `observaciones?`. `actividadPlanId`/`periodo` quedan
  reservados para las visitas recurrentes del plan (Fase 3, aún sin FK). Es una
  fuente más del **calendario** (etiqueta "Visitas").
- **`CompromisoVisita`** — compromiso acordado en una visita: `descripcion`,
  `fechaLimite?`, `estado` (`EstadoCompromiso`: `pendiente` / `cumplido` /
  `cancelado`), `area?`. El responsable puede ser **de la firma** o **del
  cliente**: `responsableTipo` (`ResponsableCompromiso`: `firma` / `cliente`),
  con `responsableId?` (usuario interno, si es firma) o `responsableExterno?`
  (nombre y cargo del externo, si es cliente). Varios por visita; base del
  seguimiento por cliente, asesor y área.
- **`ItemActa`** — ítem enumerado del acta: `tipo` (`TipoItemActa`: `actividad` /
  `recomendacion` / `observacion`), `orden`, `texto`. Reemplaza a los campos de
  texto `Visita.recomendaciones` / `Visita.observaciones` (que quedan como legado).
  `Visita` suma además `area?` y `lugar?`.

## Relaciones

El diagrama entidad-relación se deriva del `schema.prisma`. El diagrama de
arquitectura del sistema está en [`arquitectura.mermaid`](./arquitectura.mermaid).

## Convenciones

- Nombrar entidades y atributos en español, consistente con el dominio de CERPAT.
- El `schema.prisma` usa `@@map` para nombrar las tablas en snake_case español
  (`tareas`, `usuario_roles`, `cat_tipos_empresa`, …).
- Cualquier cambio en el modelo debe reflejarse en este documento **y** en
  `schema.prisma` en el mismo cambio.
