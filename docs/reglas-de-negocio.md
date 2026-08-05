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
    - **No se duplica la declaración como tarea del plan:** el generador del plan
      (`prisma/plan-generar.ts`) **no crea tarea** para las actividades vinculadas a
      un vencimiento (`obligacionVencimiento != null`); esas se controlan en
      Vencimientos. Las tareas-duplicado ya generadas se limpian con
      `prisma/plan-limpiar-duplicados.ts`, que borra **solo las vacías** (sin
      avance) y conserva las que tengan trabajo (dry-run por defecto; `--apply`
      para borrar).
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
      3-nov**. Aplica **automáticamente a todas las personas jurídicas**, derivado
      de `rentaTipo ∈ {persona_juridica, gran_contribuyente, rst_consolidada}` (no
      requiere marcar cliente por cliente ni casilla nueva). Como las demás de solo
      presentación, entra en `OBLIGACIONES_SIN_PAGO`. Fechas parametrizadas por año
      en `RUB_FECHAS` (generador de la API y sembrador masivo, mantener en sync).

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
