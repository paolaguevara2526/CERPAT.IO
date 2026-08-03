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
     fila y como KPI, en Pagos. **UVT 2026 = $52.374.**
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
