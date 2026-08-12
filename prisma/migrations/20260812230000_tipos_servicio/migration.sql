-- El servicio del cliente pasa a ser catálogo.
--
-- La tabla `cat_tipos_servicio` existía desde el principio pero nadie la
-- administraba, y el campo del formulario de clientes era de TEXTO LIBRE: cada
-- quien escribía lo suyo ("Outsourcing", "outsourcing", "Ocasional", "asesoría")
-- y cualquier corte de la cartera por servicio quedaba inservible. Es la misma
-- lección de los tipos de documento de la captura.

-- Índice único como el del resto de los catálogos: sin él se podría crear
-- "Outsourcing" dos veces y volveríamos justo al problema que esto resuelve.
-- Se limpian primero los duplicados que hubieran quedado (deja el más antiguo).
DELETE FROM "cat_tipos_servicio" a
USING "cat_tipos_servicio" b
WHERE a."organizacionId" = b."organizacionId" AND a."nombre" = b."nombre" AND a."id" > b."id";

CREATE UNIQUE INDEX IF NOT EXISTS "cat_tipos_servicio_organizacionId_nombre_key"
  ON "cat_tipos_servicio"("organizacionId", "nombre");

-- Se siembra con los servicios QUE YA ESTÁN EN USO, tal como están escritos.
-- No se inventa una lista: los servicios de la firma los define la firma, y si
-- el desplegable no ofreciera lo que ya tienen los clientes, editar cualquiera
-- de ellos le cambiaría el servicio sin que nadie lo pidiera.
INSERT INTO "cat_tipos_servicio" ("id", "organizacionId", "nombre", "orden")
SELECT DISTINCT ON (e."organizacionId", btrim(e."servicio"))
       'tiposerv-' || md5(e."organizacionId" || '|' || btrim(e."servicio")),
       e."organizacionId", btrim(e."servicio"), 0
FROM "empresas" e
WHERE e."servicio" IS NOT NULL
  AND btrim(e."servicio") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "cat_tipos_servicio" x
    WHERE x."organizacionId" = e."organizacionId" AND x."nombre" = btrim(e."servicio")
  );
