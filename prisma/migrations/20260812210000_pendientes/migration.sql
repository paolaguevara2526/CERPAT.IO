-- Pendientes del día a día: lo que sale por fuera del plan de trabajo.
--
-- El cliente que pide un certificado, la corrección que hay que hacer, la
-- llamada al banco. Hasta ahora vivía en cuadernos y en WhatsApp.
--
-- Tabla aparte y no un campo más en `tareas` a propósito: una tarea del plan
-- entra en la MEDICIÓN de cumplimiento, y un pendiente no debe mover ese
-- porcentaje. Además `tareas.empresaId` es obligatorio, y aquí la empresa puede
-- ir vacía (hay pendientes internos que no son de ningún cliente).

CREATE TABLE "pendientes" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT,
    -- Día del calendario, a medianoche UTC (ver plan/dia-calendario.ts).
    "fecha" TIMESTAMP(3) NOT NULL,
    "empresaId" TEXT,
    "responsableId" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "hechoEn" TIMESTAMP(3),
    "hechoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pendientes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pendientes_organizacionId_fecha_idx" ON "pendientes"("organizacionId", "fecha");
CREATE INDEX "pendientes_responsableId_estado_idx" ON "pendientes"("responsableId", "estado");
CREATE INDEX "pendientes_empresaId_idx" ON "pendientes"("empresaId");

ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_responsableId_fkey"
  FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_hechoPorId_fkey"
  FOREIGN KEY ("hechoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
