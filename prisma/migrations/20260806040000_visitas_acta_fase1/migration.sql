-- Fase 1 del acta de visita: compromisos firma/cliente con responsable externo,
-- ítems enumerados (actividades/recomendaciones/observaciones) y área. Aditivo.

-- CreateEnum
CREATE TYPE "ResponsableCompromiso" AS ENUM ('firma', 'cliente');
CREATE TYPE "TipoItemActa" AS ENUM ('actividad', 'recomendacion', 'observacion');

-- Visita: lugar y área
ALTER TABLE "visitas" ADD COLUMN "lugar" TEXT;
ALTER TABLE "visitas" ADD COLUMN "area" TEXT;

-- Compromiso: dirección firma/cliente, responsable externo y área
ALTER TABLE "compromisos_visita" ADD COLUMN "responsableTipo" "ResponsableCompromiso" NOT NULL DEFAULT 'firma';
ALTER TABLE "compromisos_visita" ADD COLUMN "responsableExterno" TEXT;
ALTER TABLE "compromisos_visita" ADD COLUMN "area" TEXT;

-- Ítems enumerados del acta
CREATE TABLE "items_acta" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "tipo" "TipoItemActa" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "items_acta_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "items_acta_organizacionId_idx" ON "items_acta"("organizacionId");
CREATE INDEX "items_acta_visitaId_idx" ON "items_acta"("visitaId");

ALTER TABLE "items_acta" ADD CONSTRAINT "items_acta_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items_acta" ADD CONSTRAINT "items_acta_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
