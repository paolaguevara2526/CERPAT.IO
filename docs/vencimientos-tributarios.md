# Vencimientos tributarios por cliente (parametrización + generación)

Documento vivo del módulo de **parametrización de vencimientos**: cada cliente se
configura una vez (responsabilidades) y el sistema **genera automáticamente los
vencimientos de todo el año** cruzando esa configuración con el calendario oficial.

_Estado: en producción. Generador nacional (Retención, IVA, Consumo, Anticipo RST,
Renta, FOPAT) e **ICA municipal** (ICA / ReteICA / AutoICA) funcionando; se
disparan por cliente con el botón **Regenerar vencimientos** en Config. tributaria._

## Enfoque (3 piezas)

1. **Calendario oficial** — las fechas del año por *obligación × periodicidad ×
   período × último dígito del NIT* (DIAN) y por *municipio* (ICA). Se carga una
   vez al año. Usa el modelo `Vencimiento` (ya existe: `obligacionId`, `municipio`,
   `periodo`, `fechaVencimiento`, `nitRango`).
2. **Responsabilidades del cliente** — qué obligaciones aplican y con qué
   periodicidad. Modelo nuevo propuesto `ResponsabilidadEmpresa`
   (*empresa × obligación × periodicidad × municipio opcional*): una tabla flexible
   cubre lo nacional (municipio vacío) y lo municipal (ICA con municipio).
3. **Generador** — por cada responsabilidad del cliente, busca en el calendario
   las fechas que aplican (según periodicidad y el último dígito de su NIT /
   municipio) y crea los vencimientos del año, asignados y con seguimiento.

## Regla general DIAN (validada contra el calendario oficial 2026)

Las obligaciones **mensuales/bimestrales** (Retención, IVA, Impuesto al consumo,
Anticipo RST) vencen en el **N-ésimo día hábil** del mes de presentación, donde N
depende del **último dígito del NIT**:

| Último dígito | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0 |
|---|---|---|---|---|---|---|---|---|---|---|
| Día hábil | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |

- **Último dígito = el anterior al de verificación.** Ej.: NIT `844002349-5` → se
  usa el **9**.
- **Días hábiles** = lunes a viernes, **excluyendo festivos de Colombia** (Ley
  Emiliani, Semana Santa, etc.). Los festivos se **calculan** en código, no se
  cargan a mano.

### Precisión de la regla

Validada contra las **120 fechas** del calendario DIAN 2026: **coincide en 10 de
12 meses**. **Abril y julio** llevan un **ajuste manual del decreto** (la DIAN
salta un día hábil sin que haya festivo que lo explique) que ninguna regla de días
hábiles reproduce.

**Decisión: enfoque híbrido.** La **fuente de verdad es el calendario oficial
cargado** (legalmente exacto); la regla queda como **validador / auto-relleno**
que pre-llena años nuevos y **marca las fechas que difieren** para confirmación.
Cada año se carga el PDF oficial nuevo.

## Mes de presentación por obligación (2026)

| Obligación | Períodos → mes de presentación |
|---|---|
| Retención en la fuente (mensual) | cada mes → mes siguiente |
| IVA bimestral | ene-feb→Mar · mar-abr→May · may-jun→Jul · jul-ago→Sep · sep-oct→Nov · nov-dic→Ene 2027 |
| IVA cuatrimestral | ene-abr→May · may-ago→Sep · sep-dic→Ene 2027 |
| Impuesto al consumo (bimestral) | mismas fechas que IVA bimestral |
| Anticipo RST (bimestral) | ene-feb→**May** · mar-abr→**Jun** · may-jun→**Jul** · jul-ago→Sep · sep-oct→Nov · nov-dic→Ene 2027 |

> Particularidad RST: los **3 primeros bimestres** se presentan en **mayo, junio y
> julio**; de ahí en adelante, cada dos meses.

**Renta** (Persona Jurídica, Persona Natural, Grandes Contribuyentes) y
**consolidadas RST** usan otra mecánica (**rangos de dos dígitos** del NIT y
cuotas) → se manejan con **fechas fijas** del calendario, no por la regla.

