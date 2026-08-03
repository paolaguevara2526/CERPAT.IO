-- Agrega la responsabilidad nacional FOPAT (retención mensual, empresas de
-- transporte) a la configuración tributaria del cliente.
ALTER TABLE "configuracion_tributaria" ADD COLUMN "fopat" BOOLEAN NOT NULL DEFAULT false;
