-- Circuito de revisión de impuestos: el asesor liquida, el revisor aprueba o
-- devuelve, y el asesor presenta. Ver docs/reglas-de-negocio.md.
--
-- Todo aditivo: columnas opcionales o con valor por defecto, tabla nueva y un
-- rol nuevo. Nada de lo que hay hoy cambia de estado al desplegar.

-- Estado del impuesto DENTRO de la firma. No se mezcla con "estado" (EstadoPago),
-- que es lo que pasó ante la DIAN y es lo que muestra el calendario: un impuesto
-- puede estar aprobado por el revisor y todavía pendiente de presentar.
CREATE TYPE "EstadoRevisionVenc" AS ENUM ('sin_iniciar', 'en_proceso', 'en_revision', 'devuelto', 'aprobado');

ALTER TABLE "vencimientos_empresa" ADD COLUMN "estadoRevision" "EstadoRevisionVenc" NOT NULL DEFAULT 'sin_iniciar';
-- Ordena la cola compartida de los revisores: se atiende por orden de llegada,
-- no por asignación fija a un revisor.
ALTER TABLE "vencimientos_empresa" ADD COLUMN "enviadoRevisionEn" TIMESTAMP(3);
ALTER TABLE "vencimientos_empresa" ADD COLUMN "revisorId" TEXT;
ALTER TABLE "vencimientos_empresa" ADD COLUMN "observacionRevision" TEXT;
-- Cuándo se presentó de verdad. "updatedAt" no sirve para medir: cualquier
-- edición posterior lo pisa.
ALTER TABLE "vencimientos_empresa" ADD COLUMN "fechaPresentacion" TIMESTAMP(3);
ALTER TABLE "vencimientos_empresa" ADD COLUMN "presentadoPorId" TEXT;

ALTER TABLE "vencimientos_empresa" ADD CONSTRAINT "vencimientos_empresa_revisorId_fkey" FOREIGN KEY ("revisorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vencimientos_empresa" ADD CONSTRAINT "vencimientos_empresa_presentadoPorId_fkey" FOREIGN KEY ("presentadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rastro completo del circuito. Los campos de arriba guardan solo el estado
-- actual: si un impuesto se devuelve dos veces, la segunda observación pisa la
-- primera. Aquí queda todo, que es lo que hace medibles las preguntas reales
-- (cuánto tarda un revisor, cuántas vueltas da un impuesto, cuántos días antes
-- del vencimiento se presentó).
CREATE TABLE "eventos_vencimiento" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "vencimientoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "observaciones" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_vencimiento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "eventos_vencimiento_organizacionId_idx" ON "eventos_vencimiento"("organizacionId");
CREATE INDEX "eventos_vencimiento_vencimientoId_idx" ON "eventos_vencimiento"("vencimientoId");

ALTER TABLE "eventos_vencimiento" ADD CONSTRAINT "eventos_vencimiento_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_vencimiento" ADD CONSTRAINT "eventos_vencimiento_vencimientoId_fkey" FOREIGN KEY ("vencimientoId") REFERENCES "vencimientos_empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_vencimiento" ADD CONSTRAINT "eventos_vencimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El rol Revisor entra POR MIGRACIÓN, no por el archivo de datos base: en el
-- despliegue solo corren las migraciones, así que si se dejara solo en el seed
-- el rol no existiría en producción y no se le podría asignar a nadie.
--
-- Se crea en TODAS las organizaciones (la plataforma es multi-firma) y se salta
-- las que ya lo tengan, para que volver a correr la migración no falle.
-- El id se arma a partir del de la organización en vez de gen_random_uuid():
-- no depende de que la extensión pgcrypto esté instalada, y es estable.
INSERT INTO "roles" ("id", "organizacionId", "nombre")
SELECT 'rol-revisor-' || o."id", o."id", 'Revisor'
FROM "organizaciones" o
WHERE NOT EXISTS (
  SELECT 1 FROM "roles" r WHERE r."organizacionId" = o."id" AND r."nombre" = 'Revisor'
);
