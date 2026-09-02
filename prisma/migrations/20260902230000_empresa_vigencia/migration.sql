-- Vigencia del contrato: plazo en meses y fecha de terminación.
--
-- Con la fecha inicial que ya existía, cierran la pregunta de si el contrato
-- sigue vivo: un servicio que se sigue prestando con el papel vencido es plata
-- y responsabilidad sin respaldo, y hoy eso no se ve en ninguna parte.
--
-- La terminación se guarda aunque salga de "inicio + meses": una prórroga puede
-- terminar en una fecha que no cuadre con esa cuenta, y ahí manda el papel. La
-- pantalla la propone y avisa si discrepan; no la pisa sola.
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "mesesContrato" INTEGER;
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "contratoHasta" TIMESTAMP(3);
