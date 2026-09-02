-- Se juntan los tipos de servicio que son el mismo escrito distinto.
--
-- El catálogo se sembró desde el texto libre viejo "tal como estaba escrito"
-- (migración 20260812230000_tipos_servicio), y el texto libre traía todas las
-- variantes que había escrito cada quien. El índice único compara texto exacto,
-- así que pasaron todas: el desplegable de clientes muestra hoy "Asesoria
-- Contable" y "Asesoría Contable", "Outsourcing contable" y "Outsourcing
-- Contable" — la misma opción repetida.
--
-- Un catálogo con la misma opción dos veces es peor que no tenerlo: la gente
-- escoge cualquiera de las variantes y todo corte de la cartera por servicio
-- queda partido en pedazos que nadie suma.
--
-- Se juntan SOLO las que son la misma palabra sin tildes, sin mayúsculas y sin
-- espacios de más. "Asesoría" y "Asesoría Contable" son servicios distintos y no
-- se tocan; "Revisoria Contable", que no tiene gemela, se queda como está —
-- corregirle la ortografía es decisión de la firma, no de una migración.

-- Clave de comparación (la misma que usa la API en catalogos/nombre.ts).
CREATE OR REPLACE FUNCTION cerpat_clave_nombre(t text) RETURNS text AS $$
  SELECT regexp_replace(
           btrim(lower(translate(t, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))),
           '\s+', ' ', 'g')
$$ LANGUAGE sql IMMUTABLE;

-- Gana la variante MEJOR ESCRITA, no la más repetida. Reescribir clientes es una
-- sola sentencia y no cuesta nada; en cambio la variante que sobreviva es la que
-- la firma va a ver en el desplegable de aquí en adelante, y dejar ganar
-- "Asesoria Contable" sobre "Asesoría Contable" solo porque estaba escrita más
-- veces sería consagrar la falta de ortografía.
--
-- Mejor escrita = con tildes, y luego con las iniciales en mayúscula
-- ("Outsourcing Contable" antes que "Outsourcing contable").
CREATE TEMP TABLE _serv_ganador AS
WITH uso AS (
  SELECT c."id", c."organizacionId", c."nombre", c."orden",
         cerpat_clave_nombre(c."nombre") AS clave,
         (SELECT count(*) FROM "empresas" e
           WHERE e."organizacionId" = c."organizacionId" AND btrim(e."servicio") = c."nombre") AS usos,
         (c."nombre" <> translate(c."nombre", 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) AS con_tilde,
         length(regexp_replace(c."nombre", '[^A-ZÁÉÍÓÚÜÑ]', '', 'g')) AS mayusculas
    FROM "cat_tipos_servicio" c
)
SELECT DISTINCT ON ("organizacionId", clave)
       "organizacionId", clave, "id" AS ganador_id, "nombre" AS ganador_nombre
  FROM uso
 ORDER BY "organizacionId", clave, con_tilde DESC, mayusculas DESC, usos DESC, "nombre" ASC;

-- 0) Espacios sobrantes en el servicio del cliente: " Ocasional " no empata con
--    "Ocasional" del catálogo y el desplegable lo marcaría como fuera de él.
UPDATE "empresas" SET "servicio" = NULLIF(btrim("servicio"), '')
 WHERE "servicio" IS NOT NULL AND "servicio" <> btrim("servicio");

-- 1) Los clientes que tenían escrita una variante perdedora pasan a la ganadora.
--    Sin esto quedarían apuntando a un servicio que ya no está en el catálogo.
UPDATE "empresas" e
   SET "servicio" = g.ganador_nombre
  FROM _serv_ganador g
 WHERE e."organizacionId" = g."organizacionId"
   AND e."servicio" IS NOT NULL
   AND cerpat_clave_nombre(btrim(e."servicio")) = g.clave
   AND btrim(e."servicio") <> g.ganador_nombre;

-- 2) Se borran las variantes perdedoras del catálogo.
DELETE FROM "cat_tipos_servicio" c
 USING _serv_ganador g
 WHERE c."organizacionId" = g."organizacionId"
   AND cerpat_clave_nombre(c."nombre") = g.clave
   AND c."id" <> g.ganador_id;

DROP TABLE _serv_ganador;

-- La función era solo para esta limpieza. No se deja un índice funcional sobre
-- ella porque Prisma no lo conoce y lo propondría borrar en la siguiente
-- migración; que no vuelvan a entrar variantes lo garantiza la API
-- (catalogos/nombre.ts), como el resto de las reglas de negocio.
DROP FUNCTION cerpat_clave_nombre(text);
