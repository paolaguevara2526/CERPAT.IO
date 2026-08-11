-- Día hábil de entrega por actividad del catálogo.
--
-- Hasta ahora toda tarea del plan vencía el último día del mes, así que el
-- plazo no distinguía entre causar compras y cerrar el mes. El equipo trabaja
-- por día hábil ("informes financieros al 12º"), y ese calendario vive en el
-- catálogo: se define una vez y aplica a todos los clientes.
--
-- Aditivo y nulable: las actividades sin día hábil siguen venciendo a fin de
-- mes, exactamente como antes.
ALTER TABLE "actividades_plan" ADD COLUMN "diaHabilEntrega" INTEGER;
