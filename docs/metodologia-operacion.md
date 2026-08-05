# Metodología de operación — Planeador CERPAT

> **Fuente de verdad de cómo opera la firma dentro del planeador.** Antes de
> construir una herramienta nueva, revisa que encaje en este modelo. Si algo aquí
> ya no refleja la operación real, se actualiza este documento **primero** y luego
> se construye. Complementa a [`reglas-de-negocio.md`](./reglas-de-negocio.md),
> [`modelo-de-datos.md`](./modelo-de-datos.md) y [`estado-y-plan.md`](./estado-y-plan.md).

## 0. Propósito

Que la firma controle **el flujo de la información, los tiempos y el cumplimiento
por cliente**, y pueda **medir por auxiliar, por asesor y por área**. El planeador
no es una lista de tareas: es el sistema que orquesta el **cierre contable mensual**
como una cadena de valor con entregas entre roles.

## 1. El modelo de operación: la cadena del cierre

El período de cada cliente avanza por **etapas encadenadas**. Cada etapa **consume**
lo que produjo la anterior y **entrega** a la siguiente:

```
INSUMO (Auxiliar)  →  PROCESAMIENTO POR ÁREA (Asesor)  →  REVISIÓN  →  RESULTADO
  captura /            Impuestos · Informes ·             técnica +     EEFF emitidos
  conciliaciones       Nómina · Tesorería                 revisoría     + impuestos
  + documento soporte                                      fiscal        presentados
```

- **Insumo / captura (Auxiliar).** Registro en software, conciliaciones (bancaria,
  cartera, caja, impuestos), documento soporte. **Produce:** el período conciliado
  y listo para trabajar.
- **Procesamiento por área (Asesor).** Se **habilita** cuando el insumo del área
  está *entregado*:
  - **Impuestos** — genera y presenta declaraciones (Retención, IVA, ICA, RST…).
  - **Informes** — EEFF, revisión de reconocimiento de ingresos/costos, informes a
    Superintendencia.
  - **Nómina** — nómina electrónica, PILA, obligaciones laborales.
  - **Tesorería** — obligaciones financieras, pagos.
- **Revisión.** Revisión técnica del asesor + **revisoría fiscal** (portal de
  hallazgos, ver [`revisoria-fiscal.md`](./revisoria-fiscal.md)).
- **Resultado / cierre.** EEFF emitidos + impuestos presentados/pagados +
  cumplimiento del período.

**La pieza clave es la *entrega* (handoff):** cuando el auxiliar termina, **entrega**
y con eso **habilita y avisa** a Impuestos e Informes; *"ya puedes empezar"*. El
control del flujo nace de modelar esa entrega, no de tareas sueltas.

## 2. Roles y responsabilidades (RACI)

Los roles existen en el esquema (`Rol`, `AsignacionClienteArea` con asesor/auxiliar
por área). Aquí se define **qué hace, qué ve y en qué se mide** cada uno.

| Rol | Hace | Ve (vista propia) | Se mide por |
|---|---|---|---|
| **Auxiliar** (ejecutor) | Captura el insumo; concilia; arma soporte; **entrega** al área | *Mi día*: sus clientes/áreas, lo pendiente de capturar y entregar | Captura **a tiempo**, tiempo de captura, reprocesos |
| **Asesor** (responsable de área) | Procesa con el insumo (declara, arma EEFF…); revisa técnicamente; **entrega** al cierre | Bandeja *"listo para procesar"*: lo que ya le entregaron | Procesamiento **a tiempo** tras recibir insumo, tiempo de área |
| **Coordinador** | Orquesta el flujo, distribuye carga, destraba cuellos | Tablero de flujo del período: etapas, cuellos, en riesgo | Cumplimiento global del período, cuellos resueltos |
| **Gerente** | Control y decisión | Indicadores por área/persona/cliente y **tiempos** | — (es quien mide) |
| **Revisor fiscal** (Auditor) | Control independiente; registra hallazgos | Cola de auditoría + portal de hallazgos | Hallazgos gestionados/resueltos |
| **Cliente** | Consulta y recibe | Calendario, vencimientos, hallazgos (solo lectura) | — |

## 3. La unidad de trabajo y su ciclo de vida

La **tarea** (`Tarea`, `EstadoTarea`) es la unidad. Su ciclo ya existe y se conserva:

```
por_iniciar → en_curso → en_revision → terminado → auditado
                                    ↘ no_realizado
```

Se añade el concepto de **entrega**: cuando una tarea (o el conjunto de captura de
un área) llega a *terminado*, **emite una entrega** que:
1. **Habilita** las tareas sucesoras (las que esperaban ese insumo).
2. **Avisa** al rol siguiente (*"tienes trabajo listo para procesar"*).

