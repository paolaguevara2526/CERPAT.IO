# Revisoría Fiscal · Portal de Hallazgos

Módulo **para clientes externos** (no personal CERPAT): un portal donde la
asamblea/gerencia de cada cliente ve el estado de los **hallazgos** de la
revisoría fiscal y sus **planes de acción**, y donde el **revisor fiscal**
(rol Auditor de CERPAT) alimenta la matriz. Es un módulo hermano del Planeador,
no una vista dentro de él, porque sus usuarios son externos.

Diseño de referencia: prototipo `Portal de Hallazgos` (HTML entregado por el
equipo). Este documento fija el comportamiento esperado al cablearlo a la base.

## Perfiles / accesos

Se reutiliza el login de `cerpat.io` (scrypt + JWT + cambio de clave
obligatorio). Los accesos de cliente los **crea y administra CERPAT** (Admin)
con contraseña temporal. Perfiles:

- **Cliente · empresa** — rol `Cliente` ligado a **una empresa**
  (`Usuario.empresaClienteId`). Ve **solo su empresa**, en **solo lectura**.
- **Cliente · grupo** — rol `Cliente` ligado a un **grupo empresarial**
  (`Usuario.grupoClienteId`). Ve el **consolidado del grupo** y puede entrar al
  detalle de cada empresa del grupo. Solo lectura.
- **Revisor fiscal** — rol `Auditor` (personal CERPAT). **Alimenta la matriz**:
  crea/edita hallazgos, define normatividad, riesgo, prioridad, plan de
  remediación y observaciones de seguimiento.

## Reglas de aislamiento (se validan SIEMPRE en el backend)

- Un usuario `Cliente` solo puede leer hallazgos de **su** empresa (o de las
  empresas de **su** grupo). Nunca se cruzan datos entre clientes.
- El cliente **no** puede crear ni editar hallazgos (solo lectura).
- Solo el revisor (`Auditor`) / `Administrador` / root puede crear, editar o
  eliminar hallazgos y alimentar la matriz.
- El aislamiento se deriva del token de sesión (empresa/grupo del usuario), no
  de parámetros que llegue del cliente.

## Modelo de datos

- **`GrupoEmpresarial`** — agrupa varias `Empresa` para la vista consolidada.
- **`Empresa.grupoId`** — empresa perteneciente a un grupo (opcional).
- **`Usuario.empresaClienteId` / `Usuario.grupoClienteId`** — ligan a un usuario
  `Cliente` con su empresa o su grupo.
- **`Hallazgo`** — hallazgo + plan de acción:
  - `titulo`, `descripcion` (situación), `normatividad`, `area` (proceso),
    `riesgo` (`RiesgoNivel`: alto/medio/bajo — nivel/severidad),
    `riesgoDescripcion` (texto libre: narrativa del riesgo/impacto tal como
    viene en las matrices; la columna "Riesgo" de los CSV que traen un párrafo
    se guarda aquí y el nivel queda por defecto en `medio`),
    `prioridad` (`Prioridad` sugerida), `responsable`, `planAccion`
    (remediación), `plazo`, `observaciones` (seguimiento).
  - `estado` (`EstadoHallazgo`: `pendiente` / `en_gestion` / `resuelto`).
  - **Vencido** es **derivado**: `estado != resuelto && plazo < hoy`. No se
    almacena.

## Estados y métricas

- La cola/tablero del cliente agrupa por: **Resueltos**, **En gestión**
  (`pendiente` + `en_gestion` no vencidos) y **Vencidos** (derivado).
- `% de resolución` de una empresa/grupo = hallazgos `resuelto` sobre el total.

## Roadmap del módulo

1. **Fundación** (este corte): esquema (`GrupoEmpresarial`, `Hallazgo`,
   `Usuario.empresaClienteId/grupoClienteId`, `Empresa.grupoId`, enums) + rol
   `Cliente` (`db:roles-sync`). Sin vistas todavía.
2. **API de Hallazgos** — CRUD para el revisor y lectura con aislamiento para
   cliente/grupo; el token lleva empresa/grupo.
3. **Vistas React** — revisor (edición de la matriz), empresa (solo lectura) y
   grupo (consolidado).
4. **Administración** — alta de grupos y de usuarios `Cliente` ligados a
   empresa/grupo.
