-- Documentos del cliente (actas, informes, soportes) almacenados en Postgres, con
-- su tamaño para medir el almacenamiento por cliente. Aditivo.

CREATE TYPE "TipoDocumentoCliente" AS ENUM ('acta', 'informe', 'soporte', 'otro');

CREATE TABLE "documentos_cliente" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoDocumentoCliente" NOT NULL DEFAULT 'otro',
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "contenido" BYTEA NOT NULL,
    "subidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documentos_cliente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "documentos_cliente_organizacionId_idx" ON "documentos_cliente"("organizacionId");
CREATE INDEX "documentos_cliente_empresaId_idx" ON "documentos_cliente"("empresaId");

ALTER TABLE "documentos_cliente" ADD CONSTRAINT "documentos_cliente_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
