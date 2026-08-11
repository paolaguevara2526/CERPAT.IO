# Instructivo — Flujo de vencimientos e impuestos

> Cómo funciona hoy, de la parametrización a la presentación y el pago.
> Actualizado: 2026-08-11. Si una regla cambia, este documento cambia con ella
> (ver `docs/reglas-de-negocio.md` para las reglas formales).

## La idea en una frase

Un impuesto se trabaja **sobre el vencimiento mismo, no sobre copias**: el
checklist que marca el asesor, el valor que digita, el link del soporte y el
estado que se elige son un solo registro, así que Mi Día, el Calendario y
Pagos siempre cuentan la misma historia.

## Quién hace qué

| Rol | Qué hace en este flujo |
|---|---|
| **Administrador / Coordinación** | Parametriza, genera/regenera vencimientos, asigna responsables y revisores; puede ejecutar cualquier acción del circuito (incluido reabrir un aprobado). |
| **Auxiliar contable** | Trabaja la captura y **libera el mes** del cliente (la señal de "el insumo está listo"). |
| **Asesor de impuestos** | Liquida desde **Mi Día → Mis impuestos**: checklist, valor, soporte, y envía a revisión. Presenta cuando está aprobado. |
| **Revisor** (rol aparte) | Toma de la **cola compartida** en *Revisión de impuestos*: aprueba o devuelve con observaciones. Nunca revisa lo propio. |

## Paso 0 · Parametrización (una vez por cliente)

1. **Configuración tributaria del cliente**: qué obligaciones tiene
   (retención, IVA, ICA por municipio, etc.) y con qué periodicidad.
   Sin configuración **no se puede regenerar** — el sistema lo dice.
2. **Calendarios**: las fechas DIAN salen del calendario por NIT; las fechas
   ICA municipales salen del calendario municipal cargado en el sistema.
   *Ojo:* un municipio nuevo o una fecha nueva requiere **despliegue** — se
   pide a soporte/desarrollo, todavía no se carga desde la aplicación.
3. **Checklist por obligación**: en el catálogo de tareas, la actividad
   vinculada a la obligación define las subtareas que nacerán con cada
   vencimiento.
4. **Responsables**: la asignación cliente–área (asesor y auxiliar) es la
   fuente de verdad de a quién le aparece el trabajo.

## Paso 1 · Generación de vencimientos (Administrador / Coordinación)

- **Regenerar vencimientos** (por cliente): borra los *pendientes* que la
  configuración ya no contempla y crea los que faltan, con su fecha legal,
  checklist y responsables del momento. Lo ya presentado no se toca.
- **Rellenar checklist** (herramienta segura): solo **agrega** checklist y
  responsables a vencimientos existentes que no los tienen. No borra nada.
  Es la opción para aplicar una parametrización nueva sin regenerar.
- Si cambian los responsables de un cliente, los vencimientos ya generados
  **conservan el responsable viejo** (dato heredado): usar "Aplicar los
  responsables" para corregirlos en bloque.

## Paso 2 · El insumo (Auxiliar)

- El auxiliar **libera el mes** cuando el insumo del cliente está completo.
  Esa liberación es del **mes de los datos**: la retención de julio espera la
  liberación de **2026-07**, aunque se liquide en agosto.
- En Mi Día del asesor eso se ve en la columna **Insumo**: `✓ listo` o
  `⏳ esperando 2026-07`. El asesor **puede adelantar** sin la liberación,
  pero el sistema le avisa que el insumo no está confirmado.
- El insumo que **envía el cliente** se marca con la **fecha real** en que
  llegó (no la fecha en que alguien lo registró), porque esa cifra mide al
  cliente, no al equipo.

## Paso 3 · El asesor liquida (Mi Día → Mis impuestos)

La ventana muestra hasta fin del **mes en curso** e incluye **todo lo vencido
de meses anteriores** (una retención sin presentar no desaparece el día 1).
Septiembre se habilita solo cuando llegue — no hay nada que activar.

En cada obligación (fila desplegable):

