# Modelo de datos — Planeador CERPAT

> **Fuente de verdad del esquema:** [`../prisma/schema.prisma`](../prisma/schema.prisma).
> Este documento explica el modelo; el detalle de columnas y relaciones se
> mantiene sincronizado con el `schema.prisma` y con
> [`../CONTEXTO-PARA-CLAUDE-CODE.md`](../CONTEXTO-PARA-CLAUDE-CODE.md) §3.
> Cualquier cambio en el modelo debe reflejarse en el mismo cambio que lo
> introduce en el código.

## Entidades principales

- **`Empresa`** (clientes) — nombre, NIT y FKs a catálogos (tipo, sector,
  régimen, periodicidad de IVA, municipio). Hoy ~60 empresas, proyectado a 200.
- **`Usuario`** — nombre, email único, `passwordHash`, `activo`. 35 usuarios
  internos. Roles vía `Rol` + `UsuarioRol` (muchos-a-muchos): Administrador,
  Asesor, Auditor, Auxiliar.
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
- **Configuración (fila única)** — `ParametrosLiquidacion` (tasa de mora, UVT,
  SMMLV, etc.) y `Apariencia` (marca de la app).

## Relaciones

El diagrama entidad-relación se deriva del `schema.prisma`. El diagrama de
arquitectura del sistema está en [`arquitectura.mermaid`](./arquitectura.mermaid).

## Convenciones

- Nombrar entidades y atributos en español, consistente con el dominio de CERPAT.
- El `schema.prisma` usa `@@map` para nombrar las tablas en snake_case español
  (`tareas`, `usuario_roles`, `cat_tipos_empresa`, …).
- Cualquier cambio en el modelo debe reflejarse en este documento **y** en
  `schema.prisma` en el mismo cambio.
