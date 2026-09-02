-- Contrato de servicio del cliente: desde cuándo, cuántas horas al mes y qué
-- cubre.
--
-- Son el OTRO LADO de la medición de horas: el acta ya dice cuántas se
-- ejecutaron, pero sin lo pactado no se puede decir si se cumple. Cada cliente
-- tiene sus propias horas, así que esto vive en la ficha del cliente y no en un
-- catálogo por servicio.
--
-- Los tres nullable: son datos que hay que ir levantando cliente por cliente, y
-- un valor inventado en un campo que sirve para facturar es peor que un vacío
-- que se ve.
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "contratoDesde"    TIMESTAMP(3);
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "horasPactadasMes" DECIMAL(6,2);
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "alcanceServicio"  TEXT;
