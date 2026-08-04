-- Responsable (asesor/auxiliar) del vencimiento + checklist (subtareas) heredado
-- de la actividad del plan vinculada. Columnas aditivas/opcionales y tabla nueva;
-- no afectan datos existentes.

-- Responsable en el vencimiento (heredado del área de la actividad vinculada).
ALTER TABLE "vencimientos_empresa" ADD COLUMN "asesorId" TEXT;
ALTER TABLE "vencimientos_empresa" ADD COLUMN "auxiliarId" TEXT;

-- Checklist del vencimiento (se copia de las subtareas plantilla de la actividad).
CREATE TABLE "subtareas_vencimiento" (
    "id" TEXT NOT NULL,
    "vencimientoId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "estado" "EstadoSubtarea" NOT NULL DEFAULT 'pendiente',
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "subtareas_vencimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subtareas_vencimiento_vencimientoId_idx" ON "subtareas_vencimiento"("vencimientoId");

ALTER TABLE "vencimientos_empresa" ADD CONSTRAINT "vencimientos_empresa_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vencimientos_empresa" ADD CONSTRAINT "vencimientos_empresa_auxiliarId_fkey" FOREIGN KEY ("auxiliarId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subtareas_vencimiento" ADD CONSTRAINT "subtareas_vencimiento_vencimientoId_fkey" FOREIGN KEY ("vencimientoId") REFERENCES "vencimientos_empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
