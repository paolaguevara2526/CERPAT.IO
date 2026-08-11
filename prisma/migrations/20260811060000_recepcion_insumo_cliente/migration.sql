-- Recepción del insumo del cliente. En las áreas marcadas como "insumo del
-- cliente" no hay auxiliar que capture ni que libere, así que hasta ahora nada
-- las destrababa nunca: el trabajo quedaba esperando una liberación que no
-- llegaba. Ahora el asesor (o el auxiliar del área) marca la recepción.
--
-- Aditivo: una columna con valor por defecto y una tabla nueva.

-- Cuándo se REGISTRÓ la marca, que no es lo mismo que cuándo llegó el insumo:
-- "entregadoEn" es la fecha que declara quien recibe (el cliente manda el 3 y se
-- marca el 5), y de ella sale la demora que se le atribuye al cliente. Grabar
-- solo "hoy" le cargaría días que no son suyos.
ALTER TABLE "entregas_insumo" ADD COLUMN "marcadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Rastro de marcas y desmarcas.
--
-- SIN llave foránea a entregas_insumo a propósito: desmarcar borra esa fila, y un
-- rastro que se borra junto con lo que quería auditar no sirve para nada. Se
-- guarda la coordenada (empresa · área · período) y sobrevive por su cuenta.
CREATE TABLE "eventos_insumo" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "areaId" TEXT,
    "periodo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3),
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_insumo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "eventos_insumo_organizacionId_idx" ON "eventos_insumo"("organizacionId");
CREATE INDEX "eventos_insumo_empresaId_periodo_idx" ON "eventos_insumo"("empresaId", "periodo");

ALTER TABLE "eventos_insumo" ADD CONSTRAINT "eventos_insumo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_insumo" ADD CONSTRAINT "eventos_insumo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_insumo" ADD CONSTRAINT "eventos_insumo_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "eventos_insumo" ADD CONSTRAINT "eventos_insumo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
