-- F1.2b — Captura de documentos por lotes. Aditivo: columna opcional y tabla nueva.

-- Marca la actividad especial "Captura de documentos" (muestra el detalle de lotes).
ALTER TABLE "actividades_plan" ADD COLUMN "esCapturaDocumentos" BOOLEAN NOT NULL DEFAULT false;

-- Lotes de captura dentro de la tarea (tipo · consecutivo desde–hasta · cantidad · fecha).
CREATE TABLE "lotes_captura" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "desde" TEXT,
    "hasta" TEXT,
    "cantidad" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lotes_captura_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lotes_captura_organizacionId_idx" ON "lotes_captura"("organizacionId");
CREATE INDEX "lotes_captura_tareaId_idx" ON "lotes_captura"("tareaId");

ALTER TABLE "lotes_captura" ADD CONSTRAINT "lotes_captura_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lotes_captura" ADD CONSTRAINT "lotes_captura_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