## Datos cargados

- **Calendario 2026**: [`data/calendario-tributario-2026.csv`](./data/calendario-tributario-2026.csv)
  — 330 vencimientos (Retención, IVA bimestral/cuatrimestral, Consumo, Anticipo
  RST). **Pendiente**: Renta y consolidadas (fechas fijas de 2 dígitos).
- **Municipios de Colombia**: 1102 (municipio + departamento) → catálogo
  `Municipio` (pendiente el seed de carga).

## ICA municipal 2026 — carga en producción (agosto 2026)

**Generación de ICA municipal (ago 2026).** El botón **Regenerar vencimientos**
(`POST /vencimientos/regenerar/:empresaId`) ya genera el ICA municipal, además de
lo nacional: por cada municipio marcado en Config. tributaria cruza lo que aplica
(ICA / ReteICA / AutoICA) con `calendario-ica-municipal-2026.csv` (embebido en
`apps/api/src/vencimientos/calendario-2026.ts`) y el último dígito del NIT.

- **Solo genera lo marcado.** Si una obligación marcada no tiene fecha en el
  calendario para ese municipio (p. ej. San Martín/Meta, que quedó por dígito de
  NIT sin tabla), **no inventa**: lo reporta como *sin calendario* para avisar.
- **Fecha de inscripción por municipio** (`EmpresaMunicipioIca.fechaInscripcion`,
  opcional): si está, solo se generan los vencimientos con fecha **en/después** de
  ella. Acota "de aquí en adelante" sin afectar lo ya cargado.
- **Preserva lo demás.** Nunca borra vencimientos con pago/estado/notas/soporte,
  ni las entradas manuales (`generado=false`), ni obligaciones que el generador no
  administra (p. ej. **Exógena de ICA**): solo da de baja las obligaciones de su
  propio conjunto (`OBLIGACIONES_NACIONALES` / `OBLIGACIONES_ICA`) que la config
  ya no contempla.
- **Cruce de municipios:** normaliza nombre + departamento y quita el sufijo de
  inicial del departamento del calendario ("San Martín M" en Meta → "San Martín").
  Además indexa la capital **con y sin el "D.C."**: el calendario oficial escribe
  "Bogotá, D.C." y hubo catálogos con "Bogotá" a secas — normalizados quedan
  `bogota d c` y `bogota`, dos claves distintas. Con eso el ReteICA bimestral de
  Bogotá **estaba en el calendario y aun así no se generaba**, sin error visible:
  se marcaba el municipio, se regeneraba y no salía nada, con toda la pinta de
  "falta cargar el calendario". El catálogo semilla (`prisma/seed.ts`) quedó
  además escrito como el oficial, para no volver a crear dos Bogotás.

**Fuente.** Los calendarios municipales los **transcribió el equipo** (Paola)
municipio por municipio a una plantilla de Excel. Los PDF municipales varían
mucho: unos publican **fecha fija** para todos, otros dependen del **último
dígito del NIT**, y varios solo existen **escaneados**.

**Qué se cargó (338 vencimientos):**

| Obligación | Vencimientos |
|---|---|
| ReteICA / AutoICA | 276 |
| ICA Yopal (bimestral) | 12 |
| Exógena de ICA | 50 |

**Reglas por municipio** → [`data/calendario-ica-municipal-2026.csv`](./data/calendario-ica-municipal-2026.csv)
(incluye las tablas por dígito de Villavicencio y Villanueva). Resumen:

- **Por dígito del NIT** (el día depende del último dígito): Villavicencio,
  Villanueva (Casanare), Tauramena, San Martín (Meta), Granada (Meta),
  Puerto Wilches.
- **Fecha fija** (una sola fecha para todos): el resto — Cartagena (calendario
  oficial), Bogotá, Acacías, Pasto, Puerto Gaitán, Puerto López, Mosquera,
  Madrid, Malambo, Castilla, San Carlos de Guaroa, Sabana de Torres, etc.

**Correcciones aplicadas al cargar** (la transcripción traía el año equivocado en
enero):

