-- Catálogo de tipos de documento de la captura.
--
-- Antes la lista estaba escrita en el frontend y el campo era de texto libre:
-- no se podía agregar un tipo sin desplegar, y entraban "Egresos", "egresos" y
-- "Egreso" como si fueran cosas distintas — con lo cual cualquier medición por
-- tipo de documento quedaba inservible.

CREATE TABLE "tipos_documento_captura" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "tipos_documento_captura_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_documento_captura_organizacionId_nombre_key" ON "tipos_documento_captura"("organizacionId", "nombre");
CREATE INDEX "tipos_documento_captura_organizacionId_idx" ON "tipos_documento_captura"("organizacionId");

ALTER TABLE "tipos_documento_captura" ADD CONSTRAINT "tipos_documento_captura_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Se siembran los siete tipos que traía el frontend, para TODAS las
-- organizaciones. Sin esto, al desplegar la lista quedaría vacía y la captura
-- —que ya está en uso— se frenaría de golpe.
INSERT INTO "tipos_documento_captura" ("id", "organizacionId", "nombre", "orden")
SELECT 'tipodoc-' || o."id" || '-' || t."orden", o."id", t."nombre", t."orden"
FROM "organizaciones" o
CROSS JOIN (VALUES
  ('Egresos', 1),
  ('Facturas de compra', 2),
  ('Facturas de venta', 3),
  ('Documento equivalente', 4),
  ('Notas contables', 5),
  ('Nómina', 6),
  ('Ingresos', 7)
) AS t("nombre", "orden")
WHERE NOT EXISTS (
  SELECT 1 FROM "tipos_documento_captura" x
  WHERE x."organizacionId" = o."id" AND x."nombre" = t."nombre"
);

-- Y los tipos que ya se hayan capturado y no estén en esa lista: la captura
-- lleva días corriendo con el campo abierto, y si el desplegable no los ofrece,
-- lo ya registrado deja de poder repetirse.
INSERT INTO "tipos_documento_captura" ("id", "organizacionId", "nombre", "orden")
SELECT DISTINCT ON (l."organizacionId", l."tipoDocumento")
       'tipodoc-usado-' || md5(l."organizacionId" || '|' || l."tipoDocumento"),
       l."organizacionId", l."tipoDocumento", 99
FROM "lotes_captura" l
WHERE l."tipoDocumento" <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "tipos_documento_captura" x
    WHERE x."organizacionId" = l."organizacionId" AND x."nombre" = l."tipoDocumento"
  );
