-- Obligaciones de solo presentación (mensuales, NO generan pago):
--  - Envío de nómina electrónica (10º día hábil del mes siguiente).
--  - Pago de seguridad social / PILA (día hábil según los 2 últimos dígitos del NIT).
-- Columnas aditivas y opcionales (DEFAULT false), no afectan datos existentes.
ALTER TABLE "configuracion_tributaria" ADD COLUMN "nominaElectronica" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "configuracion_tributaria" ADD COLUMN "seguridadSocial" BOOLEAN NOT NULL DEFAULT false;
