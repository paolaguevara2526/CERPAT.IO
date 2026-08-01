# Vencimientos tributarios por cliente (parametrización + generación)

Documento vivo del módulo de **parametrización de vencimientos**: cada cliente se
configura una vez (responsabilidades) y el sistema **genera automáticamente los
vencimientos de todo el año** cruzando esa configuración con el calendario oficial.

_Estado: en diseño. Calendario 2026 cargado y validado; falta modelo + generador._

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
