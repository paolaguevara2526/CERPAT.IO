-- Vincula el checklist de una actividad del plan a un vencimiento tributario.
-- Guarda una clave estable (VINCULOS_VENCIMIENTO), independiente del código de la
-- actividad, para heredar las subtareas al vencimiento al generarlo.
-- Columna aditiva y opcional (NULL), no afecta datos existentes.
ALTER TABLE "actividades_plan" ADD COLUMN "obligacionVencimiento" TEXT;
