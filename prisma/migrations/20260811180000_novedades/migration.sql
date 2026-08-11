-- Novedades del día: lo que impidió trabajar (internet, acceso al sistema,
-- lentitud del equipo) con su plan de acción.
--
-- Hasta ahora esto se contaba de palabra, con lo cual "el internet nos tiene
-- mal" era una opinión que nadie podía llevar a una cotización. Con tipo de
-- catálogo y minutos calculados, la misma frase se vuelve una cifra.

CREATE TABLE "tipos_novedad" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "tipos_novedad_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_novedad_organizacionId_nombre_key" ON "tipos_novedad"("organizacionId", "nombre");
CREATE INDEX "tipos_novedad_organizacionId_idx" ON "tipos_novedad"("organizacionId");

ALTER TABLE "tipos_novedad" ADD CONSTRAINT "tipos_novedad_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "novedades" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "planAccion" TEXT NOT NULL,
    "horaDesde" TEXT,
    "horaHasta" TEXT,
    "minutos" INTEGER,
    "empresaId" TEXT,
    "areaId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'abierta',
    "cerradaEn" TIMESTAMP(3),
    "cerradaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "novedades_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "novedades_organizacionId_fecha_idx" ON "novedades"("organizacionId", "fecha");
CREATE INDEX "novedades_organizacionId_estado_idx" ON "novedades"("organizacionId", "estado");
CREATE INDEX "novedades_usuarioId_idx" ON "novedades"("usuarioId");

ALTER TABLE "novedades" ADD CONSTRAINT "novedades_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_tipoId_fkey"
  FOREIGN KEY ("tipoId") REFERENCES "tipos_novedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_cerradaPorId_fkey"
  FOREIGN KEY ("cerradaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los tipos que los auxiliares ya reportan de palabra. Se siembran para todas
-- las organizaciones porque el despliegue no corre el seed: sin esto el
-- desplegable saldría vacío y no se podría reportar la primera novedad.
--
-- El id se arma concatenando y no con gen_random_uuid() para no depender de
-- pgcrypto, y para que volver a correr la migración no duplique filas.
INSERT INTO "tipos_novedad" ("id", "organizacionId", "nombre", "orden")
SELECT 'tiponov-' || o."id" || '-' || t."orden", o."id", t."nombre", t."orden"
FROM "organizaciones" o
CROSS JOIN (VALUES
  ('Internet', 1),
  ('Acceso al sistema', 2),
  ('Equipo lento', 3),
  ('Energía', 4),
  ('Portal de la DIAN / entidad', 5),
  ('Información del cliente', 6),
  ('Otra', 99)
) AS t("nombre", "orden")
WHERE NOT EXISTS (
  SELECT 1 FROM "tipos_novedad" x
  WHERE x."organizacionId" = o."id" AND x."nombre" = t."nombre"
);
