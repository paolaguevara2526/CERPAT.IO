-- "No aplica" como estado de una tarea del plan.
--
-- Hasta ahora, una actividad que ese cliente no tenía ese mes (una empresa sin
-- movimiento no tiene anticipos que verificar) solo se podía dejar pendiente
-- —y salía vencida— o marcarla "no realizado", que cuenta como incumplimiento.
-- Las dos opciones ensucian la medición del equipo con trabajo que nunca
-- existió.
--
-- Es la misma regla que ya rige en los checklists de vencimientos: lo que no
-- aplica sale del denominador, no cuenta en contra.

ALTER TYPE "EstadoTarea" ADD VALUE IF NOT EXISTS 'no_aplica';
