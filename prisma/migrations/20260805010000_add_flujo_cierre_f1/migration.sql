-- F1 — Flujo del cierre: fase de la actividad, entregas de insumo y bitácora de
-- eventos de tarea. Ver docs/metodologia-operacion.md. Aditivo: columna opcional
-- y tablas nuevas; no afecta datos existentes.

-- Fase de la actividad (captura / procesamiento / revisión).
CREATE TYPE "FaseActividad" AS ENUM ('captura', 'procesamiento', 'revision');
ALTER TABLE "actividades_plan" ADD COLUMN "fase" "FaseActividad";

-- Entrega del insumo (general si areaId es NULL; por área si no).
CREATE TABLE "entregas_insumo" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "areaId" TEXT,
    "entregadoPorId" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "entregadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entregas_insumo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "entregas_insumo_empresaId_periodo_areaId_key" ON "entregas_insumo"("empresaId", "periodo", "areaId");
CREATE INDEX "entregas_insumo_organizacionId_idx" ON "entregas_insumo"("organizacionId");
CREATE INDEX "entregas_insumo_empresaId_periodo_idx" ON "entregas_insumo"("empresaId", "periodo");

-- Bitácora de eventos de tarea (cambios de estado, entregas…).
CREATE TABLE "eventos_tarea" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_tarea_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "eventos_tarea_organizacionId_idx" ON "eventos_tarea"("organizacionId");
CREATE INDEX "eventos_tarea_tareaId_idx" ON "eventos_tarea"("tareaId");

-- Llaves foráneas
ALTER TABLE "entregas_insumo" ADD CONSTRAINT "entregas_insumo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entregas_insumo" ADD CONSTRAINT "entregas_insumo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entregas_insumo" ADD CONSTRAINT "entregas_insumo_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entregas_insumo" ADD CONSTRAINT "entregas_insumo_entregadoPorId_fkey" FOREIGN KEY ("entregadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "eventos_tarea" ADD CONSTRAINT "eventos_tarea_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_tarea" ADD CONSTRAINT "eventos_tarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_tarea" ADD CONSTRAINT "eventos_tarea_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insumo provisto por el cliente (auxiliar externo) por área. Cuando es true, la
-- captura no depende de la firma: la entrega se marca a mano (recepción del cliente).
ALTER TABLE "asignacion_cliente_area" ADD COLUMN "insumoCliente" BOOLEAN NOT NULL DEFAULT false;
