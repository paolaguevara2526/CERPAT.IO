-- Fase 1 · Visitas a clientes (asesor/auditor) con acta: objetivo, recomendaciones
-- y compromisos (cada uno con su fecha límite y responsable) para el seguimiento.

-- CreateEnum
CREATE TYPE "EstadoVisita" AS ENUM ('programada', 'realizada', 'cancelada');
CREATE TYPE "EstadoCompromiso" AS ENUM ('pendiente', 'cumplido', 'cancelado');

-- CreateTable: visitas
CREATE TABLE "visitas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "responsableId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT,
    "objetivo" TEXT,
    "recomendaciones" TEXT,
    "estado" "EstadoVisita" NOT NULL DEFAULT 'programada',
    "observaciones" TEXT,
    "actividadPlanId" TEXT,
    "periodo" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "visitas_organizacionId_idx" ON "visitas"("organizacionId");
CREATE INDEX "visitas_empresaId_idx" ON "visitas"("empresaId");
CREATE INDEX "visitas_fecha_idx" ON "visitas"("fecha");
CREATE INDEX "visitas_responsableId_idx" ON "visitas"("responsableId");

-- CreateTable: compromisos_visita
CREATE TABLE "compromisos_visita" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaLimite" TIMESTAMP(3),
    "responsableId" TEXT,
    "estado" "EstadoCompromiso" NOT NULL DEFAULT 'pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "compromisos_visita_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "compromisos_visita_organizacionId_idx" ON "compromisos_visita"("organizacionId");
CREATE INDEX "compromisos_visita_visitaId_idx" ON "compromisos_visita"("visitaId");
CREATE INDEX "compromisos_visita_fechaLimite_idx" ON "compromisos_visita"("fechaLimite");

-- Foreign keys: visitas
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: compromisos_visita
ALTER TABLE "compromisos_visita" ADD CONSTRAINT "compromisos_visita_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compromisos_visita" ADD CONSTRAINT "compromisos_visita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compromisos_visita" ADD CONSTRAINT "compromisos_visita_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
