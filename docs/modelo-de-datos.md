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

## Relaciones

El diagrama entidad-relación se deriva del `schema.prisma`. El diagrama de
arquitectura del sistema está en [`arquitectura.mermaid`](./arquitectura.mermaid).

## Convenciones

- Nombrar entidades y atributos en español, consistente con el dominio de CERPAT.
- El `schema.prisma` usa `@@map` para nombrar las tablas en snake_case español
  (`tareas`, `usuario_roles`, `cat_tipos_empresa`, …).
- Cualquier cambio en el modelo debe reflejarse en este documento **y** en
  `schema.prisma` en el mismo cambio.
