# Reglas de negocio — Planeador CERPAT

> **Estas reglas ya fueron validadas con el equipo en el prototipo — no
> reinterpretar.** El detalle canónico (con fórmulas) está en
> [`../CONTEXTO-PARA-CLAUDE-CODE.md`](../CONTEXTO-PARA-CLAUDE-CODE.md) §4 y §5.
> Todas se implementan **del lado del servidor** (`apps/api`); el frontend puede
> duplicarlas para dar feedback inmediato, pero la fuente de verdad es la API.

## Reglas validadas

1. **Subtareas pendientes bloquean el cierre.** No se puede marcar una tarea
   como `terminado` o `auditado` si tiene alguna subtarea en estado `pendiente`.
2. **Soporte obligatorio.** Si `requiereSoporte = true`, no se puede guardar la
   tarea sin un `soporteLink` no vacío.
3. **Bloqueo tras auditoría.** Si `auditoria = 'aprobada'`, la tarea queda
   bloqueada para edición; solo se desbloquea desde la vista de Auditoría, y ese
   desbloqueo debe registrarse en un log (quién y cuándo).
4. **Asignación automática.** Si una tarea nueva no tiene responsable asignado,
   se asigna automáticamente a quien la crea (nunca queda sin asignar).
5. **"Mi Día".** Muestra solo tareas con `fechaVencimiento = hoy` **y** donde el
   usuario actual está en `TareaAsignado`; no incluye vencidas de días previos.
6. **Interés de mora (DIAN, Art. 635 E.T.)** — solo si `estado != 'presentado_pagado'`
   y `fechaVencimiento < hoy`. Método replicado del liquidador oficial del equipo
   (`apps/api/src/vencimientos/tasas-mora.ts`):
   - `diasMora = fechaCorte − fechaVencimiento` (días calendario; en Pagos, `fechaCorte = hoy`).
   - `tasaAnual = tasa de mora del MES de la fecha de pago` (tabla mensual DIAN/Superfinanciera).
   - `interes = valor × (tasaAnual / 365) × diasMora`, **redondeado hacia arriba** al múltiplo de 1.000.
   - Interés **simple**: la tasa vigente al pago se aplica a todo el período. Se recalcula a diario.
   - Se muestra por obligación, con **Total a pagar hoy** (capital + interés) por
     fila y como KPI, en Pagos. Los valores (**tasa de mora, UVT, sanción mínima,
     % sanción**) los edita el Administrador en **Administración → Parámetros**
     (modelo `ParametrosLiquidacion`); el liquidador los lee y, si faltan, usa los
     valores embebidos. **UVT 2026 = $52.374.**
   - **Retención en la fuente DIAN < 10 UVT:** el plazo de pago antes de ineficacia
     es **1 año** en vez de 2 meses (solo retención en la fuente DIAN, no
     autorretención ni ReteICA). `limitePago(fecha, obligacion, valor)`.
   - **Sanción por extemporaneidad** (Art. 641 E.T.): `5% × impuesto × meses o
     fracción de mora`, con **tope del 100%** del impuesto y **mínimo la sanción
     mínima (10 UVT)**. Aplica a las **no presentadas** y a las **presentadas que
     quedaron INEFICACES** (retención/autorretención/ReteICA que pasaron su límite
     de pago); no a las pagadas ni a lo que solo causa intereses. Se muestra por
     obligación y como KPI **Sanción (est.)**; el **Total a pagar** = capital +
     interés + sanción.
7. **Vista de Pagos.** No mostrar obligaciones futuras (`fechaVencimiento > hoy`)
   salvo que `estadoTarea = 'terminado'`, ya estén vencidas o ya estén pagadas.
8. **Impresión modo "Cliente".** Excluir siempre las tareas con `interno = true`.
9. **Etiquetas dinámicas.** Se puede crear una etiqueta al vuelo desde el
   formulario de tarea; queda disponible en el catálogo para reutilizarse.
10. **Fecha límite de presentación vs. fecha límite de pago.** Las fechas que
    carga el sistema (`fechaVencimiento`) son el **límite de presentación**.
    Desde el día siguiente corren **intereses de mora** en todas las
    obligaciones sin pagar. Además, algunas tienen un **límite de pago**
    (= presentación + N meses calendario) tras el cual la consecuencia ya no es
    solo intereses:
    - **Retención en la fuente, Autorretención y ReteICA:** **+2 meses** → la
      declaración queda **INEFICAZ** (para la DIAN es como no haberla presentado;
      Art. 580-1 E.T.). Hay que volver a presentar y pagar.
    - **Anticipo bimestral del RST:** **+1 mes** → **riesgo de exclusión del
      RST**. Es una **alarma, no una sanción**.
    - **Resto** (IVA, Renta, Consumo, etc.): solo intereses hasta que se pague.

    El catálogo y el cálculo viven en el backend
    (`apps/api/src/vencimientos/reglas-pago.ts`); los feeds `GET /plan/pagos` y
    `GET /vencimientos/pagos` devuelven `fechaLimitePago` y `consecuencia`
    (`intereses | ineficaz | exclusion_rst`) por obligación. La vista de Pagos
    los usa para el semáforo de "límite de pago", el KPI **Riesgo ineficacia/RST**
    y el filtro respectivo.
