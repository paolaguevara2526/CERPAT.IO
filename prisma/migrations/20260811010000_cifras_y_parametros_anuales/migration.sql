-- Cifras del cliente por año y UVT/SMMLV por año.
--
-- Los topes de las normas (Art. 606, Ley 43/90, Art. 600, Art. 905, Art. 368-2,
-- Dto. 1998/17) se expresan en UVT o SMMLV y se comparan contra el "año
-- inmediatamente anterior". Con un valor único de UVT, en enero todos esos
-- cálculos quedan mal y nadie se entera: por eso van por año.
--
-- Aditivo: tablas nuevas, no toca nada existente.

CREATE TABLE "cifras_fiscales" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "activosBrutos" DECIMAL(18,2),
    "ingresosBrutos" DECIMAL(18,2),
    "fuente" TEXT,
    "notas" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cifras_fiscales_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cifras_fiscales_empresaId_anio_key" ON "cifras_fiscales"("empresaId", "anio");
CREATE INDEX "cifras_fiscales_organizacionId_idx" ON "cifras_fiscales"("organizacionId");
ALTER TABLE "cifras_fiscales" ADD CONSTRAINT "cifras_fiscales_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "parametros_anuales" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "uvt" DECIMAL(12,2) NOT NULL,
    "smmlv" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "parametros_anuales_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "parametros_anuales_organizacionId_anio_key" ON "parametros_anuales"("organizacionId", "anio");
ALTER TABLE "parametros_anuales" ADD CONSTRAINT "parametros_anuales_organizacionId_fkey"
    FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A PROPÓSITO no se siembran valores de UVT/SMMLV. Un valor equivocado aquí
-- produce obligaciones equivocadas en silencio —justo lo que hay que evitar—, y
-- los de años pasados no se pueden dar por supuestos. Los carga el equipo en
-- Administración → Parámetros por año, y las reglas se niegan a calcular
-- mientras falte el año que necesitan.
