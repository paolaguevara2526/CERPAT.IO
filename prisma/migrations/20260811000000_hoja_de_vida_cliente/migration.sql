-- Hoja de vida del cliente: identificación, notificación y los datos que hoy
-- viven en carpetas y correos. Todo ADITIVO (columnas nulables y tablas nuevas),
-- así que no altera nada de lo que ya está cargado.
--
-- NOTA: no hay campos de usuario/contraseña a propósito. Guardar credenciales de
-- los clientes convierte una filtración de la base en una filtración de SUS
-- cuentas, bajo custodia de la firma (Ley 1581). Solo se deja constancia de
-- quién tiene el acceso y dónde está la clave.

ALTER TABLE "empresas" ADD COLUMN "direccion" TEXT;
ALTER TABLE "empresas" ADD COLUMN "emailDian" TEXT;
ALTER TABLE "empresas" ADD COLUMN "telefonoDian" TEXT;
ALTER TABLE "empresas" ADD COLUMN "emailCamara" TEXT;
ALTER TABLE "empresas" ADD COLUMN "telefonoCamara" TEXT;
ALTER TABLE "empresas" ADD COLUMN "fechaConstitucion" TIMESTAMP(3);

CREATE TABLE "actividades_economicas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "actividades_economicas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "actividades_economicas_organizacionId_idx" ON "actividades_economicas"("organizacionId");
CREATE INDEX "actividades_economicas_empresaId_idx" ON "actividades_economicas"("empresaId");
ALTER TABLE "actividades_economicas" ADD CONSTRAINT "actividades_economicas_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "representantes_legales" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "cargo" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "desde" TIMESTAMP(3),
    "hasta" TIMESTAMP(3),
    "email" TEXT,
    "telefono" TEXT,
    CONSTRAINT "representantes_legales_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "representantes_legales_organizacionId_idx" ON "representantes_legales"("organizacionId");
CREATE INDEX "representantes_legales_empresaId_idx" ON "representantes_legales"("empresaId");
ALTER TABLE "representantes_legales" ADD CONSTRAINT "representantes_legales_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "registros_camara" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "camara" TEXT NOT NULL,
    "matricula" TEXT,
    "responsableId" TEXT,
    "ubicacionClave" TEXT,
    "notas" TEXT,
    CONSTRAINT "registros_camara_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "registros_camara_organizacionId_idx" ON "registros_camara"("organizacionId");
CREATE INDEX "registros_camara_empresaId_idx" ON "registros_camara"("empresaId");
ALTER TABLE "registros_camara" ADD CONSTRAINT "registros_camara_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registros_camara" ADD CONSTRAINT "registros_camara_responsableId_fkey"
    FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