11. **Generación de vencimientos (nacional + ICA municipal).** El botón
    **Regenerar vencimientos** (`POST /vencimientos/regenerar/:empresaId`) rehace
    los vencimientos del cliente cruzando su Config. tributaria con el calendario
    2026 y el último dígito del NIT:
    - **ICA municipal:** genera **solo lo marcado** por municipio (ICA / ReteICA /
      AutoICA) contra `calendario-ica-municipal-2026.csv`. Si un municipio/obligación
      marcada no tiene fecha en el calendario, **no inventa**: lo devuelve en
      `sinCalendario` para avisar en la UI.
    - **Fecha de inscripción por municipio** (opcional): si está, solo se generan
      los vencimientos de ICA con fecha **en/después** de ella. Acota "de aquí en
      adelante" sin afectar lo ya cargado.
    - **Nunca destruye trabajo:** preserva los vencimientos con pago, estado,
      notas o soporte; las entradas manuales (`generado=false`); y las obligaciones
      que el generador **no** administra (p. ej. Exógena de ICA). Solo da de baja
      las obligaciones de su propio conjunto que la config ya no contempla.
    - **Obligaciones de solo presentación (no generan pago):** **nómina
      electrónica** (10º día hábil del mes siguiente) y **seguridad social / PILA**
      (día hábil según los 2 últimos dígitos del NIT). Son mensuales, se marcan por
      cliente y **no entran al ciclo de Pagos** (`OBLIGACIONES_SIN_PAGO`): nunca
      causan interés ni sanción; solo seguimiento de presentación.
    - **Checklist y responsable en el vencimiento (unificación plan↔vencimientos):**
      cada actividad del plan puede **vincularse a un vencimiento** desde
      Administración → Actividades (`ActividadPlan.obligacionVencimiento`, clave
      estable de `vinculos.ts`, independiente del código). Al **generar/regenerar**
      un vencimiento, si su obligación está vinculada, hereda el **checklist**
      (copia de las `SubtareaPlantilla` de esa actividad → `SubtareaVencimiento`) y
      el **responsable** (asesor/auxiliar de la asignación cliente×área de la
      actividad). El asesor marca el checklist (**chulo**) desde el **calendario**.
      Se copia al **crear** el vencimiento y, al **regenerar**, también se
      **rellena** en los vencimientos **existentes** vinculados que aún no tengan
      checklist/responsable (sin sobrescribir chulos ni un responsable ya
      asignado). Objetivo: la declaración se controla en Vencimientos (con su
      checklist y avance) y no se duplica como tarea del plan.
    - **No se duplica la declaración como tarea del plan:** ni el sembrador
      (`prisma/plan-generar.ts`) ni el botón **Generar por cliente**
      (`POST /admin/plan-cliente/:empresaId/generar`) crean tarea para las
      actividades vinculadas a un vencimiento (`obligacionVencimiento != null`);
      esas se controlan en Vencimientos. Además, ese botón **limpia** las
      tareas-duplicado **vacías** ya generadas de ese cliente (estado
      `por_iniciar`, auditoría `pendiente`, sin subtareas realizadas ni
      comprobantes/registros) y conserva las que tengan avance. Para una limpieza
      masiva de todos los clientes: `prisma/plan-limpiar-duplicados.ts` (dry-run
      por defecto; `--apply` para borrar).
    - **Avance por área incluye los vencimientos vinculados:** el panel de
      Coordinación (`/plan/cumplimiento`) suma, además de las tareas del plan, los
      **vencimientos del período vinculados a una actividad**, atribuidos al área
      de esa actividad y a su responsable. Un vencimiento **presentado** cuenta
      como **ejecutado**; **no presentado** o vencido, como **vencido**. Así el
      área (p. ej. Impuestos) refleja su avance real aunque la declaración no sea
      una tarea del plan.
    - **RUB (Registro Único de Beneficiarios):** obligación de **solo presentación
      (no genera pago)**, **trimestral**, con **fechas fijas nacionales** (iguales
      para todos, **no dependen del NIT**). En 2026: **2-feb, 4-may, 3-ago y
      3-nov**. Como las demás de solo presentación, entra en `OBLIGACIONES_SIN_PAGO`.
      Fechas parametrizadas por año en `RUB_FECHAS`.
      **A quién le aplica: depende de la NATURALEZA JURÍDICA del cliente**, es decir
      del **tipo de empresa** — no de cómo declara renta. Están obligadas las
      **personas jurídicas**, los **consorcios y uniones temporales** y las
      **sucursales extranjeras**; las **personas naturales no**. Si el cliente no
      tiene tipo definido, **no se genera**: no se inventa una obligación.
      Se aplica automáticamente, sin marcar cliente por cliente. Regla única en
      `aplicaRub()` (`apps/api/src/vencimientos/generador.ts`), que también importa
      el sembrador masivo.
      > **Por qué está escrito así.** Hasta ago-2026 se derivaba de
      > `rentaTipo ∈ {persona_juridica, gran_contribuyente, rst_consolidada}`. Eso
      > tenía un efecto silencioso: una persona jurídica con la casilla de *Renta*
      > en **"No aplica"** —opción legítima— quedaba fuera del objetivo del
      > generador, y **al regenerar sus vencimientos de RUB se borraban**. Pasó en
      > producción con tres clientes. Una obligación no puede colgar de un campo
      > que responde a otra pregunta.

