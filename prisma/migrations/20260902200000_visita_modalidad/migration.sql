-- Visita presencial vs. reunión virtual.
--
-- Además de las visitas en sitio, la firma programa reuniones virtuales
-- mensuales con los clientes para temas puntuales. Es la MISMA entidad —se
-- programa, se levanta acta, deja compromisos y se le hace seguimiento—, así
-- que no se duplica: se marca la modalidad.
--
-- Se separan porque la dirección necesita saber cuánto del acompañamiento se
-- hace en sitio y cuánto a distancia, y con un solo nombre esa cuenta no existe.
--
-- DEFAULT presencial, y así se quedan las que ya están cargadas: todas son
-- visitas en sitio, y un valor nuevo no puede cambiarle la naturaleza al
-- histórico.
DO $$ BEGIN
  CREATE TYPE "ModalidadVisita" AS ENUM ('presencial', 'virtual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "visitas"
  ADD COLUMN IF NOT EXISTS "modalidad" "ModalidadVisita" NOT NULL DEFAULT 'presencial';