- Cabuyaro nov-dic: `2026-01-15` → **`2027-01-15`**.
- Puerto López dic: `2026-01-22` → **`2027-01-22`**.

**Yopal** tiene **dos** obligaciones distintas, ambas para sus **4** empresas:
**ReteICA** (25-sep / 20-nov / 12-feb-2027) e **ICA** bimestral
(02-oct / 04-dic / 19-feb-2027).

**Mantenimiento de fechas.** El **Administrador / root** puede **editar la fecha**
de cualquier vencimiento directamente en `cerpat.io/vencimientos` (columna
*Vence*), sin recargar la base — el backend ya validaba `PATCH
/vencimientos/:id`. Útil para ajustar fechas tentativas o cuando un municipio
publica su calendario definitivo. Para la **próxima temporada**, revisar sobre
todo los municipios de **fecha fija** cuyo PDF venía escaneado (p. ej. el grupo
Aguazul · Barranca de Upía · Guamal · Yopal comparte `25-sep / 20-nov`).

## Estados de un vencimiento

Cada vencimiento (`VencimientoEmpresa.estado`, enum `EstadoPago`) tiene uno de
**6 estados**. El Administrador los cambia en línea en `cerpat.io/vencimientos`.

| Estado | Significado | ¿Cuenta como presentado? |
|---|---|---|
| `pendiente` | Aún no se presenta (si ya pasó la fecha, sale como **vencido**) | No |
| `presentado_sin_pago` | Declaración presentada, falta el pago | Sí |
| `presentado_pagado` | Presentada y pagada | Sí |
| `presentado_cero` | Presentada en **$0** (sin valor a pagar) | Sí |
| `no_presentado` | Venció y no se presentó | No |
| `no_obligado` | El cliente **no está obligado** a esa declaración | — (se excluye de KPIs) |

> `no_obligado` no es una obligación real: no suma en *total*, *presentados*,
> *pendientes* ni *vencidos*. Sirve para dejar constancia de que esa fila no aplica
> sin borrarla.

## Modelo de datos

### Ya existe
- Catálogos: `RegimenTributario`, `PeriodicidadIva`, `Municipio` (con
  departamento), `TipoObligacion`.
- `Empresa`: `nit`, `regimenId`, `periodicidadIvaId`, `municipioId` (**un solo**
  municipio — limitación).
- `Vencimiento` (calendario) + editor en Administración → Vencimientos.
- `Pago`: registros individuales de obligación por empresa.

### Falta (cambios de esquema → aplicar con `db push`)
1. **Multi-municipio por empresa** (ICA/RETEICA): hoy `Empresa.municipioId` es
   único; una empresa puede declarar ICA en muchos municipios con distinta
   periodicidad.
2. **`ResponsabilidadEmpresa`**: *empresa × obligación × periodicidad × municipio
   (opcional)* — la parametrización de cada cliente.
3. Cargar **periodicidad de IVA** y **municipios** de los clientes (no venían en
   el CSV original).

## Configuración por cliente (captura)

Se captura con una **plantilla de Excel** (entregada al equipo) con dos hojas:
- **Empresas**: una fila por cliente (75 activos pre-cargados con NIT, nombre y
  régimen). Se llena: régimen, periodicidad de IVA, retención en la fuente (Sí/No),
  impuesto al consumo, renta.
- **ICA por municipio**: una fila por cada municipio en que el cliente declara ICA
  (NIT, municipio, periodicidad ICA, RETEICA Sí/No).

Los desplegables validan las opciones; los 1102 municipios están en una hoja de
referencia.

## Próximos pasos

1. El equipo devuelve la plantilla diligenciada.
2. Seed de **municipios** al catálogo.
3. **Modelo**: `ResponsabilidadEmpresa` + multi-municipio (esquema + `db push`).
4. **Cargador** del calendario (desde el CSV) y de las responsabilidades (desde la
   plantilla).
5. **Generador** de vencimientos del año → alimenta calendario / Mi Día / pagos.
6. Completar el calendario con **Renta + consolidadas** (fechas fijas).
7. **ICA municipal**: calendarios por municipio (fase posterior, es lo más
   disperso).