### Regenerar vencimientos: qué borra y qué conserva

**Regenerar** rehace los vencimientos de un cliente según su configuración actual.
Es la herramienta de mantenimiento, pero **da de baja** lo que la configuración ya
no contempla — por eso una casilla mal puesta puede llevarse obligaciones reales.

- **Conserva siempre:** los vencimientos con trabajo (estado distinto de pendiente,
  valor, notas o soporte), las entradas manuales (`generado=false`) y las
  obligaciones que el generador no administra (p. ej. Exógena de ICA).
- **Da de baja:** lo generado, sin trabajo, que ya no está en el objetivo.
- **Antes de aplicar, simula** y muestra qué se va a eliminar y cuánto. El resumen
  posterior también lo lista.
- Para **solo agregar** sin riesgo de baja —p. ej. aplicar un checklist nuevo a lo
  ya cargado— está *Administración → Checklist vencimientos*, que nunca borra.

## Responsables por área: quién puede ir en cada casilla

De la **asignación cliente × área** heredan asesor y auxiliar **todas** las tareas del
plan y los vencimientos vinculados. Poner a alguien en la casilla equivocada no falla al
guardar: falla semanas después, cuando a esa persona le aparece en su lista trabajo que
no le corresponde.

- La casilla **Asesor** espera a alguien con rol **Asesor** (o Coordinador /
  Administrador). La casilla **Auxiliar** acepta además el rol **Auxiliar**.
- **No se bloquea.** A veces un asesor cubre como auxiliar, y prohibirlo obligaría a
  pelear con la herramienta. Los desplegables separan en dos grupos —los del rol
  esperado y *"Otros (revisar)"*— y **avisan** cuando la persona elegida no es de las
  esperadas.
- *Administración → Plan por cliente* muestra arriba un **diagnóstico** con todas las
  asignaciones mal puestas de la firma, porque buscarlas a mano entre noventa clientes
  por varias áreas es, en la práctica, no buscarlas. Reporta solo lo inequívoco:
  1. alguien como **asesor** sin ningún rol que lo habilite;
  2. alguien como **auxiliar** sin ningún rol que ejecute trabajo;
  3. **la misma persona como asesor y auxiliar** de la misma área — se estaría liberando
     el insumo a sí misma, que rompe el circuito de captura y liberación.
- **Corregir la asignación no reasigna lo ya generado:** las tareas nacen con el asesor y
  el auxiliar que tenía la asignación *en ese momento*. Para ponerlas al día está
  *Plan por cliente → **Aplicar los responsables a un período ya generado***, que
  actualiza tareas **y** vencimientos del período (con simulación previa). **No toca las
  terminadas ni las auditadas**: cambiarles el responsable falsearía quién hizo un
  trabajo que ya se hizo.

**Alcance por defecto: cerrado.** `esStaffAcotado` decide por lo que el usuario **no**
tiene: se acota a todo usuario interno **salvo** Administrador, Coordinador, Auditor y
root. Antes terminaba en `roles.some(['Asesor','Auxiliar'])` y fallaba **abierto** — un
Revisor, alguien con el rol mal puesto o un usuario recién creado sin roles pasaban por
"no acotado" y veían la cartera completa de la firma. El peor caso debe ser *no ver lo
que sí corresponde* —que se reclama el mismo día— y no al revés.

## "No aplica" en los checklists

Un punto del checklist puede quedar en **`no_aplica`**, y **sale del denominador** de la
medición. El porqué es de negocio: una empresa **sin movimiento** en el mes puede tener
que hacer 2 de 13 puntos, y otra con operación los 13. Si los 11 que no aplican cuentan
en el total, la primera aparece siempre en 2/13 —incumpliendo— cuando en realidad
terminó su trabajo.

- El control **gira con un clic**: pendiente → hecha → no aplica → pendiente. Un solo
  control en vez de tres botones por línea: con trece puntos, treinta y nueve controles
  en un modal no se leen. Marcar hecho —el caso de todos los días— sigue siendo un clic.
- **`no_realizada` NO sale del denominador.** Ahí había que hacerlo y no se hizo;
  sacarlo sería premiar el incumplimiento.
- Un checklist **enteramente** "no aplica" cuenta como **completo**, no como 0 %.
- La cuenta vive en `apps/web/lib/checklist.ts` con pruebas. Es una sola porque la usan
  el calendario, Mi Día y la cola de revisión: tres copias darían tres números para el
  mismo checklist.