Los **vencimientos** (declaraciones) siguen su propio ciclo de presentación/pago,
pero participan igual en el flujo: heredan responsable y checklist, y su avance
suma al cumplimiento del área (ver `reglas-de-negocio.md` §unificación plan↔vencimientos).

## 4. Dependencias y habilitación

- **Nivel área (mínimo indispensable):** la **captura del área** habilita el
  **procesamiento del área**. Es la regla 80/20 que cubre el flujo descrito.
- **Nivel actividad (fino, opcional):** una actividad puede declarar
  **predecesoras** concretas (ej. *Conciliación de impuestos* → habilita *IVA* y
  *Retención*). Se define en el catálogo (`ActividadPlan`) para que aplique a todos
  los clientes.
- Una tarea sucesora en `por_iniciar` con predecesora incompleta se muestra
  **bloqueada** (no es que no exista: es que "aún no es tu turno").

## 5. Eventos y tiempos

Todo lo demás se **deriva de eventos con marca de tiempo**. Por cada transición de
estado se registra *quién* y *cuándo*: `capturado`, `entregado`, `en proceso`,
`revisado`, `cerrado`. Con eso se miden **tiempos**, no solo hecho/no hecho:

- **Lead time del cierre:** de primer insumo a resultado final del cliente.
- **Tiempo de handoff:** espera entre *entregado* y que el siguiente *arranca*
  (mide cuellos de coordinación).
- **Tiempo de etapa:** cuánto tarda cada área.

## 6. Marco de medición (multi-eje, derivado de los eventos)

| Eje | Qué mide |
|---|---|
| **Auxiliar** | Capturas entregadas a tiempo · tiempo de captura · reprocesos |
| **Asesor** | Procesamiento a tiempo tras recibir insumo · tiempo de área |
| **Área** | Cumplimiento · tiempo de ciclo · dónde está el cuello |
| **Cliente** | Avance del cierre (etapas completas) · a tiempo / en riesgo |

El **Panel de Coordinación** ya mide cumplimiento por área/persona/cliente
(`/plan/cumplimiento`, ahora también con vencimientos vinculados). Sobre esa misma
base se agregan los **tiempos** cuando existan los eventos con marca de tiempo.

## 7. Principios de diseño (validados, no negociar sin razón)

1. **La regla se valida en el backend.** El frontend nunca se salta una validación.
2. **Una sola fuente de verdad.** Cada dato vive en un lugar; nada se duplica
   (ya aplicado: las declaraciones viven en Vencimientos, no como tarea del plan).
3. **Desacoplar de identificadores volátiles.** Vincular por **clave estable**, no
   por código que el usuario puede recodificar.
4. **Idempotente y no destructivo.** Regenerar/limpiar nunca borra trabajo: solo
   completa lo que falta o quita lo vacío.
5. **Derivar, no almacenar, lo calculable.** "Vencido", avance, semáforos se
   derivan de la fecha/estado; no se teclean.
6. **Por rol, sobre una columna común.** Las vistas por rol se construyen **encima**
   del mismo flujo y los mismos eventos; no como herramientas sueltas (evita retrabajo).

## 8. Estado actual vs. objetivo

**Ya existe (base sobre la que se construye):**
- Tarea con ciclo de vida; `AsignacionClienteArea` (responsables por área);
  `ActividadPlan` + plan por cliente; Vencimientos con checklist + responsable +
  avance; Calendario unificado; Panel de Coordinación; Auditoría/hallazgos.

**Falta para el modelo (el vacío a llenar):**
- **Dependencias + entrega + notificación** (el handoff auxiliar→asesor→informes).
- **Marcas de tiempo por transición** (para medir tiempos).
- **Vistas por rol** (*Mi día* del auxiliar; bandeja *"listo para procesar"* del
  asesor; tablero de flujo del coordinador/gerente).

## 9. Roadmap sin retrabajo

- **F0 — Fijar la metodología.** Este documento + su mapa visual, validados con el
  equipo. *(en curso)*
- **F1 — La columna vertebral.** Eventos de transición con marca de tiempo + evento
  de **entrega** que notifica + **dependencias** mínimas (insumo del área →
  procesamiento del área).
- **F2 — Vistas por rol.** Bandeja del asesor, *Mi día* del auxiliar, tablero de
  flujo del coordinador/gerente — todas sobre la misma columna.
- **F3 — Medición de tiempos.** Lead time, tiempo de handoff, cumplimiento **a
  tiempo** por cada eje.
- **F4 — Automatización.** SLAs/alertas, notificaciones por correo, integraciones
  (n8n).

---

_Última actualización: 2026-08-05._
