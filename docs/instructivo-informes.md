# Instructivo — Flujo del área de Informes

> Cómo funciona hoy, del catálogo a la auditoría.
> Actualizado: 2026-08-11. Documento hermano de
> [`instructivo-vencimientos-impuestos.md`](./instructivo-vencimientos-impuestos.md).

## En qué se diferencia de Impuestos

Impuestos trabaja sobre **vencimientos** (declaraciones con fecha legal ante la
DIAN o el municipio). Informes trabaja sobre **tareas del plan de trabajo**: no
hay fecha legal externa, hay un **día hábil de entrega** que fija la firma, y la
revisión se hace en **Auditoría**, no en la cola de Revisión de impuestos.

Lo que sí comparten: el insumo del auxiliar habilita el trabajo del asesor, todo
se mide con checklist, y todo deja rastro.

## Actividades del área (catálogo base)

| Código | Actividad | Periodicidad |
|---|---|---|
| **EF-04** | Depreciación de activos fijos | Mensual |
| **EF-05** | Amortización de intangibles | Mensual |
| **EF-13** | Estados financieros trimestrales | Trimestral |
| **EF-14** | Informes a Superintendencia | Anual |

Cada cliente puede tener más o menos, según su plan. El catálogo es la
plantilla; el **plan por cliente** es lo que realmente genera tareas.

## Quién hace qué

| Rol | Qué hace en este flujo |
|---|---|
| **Administrador / Coordinación** | Parametriza el catálogo y el plan por cliente, asigna responsables, genera las tareas del período y audita. |
| **Auxiliar contable** | Ejecuta la **captura**. Al terminarla toda, libera el insumo del área automáticamente. |
| **Asesor de Informes** | Ejecuta el **procesamiento**: elabora el informe, marca checklist, deja el soporte y lo envía a revisión. |
| **Auditoría** (Coordinación / asesor designado) | Aprueba o devuelve con observaciones. |

## Paso 0 · Parametrización

En **Administración → Catálogo de tareas**, cada actividad del área Informes
define de una vez y para todos los planes:

- **Área**: Informes (define quién la ejecuta vía la asignación cliente–área).
- **Fase**: `captura` · `procesamiento` · `revisión`. Es lo que arma la cadena:
  la captura habilita el procesamiento. Sin fase, la actividad no participa del
  bloqueo (se puede trabajar siempre).
- **Día hábil de entrega** (1–23): el plazo propio de la actividad, contando
  solo días hábiles. Vacío = vence a fin de mes.
- **Checklist plantilla**: las subtareas con las que nace cada tarea.
- **Requiere auditoría**: si pasa por la cola de aprobación.
- **Registro en software**: si la tarea pide comprobante desde–hasta y cantidad.
- **Formato del documento**: el nombre del entregable (p. ej.
  `0 Depreciación-Mes-Año`), para que todos lo guarden igual.

Y en **Asignaciones**: el asesor y el auxiliar del cliente para el área
Informes, más la marca **insumo del cliente** cuando el insumo no lo produce la
firma sino el cliente.

## Paso 1 · El insumo — la cadena del cierre

Aquí está la diferencia que más confunde al equipo, así que va explícita:

1. El auxiliar termina **toda la captura** del cliente en el período.
2. Al quedar toda terminada (o auditada), el sistema **libera el insumo solo,
   por área**: Impuestos recibe lo suyo, Informes lo suyo, y así Nómina y
   Tesorería. Nunca una liberación general.
3. Con el insumo liberado, las tareas de **procesamiento** del área se
   **desbloquean** y le aparecen al asesor.

**Excepciones y reversas:**
- Las áreas marcadas **insumo del cliente** no se auto-liberan: se marcan a mano
  cuando el cliente entrega, con la **fecha real** en que llegó.
- Si la captura se **reabre**, la liberación automática se revierte sola. Una
  entrega hecha a mano por coordinación nunca se revierte automáticamente.
- Si el cliente no tiene captura interna, no hay nada que auto-liberar.

## Paso 2 · El asesor procesa — Mi Día

En **Mi Día** el asesor ve solo lo que le toca **ejecutar a él**: sus tareas de
procesamiento y revisión. La captura de sus auxiliares aparece aparte y en
**solo lectura** — la observa, no la ejecuta.

La bandeja **«Para procesar»** muestra únicamente lo **desbloqueado**, con la
fecha en que quedó listo el insumo. Lo bloqueado no aparece ahí porque todavía
no se puede trabajar.

En cada tarea:

1. **Checklist**: marcar las subtareas. **No se puede marcar Terminado ni
   Auditado con subtareas sin resolver** — el sistema lo impide.
2. **🔗 Soporte documental**: el link donde quedó el informe.
3. **Registro en software** (si la actividad lo pide): comprobante desde–hasta
   y cantidad de registros.
4. **Estado**: `Por iniciar → En curso → En revisión → Terminado → Auditado`
   (o `No realizado` cuando corresponda).

## Paso 3 · Auditoría

- Las tareas en estado **En revisión** entran a la cola de **Auditoría** del
  período.
- Quien audita decide:
  - **Aprobar** → la tarea pasa a **Auditado** y queda **bloqueada**: no se
    edita más sin desbloquearla primero. Es el cierre.
  - **Devolver** → vuelve a **En curso** con las **observaciones obligatorias**;
    el asesor corrige y la reenvía.

## Paso 4 · Medición

- **Plan de Trabajo / Cumplimiento**: avance del período por cliente y área.
- **Flujo del cierre**: en qué eslabón va cada cliente (captura → insumo →
  procesamiento → revisión).
- **Portal del Cliente**: lo que el cliente ve de su propio avance.
- Cada cambio de estado queda en la bitácora con **quién y cuándo**: de ahí
  salen los tiempos de ciclo y de entrega.

## Reglas de oro

1. **La captura habilita, no reemplaza.** Mientras el insumo no esté liberado,
   la tarea de procesamiento está bloqueada — y eso es información, no un error.
2. **Cada quien ejecuta lo suyo.** El asesor no captura; el auxiliar no procesa.
   Mi Día lo separa a propósito.
3. **Sin checklist completo no hay Terminado.** La medición no se salta.
4. **Aprobado en auditoría = bloqueado.** Para corregir hay que desbloquear
   primero, y eso queda registrado.
5. **Los responsables heredados envejecen.** Una tarea nace con el asesor que
   tenía la asignación en ese momento; si cambia, hay que aplicar los
   responsables sobre lo ya generado.
6. **Las novedades no cambian estados.** Explican el atraso, no lo disculpan.

## Preguntas frecuentes del equipo

- **«La tarea aparece bloqueada.»** Falta la liberación del insumo del cliente
  para ese período y esa área. Si el insumo lo entrega el cliente, hay que
  marcarlo a mano con la fecha real en que llegó.
- **«Terminé la captura y no se desbloqueó nada.»** Se libera cuando está
  terminada **toda** la captura del cliente, no una tarea suelta.
- **«No me deja marcar Terminado.»** Quedan subtareas del checklist sin
  resolver.
- **«No me deja editar una tarea.»** Está aprobada en Auditoría: debe
  desbloquearse primero.
- **«Al auxiliar le aparecen tareas de procesamiento.»** No debería: el
  procesamiento es del asesor. Revisar la asignación cliente–área y la fase de
  la actividad en el catálogo.
- **«El asesor ve la captura de sus auxiliares en su lista.»** En la Lista sí
  aparece (es trabajo de su cartera); en **Mi Día** aparece aparte y en solo
  lectura, porque él no la ejecuta.