- En la **cola de revisión** los puntos marcados "no aplica" se señalan: validar que de
  verdad no aplicaban es parte de lo que el revisor debe mirar antes de aprobar.

## Tipos de documento de la captura

Los tipos que el auxiliar elige al registrar un lote (Egresos, Facturas de compra, …)
son un **catálogo administrable**: *Administración → Tipos de documento*, junto a los
demás catálogos.

- **La lista es cerrada.** Antes el campo era de texto libre con sugerencias escritas en
  el código: no se podía agregar un tipo sin desplegar, y entraban `Egresos`, `egresos` y
  `Egreso` como si fueran cosas distintas — con lo cual **cualquier medición por tipo de
  documento quedaba inservible**. Si falta uno, la coordinación lo crea en segundos y
  aparece de inmediato, sin desplegar nada.
- La migración **siembra los siete tipos originales** y, además, **todos los que ya se
  hubieran capturado** con el campo abierto: si el desplegable no los ofreciera, lo ya
  registrado no se podría volver a repetir.

**Prefijo del consecutivo.** Va en su **propio campo**, no dentro de *Desde*/*Hasta*: se
escribe una vez en lugar de dos, *Desde* y *Hasta* quedan numéricos —así la cantidad se
sigue calculando sola— y el dato queda estructurado para poder agrupar por prefijo más
adelante.

**Ver y eliminar lotes.** En *Mi Día → Captura del día*, el número de la columna
**Lotes** se abre y muestra el detalle (fecha, tipo, consecutivo desde–hasta, cantidad).
Antes ese número era un dato muerto: decía "4" y no había forma de saber cuáles, así que
corregir un error era adivinar. **El botón de eliminar se le muestra solo a la
coordinación**; el backend además se lo permite al asesor/auxiliar de la tarea, para que
puedan deshacer su propio error de digitación.

## Obligaciones de solo presentación

Algunas obligaciones **no tienen saldo**: son un reporte, no una declaración con valor.
En ellas **no se ofrece la casilla de valor a pagar**, porque ofrecerla invita a
registrar un pago que no existe — y ese valor terminaría en *Pagos* y en los
indicadores.

- **Los estados quedan completos**, como en cualquier otra obligación: se decidió tocar
  solo la casilla de valor. Bajo el selector aparece una línea aclarando que la
  obligación no lleva pago.
- **El backend también lo rechaza** (`PATCH /vencimientos/:id`), no solo la pantalla: un
  valor enviado a mano o por una pantalla desactualizada no entra.
- **Cuáles son** (`obligacionSinPago`, con pruebas): nómina electrónica, seguridad social
  (PILA), RUB, y **toda la información exógena**. Las exógenas se reconocen por el
  nombre, no por una lista fija, porque se agregan a mano y su nombre es texto libre
  ("Exógena municipal (medios magnéticos)", "Exógena de ICA", …): enumerarlas dejaría
  fuera la del municipio que se cargue mañana.

## Recepción del insumo del cliente

En las áreas marcadas **insumo del cliente** (`AsignacionClienteArea.insumoCliente`)
no hay auxiliar que capture ni que libere: el insumo lo manda el cliente. Por eso
quedan fuera de la liberación automática — y hasta que existió esta marca, eso
significaba que **nada las destrababa nunca**.

**Quién marca:** el **asesor o el auxiliar** del área (y coordinación). Cualquiera que
reciba. Restringirlo solo al asesor haría que el trabajo se acumule esperando a que
él entre a marcar algo que su auxiliar ya tiene en las manos.

**Dónde:** *Mi Día → Esperando al cliente*. Va ahí porque es donde el asesor ya está
todas las mañanas y porque esa marca destraba **su propio** trabajo. Enterrada en otra
pantalla no se marcaría, y una marca que no se marca no mide nada.

**La fecha es la de ENTREGA, no la de hoy.** El cliente manda el 3 y el asesor marca
el 5; grabar "hoy" le cargaría al cliente dos días de demora que no son suyos — y esa
es justo la cifra que se le va a mostrar en una reunión. Se sugiere hoy, se puede
cambiar, y no se aceptan fechas futuras.

**Es binaria** — "ya tengo lo que necesito para trabajar" — a sabiendas de que en la
práctica los documentos llegan en tandas. Un seguimiento parcial que nadie llena
termina peor que uno binario que sí se usa.

**Se puede deshacer.** Alguien va a marcar el cliente equivocado. Deshacer solo afecta
las entregas con `origen = 'cliente'`: nunca toca una liberación del auxiliar.

**El rastro (`EventoInsumo`)** guarda marcas y desmarcas con fecha, usuario y la fecha
de entrega declarada. **No tiene llave foránea a `EntregaInsumo`** a propósito:
desmarcar borra esa fila, y un rastro que desaparece junto con lo que quería auditar
no sirve de nada.

**El subproducto es el valor real:** *Coordinación → Insumo del cliente* lista los
clientes que **no han entregado**, con el área, el asesor y los días que llevan,
ordenados por el que más se demora. Va antes de "clientes en riesgo" porque explica
parte de ese riesgo: un cliente que no entregó no es un incumplimiento de la firma.

## Circuito de revisión de impuestos

El área de Impuestos **no trabaja sobre tareas del plan**: trabaja sobre el
**vencimiento mismo**. Las actividades del catálogo vinculadas a una obligación
(`ActividadPlan.obligacionVencimiento`) no generan tarea a propósito — duplicarlas
daría dos objetos para un mismo trabajo, cada uno con su estado, y tarde o temprano
el calendario diría una cosa y Mi Día otra.

Por eso el asesor de impuestos trabaja desde **Mi Día → Mis impuestos**: el chulo que
marca, el valor que digita y el estado que pone son los de esa obligación, así que
**el calendario y Pagos se actualizan solos**. El calendario sigue siendo, como se
acordó, únicamente vencimientos.

**Dos estados que no se mezclan.** `VencimientoEmpresa.estado` (`EstadoPago`) es lo que
pasó **ante la DIAN** y es lo que muestra el calendario. `estadoRevision`
(`EstadoRevisionVenc`) es en qué punto va el trabajo **dentro de la firma**. Un impuesto
puede estar aprobado por el revisor y todavía pendiente de presentar.

| Estado interno | Quién actúa | Qué significa |
|---|---|---|
| `sin_iniciar` | — | El asesor aún no lo abre |
| `en_proceso` | Asesor | Lo está liquidando |
| `en_revision` | Revisor | En la cola compartida; el asesor no lo edita |
| `devuelto` | Asesor | Volvió con observación (obligatoria) |
| `aprobado` | Asesor | Ya puede presentarlo |

Reglas, todas verificadas en el backend (`apps/api/src/vencimientos/revision.ts`, con
pruebas en `revision.test.ts`):

- **Nadie aprueba su propio trabajo.** Si quien revisa es además el asesor de ese
  vencimiento, actúa como asesor aunque cargue el rol de Revisor.
- **Devolver exige decir qué corregir.** Sin la observación, la devolución no informa
  nada y genera una llamada.
- **Presentar exige la aprobación del revisor.** Sin esta regla la revisión sería
  decorativa. La **coordinación puede saltársela** —un revisor enfermo el día del
  vencimiento no puede impedir presentar— y queda registrado con su nombre.
- **Reabrir lo aprobado es solo de coordinación.** Si el asesor pudiera reabrir lo
  suyo, la aprobación sería una formalidad.
- **La fecha legal de vencimiento solo la mueve el Administrador.**

**Cola compartida, sin reparto.** Los revisores ven lo mismo y toman por orden de
llegada (`enviadoRevisionEn`). No hay asignación fija por cliente ni por mes: así
trabaja la firma hoy. Quién revisó qué queda igual en el rastro, así que los
indicadores por revisor no dependen de repartir la cola.

**El rastro (`EventoVencimiento`).** Cada paso queda con fecha, tipo y responsable. Los
campos del vencimiento guardan solo el estado actual —una segunda devolución pisa la
observación de la primera—, así que el rastro es lo que hace medibles las preguntas
reales: cuánto tarda un revisor en devolver, cuántas vueltas da un mismo impuesto, y
**cuántos días antes del vencimiento se presentó** (`fechaPresentacion`, que existe
porque `updatedAt` lo pisa cualquier edición posterior).

**Alcance de "Mis impuestos": dos filtros, no uno.** `VencimientoEmpresa.asesorId` dice
de quién es la obligación, pero se **hereda al generarse** y se queda con quien tenía la
asignación entonces. Si después cambia, ese dato queda viejo y le muestra a alguien
clientes que ya no son suyos. Por eso encima va la misma regla que el resto de la
aplicación —**solo las empresas asignadas hoy**—, que es la fuente de verdad de a quién
pertenece un cliente. Para corregir el dato viejo está *Plan por cliente → Aplicar los
responsables a un período ya generado*, que también actualiza vencimientos.

**El mes del calendario se toma de la fecha, no de la columna `anio`.**
`VencimientoEmpresa.anio` es el año del **período**, no el del vencimiento, y hay
obligaciones que vencen al año siguiente: FOPAT, nómina electrónica y PILA del período
de **diciembre** vencen en **enero**. El calendario pide un mes y se resuelve como
ventana de fechas `[1 del mes, 1 del mes siguiente)`; antes se comparaba solo el número
del mes dentro del año pedido y ese FOPAT de enero se pintaba **un año antes** de su
fecha real y no aparecía en el enero que le correspondía.

**Ventana de tiempo.** "Mis impuestos" llega **hasta el fin del mes en curso**, y el corte
es **solo por arriba**: lo vencido de meses anteriores sigue apareciendo, marcado. Esconderlo
al pasar de mes sería la peor forma de ordenar la vista — una retención de julio sin
presentar no deja de existir el 1 de agosto, y al desaparecer de la pantalla nadie la
vuelve a mirar. Como la ventana se calcula contra el calendario, **septiembre se habilita
solo**: no hay nada que activar al terminar agosto. El mes es editable para mirar hacia
adelante.

**Liberación del insumo.** El asesor ve marcado qué está liberado y qué espera al
auxiliar. Solo las obligaciones **mensuales** (período `YYYY-MM`) se emparejan con la
entrega del auxiliar; las trimestrales y anuales (`"1er trimestre"`, `"declaración y
pago"`) no cuelgan de un cierre mensual y se dan por disponibles. **Nada se oculta**:
esperando insumo se muestra igual, porque trabajo invisible que después aparece vencido
es la peor forma de fallar.

## Obligaciones que se derivan de las cifras del cliente

Seis obligaciones no se marcan a mano: **se calculan** con los activos brutos y
los ingresos brutos del cliente. Todas las normas comparan contra el **"año
inmediatamente anterior"**, así que para evaluar 2026 se usan las cifras de 2025
medidas con la **UVT y el SMMLV de 2025** — no con los del año en curso.

Por eso `ParametroAnual` guarda UVT y SMMLV **por año**. Con un solo valor
vigente, cada enero todos estos cálculos quedarían mal sin que nadie se entere.
**Si falta el año que una regla necesita, la regla no calcula: informa que falta
el dato.** Nunca supone un valor.

| Obligación | Umbral | Unidad | A quién |
|---|---|---|---|
| Firma de contador — Art. 606 E.T. | activos **o** ingresos **> 100.000** | UVT | obligados a llevar contabilidad |
| Revisor fiscal — Ley 43/1990 art. 13 §2 | activos **≥ 5.000** y/o ingresos **≥ 3.000** | SMMLV | solo sociedades comerciales |
| PN agente de retención — Art. 368-2 E.T. | patrimonio **o** ingresos **> 30.000** | UVT | solo personas naturales comerciantes |
| IVA bimestral — Art. 600 E.T. | ingresos **≥ 92.000** | UVT | todos (además, grandes contribuyentes y arts. 477/481 son bimestrales sin importar el monto) |
| Conciliación fiscal — Dto. 1998/2017 | ingresos **≥ 45.000** | UVT | exentos por debajo |
| Puede estar en RST — Art. 905 E.T. | ingresos **< 100.000** | UVT | sin tope reducido por actividad |

Valores vigentes (confirmados por la gerencia, ago-2026, y contrastados con la
norma que los fija):

| Año | UVT | SMMLV | Norma |
|---|---|---|---|
| 2024 | $47.065 | $1.300.000 | Res. DIAN 187/2023 · Dto. 2292/2023 |
| 2025 | $49.799 | $1.423.500 | Res. DIAN 193/2024 · Dto. 1572/2024 |
| 2026 | $52.374 | $1.750.905 | Res. DIAN 238/2025 · Dto. 1469/2025 |

El **SMMLV 2026 subió 23%** ($327.405 sobre 2025). Es un salto atípico y conviene
tenerlo presente: mueve los topes de revisor fiscal (5.000 y 3.000 SMMLV) mucho
más que el ajuste de la UVT (5,18%), así que clientes que en 2025 estaban
obligados pueden dejar de estarlo al medirse contra cifras de 2026.

Notas de criterio, confirmadas con el equipo:
- **Activos brutos = patrimonio bruto** para estos efectos.
- El **tope del RST es 100.000 UVT parejo**; no se aplica tope reducido para
  actividades profesionales.
- El tope del RST es condición **necesaria, no suficiente**: quedan los demás
  requisitos del art. 906.

**El sistema señala, no corrige.** Cuando lo calculado difiere de la
configuración tributaria del cliente (periodicidad de IVA, retención en la
fuente, RST), se marca la diferencia y la decide una persona. Cambiar la
parametrización sola sería peor que el error que intenta evitar.

Regla en `apps/api/src/fiscal/reglas.ts` — módulo puro, con un test por norma que
fija el comportamiento **justo por encima y por debajo** de cada tope (las normas
alternan entre "superiores a" e "iguales o superiores a", y esa diferencia decide
casos reales).

## Novedades del día (con plan de acción obligatorio)

Los auxiliares y asesores reportan a diario lo que les impidió trabajar: se cayó el
internet, no dio acceso el sistema, el equipo estaba lento. Hasta ahora eso se contaba
de palabra — "el internet nos tiene mal" era una opinión que no se podía llevar a una
cotización. Las novedades lo vuelven una cifra. Se reportan en **Mi Día → Novedades**;
la coordinación ve el consolidado de la firma en **Coordinación → Novedades del
equipo**, con la **suma de minutos por causa**.

- **No hay novedad sin plan de acción.** Es la condición con la que se abrió el
  espacio (decisión de la dirección, 11 ago 2026): reportar sin decir qué se hizo
  convierte esto en un buzón de quejas. El plan es **texto libre** —lo que se hace ante
  una caída de internet no cabe en una lista cerrada— pero **obligatorio**, y el
  backend lo exige (`POST /novedades`), no solo la pantalla.
- **El tipo es catálogo, no texto libre** (*Administración → Tipos de novedad*), por la
  misma lección de los tipos de documento: con texto libre entran `Internet`,
  `internet` e `INTERNET` como cosas distintas y la suma por causa queda inservible.
- **El tiempo se pide como dos horas (desde–hasta), no como una estimación**: una hora
  es un hecho y "como una hora" es una opinión. Los minutos los calcula y guarda el
  backend (`minutosNovedad`, con pruebas); si el fin va antes que el inicio se rechaza
  en vez de asumir que cruzó la medianoche — lo más probable es que esté mal escrito, y
  un número inventado ensucia el total con el que se decide. Las horas son opcionales:
  una novedad sin horas cuenta como evento, solo que no suma minutos.
- **Cliente y área son opcionales**: no toda novedad es de un cliente, y exigirlo
  llevaría a inventar uno para poder reportar.
- **La cierra quien la reportó o la coordinación**, y queda registrado **quién y
  cuándo** (`cerradaEn`, `cerradaPorId`): sin la fecha de cierre no se sabe cuánto
  estuvo abierta. Se puede reabrir (el problema volvió), y al reabrir se limpia el
  cierre anterior.
- **Una novedad nunca cambia el estado de una tarea.** Explica el atraso, no lo
  disculpa: si moviera estados, reportar novedades sería la forma de cerrar trabajo sin
  hacerlo.
- Alcance: **cada quien ve las suyas**; la coordinación (Administrador/Coordinador/root)
  ve todas (`GET /novedades?todas=1`). El desplegable de clientes del formulario
  respeta el alcance general (el asesor elige entre sus asignados).

## Acceso por rol al Planeador (menú y URL)

Cada ítem del menú se muestra según el rol, y el acceso se bloquea también por URL
(guarda de ruta en el Server Component). Fuente única: `apps/web/lib/acceso.ts`
(`ACCESO_RUTA` + `puedeVerRuta`) y `acceso-server.ts` (`exigirRuta`). Administrador
y root ven todo. Un usuario con varios roles ve la **unión** de lo permitido.

| Sección | Auxiliar | Asesor | Coordinador | Auditor | Revisor |
|---|---|---|---|---|---|
| Inicio, Mi Día, Calendario, Tablero, Lista | ✅ | ✅ | ✅ | ✅ | ✅ |
| Visitas | — | ✅ | ✅ | ✅ | — |
| Pagos | — | ✅ | ✅ | ✅ | — |
| Vencimientos, Auditoría, Plan de Trabajo, Flujo del cierre | — | — | ✅ | ✅ | — |
| Revisión de impuestos (cola compartida) | — | — | ✅ | — | ✅ |
| Gestión › Coordinación | — | — | ✅ | ✅ | — |
| Gestión › Administración (solo Empresas, Config. tributaria, Plan por cliente) | — | — | ✅ | — | — |
| Gestión › Usuarios (solo repartir roles) | — | — | ✅ | — | — |
| Gestión › Administración (todas las pestañas) · Clientes · Usuarios (CRUD completo) | — | — | — | — (solo Admin) | — |
| Servicios › Calculadora, Punto de equilibrio, Más herramientas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Servicios › Portal de Hallazgos | — | — | — | ✅ | — |

> **Revisor no es Auditor.** El *Revisor* valida los impuestos que el asesor liquida,
> antes de presentarlos. El *Auditor* maneja el Portal de Hallazgos y la auditoría del
> plan de trabajo. Son dos trabajos distintos y no comparten permisos: hay pruebas en
> `apps/web/lib/acceso.test.ts` que fallan si alguien los junta.

> **Usuarios en modo acotado (Coordinador).** Entra a repartir roles sin depender de que
> el Administrador esté disponible. **No** puede crear, eliminar, desactivar ni
> restablecer contraseñas, **ni otorgar el rol de Administrador** ni editar a quien ya lo
> tenga. Lo bloquean la pantalla *y* el backend (`PATCH /admin/usuarios/:id`); la
> verificación del rol Administrador se hace contra la tabla, no contra lo que manda el
> navegador.

> El menú oculta lo no permitido y las páginas redirigen a `/planeador` si se entra
> por URL sin permiso. Esto complementa (no reemplaza) la validación por rol en cada
> endpoint del backend.

**Alcance de datos para Asesor/Auxiliar (vista acotada).** Un usuario **Asesor** o
**Auxiliar** *sin* rol elevado (Administrador/Coordinador/Auditor) solo ve **lo suyo**
en las vistas internas — forzado en el backend (`esStaffAcotado`):
- **Tablero, Lista y Calendario (tareas)** → solo tareas donde es **asesor o auxiliar**.
- **Calendario (visitas)** → solo visitas donde es el **responsable**.
- **Calendario (vencimientos)** → los de sus **empresas asignadas** (Asignación cliente ×
  área, donde figura como asesor o auxiliar) **o** los que están **a su nombre**
  (`asesorId`/`auxiliarId` del vencimiento). Es una unión a propósito: el responsable
  del vencimiento se hereda al generarlo y sobrevive a que la asignación de esa empresa
  falte o cambie, así que exigir las dos cosas dejaba obligaciones que la dirección veía
  en su calendario y el asesor responsable no. La unión no abre nada ajeno — agrega
  trabajo que el sistema ya tiene registrado a nombre de quien mira.
- **Pagos** → solo vencimientos de sus **empresas asignadas**.

**Las obligaciones de SOLO PRESENTACIÓN no pasan por revisión.** El circuito de
revisión existe para que un segundo par de ojos verifique una **liquidación**
antes de presentarla. Seguridad social (PILA), nómina electrónica, RUB y las
exógenas **no liquidan nada** —no llevan valor a pagar— así que no hay cifra que
revisar: el asesor las marca como presentadas sin esperar aprobación. Exigirla no
agregaba control; dejaba a quien lleva nómina mirando su vencimiento sin poder
marcarlo el día que había que cumplirlo, y le metía a los revisores más de mil
obligaciones de trámite en una cola que existe para las declaraciones. Las que sí
liquidan (IVA, retención, renta, ICA…) siguen exigiendo la aprobación.

**Responsable de un vencimiento: cascada, no un solo camino.** Al crearse (y al
rellenar uno viejo) el responsable se resuelve así, en orden:

1. **El área de la obligación** — obligación → actividad del plan vinculada → su
   área → asignación cliente×área. Es la respuesta precisa y manda siempre que
   exista.
2. **La empresa, si tiene un solo asesor** en todas sus áreas. Es el caso
   corriente —un cliente que lleva una sola persona— y ahí no hay nada que
   adivinar. El auxiliar sigue el mismo criterio: si hay varios, va vacío.
3. **Sin dueño**, y se cuenta y se informa al regenerar.

Antes solo existía el camino 1: cuatro eslabones, y si faltaba cualquiera el
vencimiento nacía **sin responsable, en silencio** — no le aparece a nadie en
*Mi Día* y se descubre cuando ya está vencido. Pasó con FOPAT, con PILA, y se vio
de golpe al exportar los vencimientos a Excel.

Con **varios asesores** en la empresa y el área sin resolver **no se reparte a
dedo**: ahí el área es la única respuesta correcta. Un vencimiento sin dueño se ve
y se reclama; uno con el dueño equivocado se trabaja mal.

**Abonos (pagos parciales): quién los registra.** Registrar un abono lo pueden
**Administrador, Coordinador y Asesor** — son quienes hacen el seguimiento de
cartera y quienes se enteran de que el cliente abonó; tener que pedírselo a
Administración atrasaba el dato justo donde más se usa. **Eliminar** un abono
**no** se abrió: sigue siendo de Administración, porque registrar suma
información y borrar la desaparece, junto con el rastro de una plata que alguien
reportó. Auxiliar, Auditor y Revisor no registran abonos, y un cliente del portal
nunca, tenga el rol que tenga.

El permiso tiene **dos mitades**: el rol dice *si* puede abonar y el alcance
*sobre cuáles*. Para el staff acotado rige la misma regla del calendario —sus
empresas asignadas **o** lo que está a su nombre—, aplicada también **al
escribir**: sin eso, la lista se acota en pantalla pero un id en la URL alcanzaría
cualquier obligación de la firma. Y no es un campo más: un abono mueve el saldo,
el **interés de mora**, la **sanción** y, si el saldo llega a cero, el **estado**
de la obligación, que pasa a *presentado y pagado*.
- **Gestión › Clientes** → solo sus **empresas asignadas**. La cartera completa de la
  firma es información de la dirección: no hay razón para que un asesor vea los clientes
  de otro. La **descarga en Excel** del listado queda además reservada a Administración
  y Coordinación — la pantalla se consulta, la base no se la lleva nadie.
- **Lista de tareas** → el asesor **no ve la captura que ejecuta su auxiliar**. Él no
  captura: observa. Para mirar cómo va esa captura está *Mi Día*, que la muestra aparte
  y en solo lectura. Sí conserva la captura de los clientes **sin auxiliar asignado**,
  porque ahí la ejecuta él.

Coordinador, Auditor, Administrador y root ven todo. "Mi Día" siempre es del usuario.

## Seguridad (no negociable)

- Contraseñas siempre con hash (bcrypt/argon2), nunca en texto plano.
- Permisos por rol verificados en **cada** endpoint, no solo ocultando UI.
- Nunca un estado sin ningún Administrador activo: prever recuperación de acceso
  segura (por correo, no contraseñas hardcodeadas).
- Credenciales solo en variables de entorno desde el primer commit.

## Glosario de dominio

Términos del negocio (tipos de obligación, estados de tarea y de pago, roles)
se estandarizan en los enums y catálogos de
[`../prisma/schema.prisma`](../prisma/schema.prisma).
