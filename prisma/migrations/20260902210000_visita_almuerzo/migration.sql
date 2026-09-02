-- Almuerzo que se descuenta del tiempo trabajado en una visita.
--
-- En una visita de todo el día son 8 horas de presencia contra 7 de trabajo, y
-- esa hora se factura: sin descontarla, el indicador de horas cumplidas queda
-- inflado justo en las visitas más largas, que son las que más pesan.
--
-- Nullable y sin valor por defecto a propósito: las visitas cortas no llevan
-- pausa, y a las ya registradas no se les puede inventar una — descontarles una
-- hora que nadie anotó les cambiaría las horas hacia atrás.
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "almuerzoMinutos" INTEGER;
