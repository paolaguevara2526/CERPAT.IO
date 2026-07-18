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
6. **Liquidador de intereses y sanción** (`Pago`), solo si
   `estadoPago != 'presentado_pagado'` y `fechaVencimiento < hoy`:
   - `diasMora = hoy - fechaVencimiento`
   - `tasaDiaria = tasaMoraMensual / 30`
   - `interes = valor * tasaDiaria * diasMora`
   - Si `diasMora > 60`: `sancion = max(valor * pctSancionExtemporaneidad, sancionMinimaUvt * valorUvt)`; si no, `sancion = 0`
   - `total = valor + interes + sancion`
   - Debe recalcularse a diario (job en n8n o backend), no solo al consultar.
7. **Vista de Pagos.** No mostrar obligaciones futuras (`fechaVencimiento > hoy`)
   salvo que `estadoTarea = 'terminado'`, ya estén vencidas o ya estén pagadas.
8. **Impresión modo "Cliente".** Excluir siempre las tareas con `interno = true`.
9. **Etiquetas dinámicas.** Se puede crear una etiqueta al vuelo desde el
   formulario de tarea; queda disponible en el catálogo para reutilizarse.

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
