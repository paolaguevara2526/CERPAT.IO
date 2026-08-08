-- Abonos (pagos parciales) a obligaciones + sanción mínima por municipio (UVT). Aditivo.

-- Sanción mínima propia del municipio (en UVT); null = usar la de la firma.
ALTER TABLE "cat_municipios" ADD COLUMN "sancionMinimaUvt" DECIMAL(6,2);

-- Abonos contra un vencimiento (saldo = valorPago − Σ abonos).
CREATE TABLE "abonos_vencimiento" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "vencimientoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "abonos_vencimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "abonos_vencimiento_organizacionId_idx" ON "abonos_vencimiento"("organizacionId");
CREATE INDEX "abonos_vencimiento_vencimientoId_idx" ON "abonos_vencimiento"("vencimientoId");

ALTER TABLE "abonos_vencimiento" ADD CONSTRAINT "abonos_vencimiento_vencimientoId_fkey"
    FOREIGN KEY ("vencimientoId") REFERENCES "vencimientos_empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