1. **Empezar a liquidar** → pasa a *En proceso*.
2. **Checklist**: clic para rotar `pendiente → hecha → no aplica`.
   Lo marcado *no aplica* **sale de la medición** (una empresa sin movimiento
   con 2 puntos aplicables se mide sobre 2, no sobre 13).
3. **Valor a pagar**: se digita y guarda — va directo a Pagos. Las
   obligaciones de **solo presentación** (p. ej. exógena) no piden valor.
4. **🔗 Soporte documental**: el link (Drive/OneDrive) de dónde quedó el
   trabajo. Es el **mismo campo** que se ve en el calendario, y es el link
   que abre el revisor.
5. **Enviar a revisión** → pasa a *En revisión* y entra a la cola de los
   revisores. Mientras tanto, no se edita.

## Paso 4 · Revisión (Revisores)

- Pantalla **Revisión de impuestos**: cola **compartida** — los revisores ven
  lo mismo y toman por orden de llegada. Quién revisó qué queda registrado.
- El revisor ve checklist, valor y soporte, y decide:
  - **Aprobar** → el asesor ya puede presentar.
  - **Devolver** → con **observación obligatoria**; al asesor le aparece en
    rojo qué corregir, ajusta y **vuelve a enviar**.
- Nadie aprueba su propio trabajo: si el revisor es también el asesor de esa
  obligación, para esa fila actúa como asesor.
- **Reabrir un aprobado** solo lo puede hacer Coordinación.

## Paso 5 · Presentación (Asesor, con aprobación)

- Solo con estado **Aprobado** el asesor puede marcar el estado final
  (Coordinación puede siempre). Si lo intenta antes, el sistema lo rechaza y
  le dice por qué — la revisión no es decorativa.
- Estados finales: *Presentado sin pago · Presentado y pagado · Presentado en
  $0 · No presentado · No obligado*. Es el **mismo selector** en Mi Día y en
  el calendario: actualizar en una pantalla es actualizar la otra.
- Al marcar presentado queda **fecha y quién presentó**, y la fila sale de
  Mi Día (ya no está pendiente). El calendario y los indicadores se
  actualizan solos.

## Paso 6 · Pagos

- El **valor a pagar** digitado por el asesor alimenta la vista de Pagos.
- Allí se registran **abonos** (pagos parciales); el sistema calcula el
  **saldo** y el **interés de mora a hoy sobre el saldo**.

## Reglas de oro

1. **Una sola verdad**: Mi Día, Calendario y Pagos leen y escriben el mismo
   vencimiento. No hay copias que sincronizar.
2. **El backend manda**: toda regla (aprobación del revisor, valores en
   obligaciones sin pago, fechas legales solo del Administrador) se valida en
   el servidor; la pantalla no puede saltársela.
3. **La fecha legal no se mueve** por quien trabaja la obligación — solo el
   Administrador.
4. **Los responsables heredados envejecen**: tras cambiar asignaciones,
   aplicar responsables/regenerar según el caso.
5. **Las novedades no cambian estados**: explican el atraso, no lo disculpan.
6. **Todo deja rastro**: envíos, devoluciones, aprobaciones y presentaciones
   quedan con fecha y usuario — de ahí salen los indicadores (vueltas de un
   impuesto, tiempos de revisión, días de anticipación al vencimiento).

## Preguntas frecuentes del equipo

- **"No me aparece nada en Mi Día → Mis impuestos."** Verificar: (1) que el
  usuario sea el **asesor asignado** del cliente en el área, (2) que el
  vencimiento exista (¿se regeneró el cliente?), (3) que no esté ya
  presentado.
- **"Dice esperando 2026-07 y ya liberamos agosto."** La liberación es del
  mes **de los datos**: hay que liberar julio para los impuestos de julio.
- **"No me deja marcar presentado."** Falta la aprobación del revisor:
  enviar a revisión primero.
- **"Regeneré y desapareció algo."** Regenerar borra los **pendientes** que
  la configuración ya no contempla. Revisar la configuración tributaria del
  cliente antes de regenerar; para agregar sin borrar, usar *Rellenar
  checklist*.
- **"Cambié el asesor y le sigue apareciendo al anterior."** Dato heredado:
  aplicar los responsables para actualizar lo ya generado.
