-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('por_iniciar', 'en_curso', 'en_revision', 'terminado', 'auditado', 'no_realizado');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('alta', 'media', 'baja');

-- CreateEnum
CREATE TYPE "EstadoAuditoria" AS ENUM ('pendiente', 'aprobada', 'rechazada');

-- CreateEnum
CREATE TYPE "EstadoSubtarea" AS ENUM ('pendiente', 'realizada', 'no_aplica', 'no_realizada');

-- CreateEnum
CREATE TYPE "RiesgoNivel" AS ENUM ('alto', 'medio', 'bajo');

-- CreateEnum
CREATE TYPE "EstadoHallazgo" AS ENUM ('pendiente', 'en_gestion', 'resuelto');

-- CreateEnum
CREATE TYPE "EstadoTareaPago" AS ENUM ('por_iniciar', 'en_curso', 'terminado');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('pendiente', 'presentado_sin_pago', 'presentado_pagado', 'presentado_cero', 'no_presentado', 'no_obligado');

-- CreateTable
CREATE TABLE "organizaciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nit" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "cargo" TEXT,
    "area" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "esRootPlataforma" BOOLEAN NOT NULL DEFAULT false,
    "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false,
    "ultimoLogin" TIMESTAMP(3),
    "empresaClienteId" TEXT,
    "grupoClienteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_roles" (
    "usuarioId" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,

    CONSTRAINT "usuario_roles_pkey" PRIMARY KEY ("usuarioId","rolId")
);

-- CreateTable
CREATE TABLE "asesores" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuarioId" TEXT,

    CONSTRAINT "asesores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "tipoId" TEXT,
    "sectorId" TEXT,
    "regimenId" TEXT,
    "periodicidadIvaId" TEXT,
    "municipioId" TEXT,
    "grupoId" TEXT,
    "servicio" TEXT,
    "asesorNombre" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "emailRepresentante" TEXT,
    "emailAdministracion" TEXT,
    "emailContabilidad" TEXT,
    "emailTalentoHumano" TEXT,
    "emailTesoreria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_empresariales" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "grupos_empresariales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hallazgos" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "area" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "normatividad" TEXT,
    "riesgo" "RiesgoNivel" NOT NULL DEFAULT 'medio',
    "riesgoDescripcion" TEXT,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'media',
    "responsable" TEXT,
    "planAccion" TEXT,
    "plazo" TIMESTAMP(3),
    "estado" "EstadoHallazgo" NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hallazgos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_tipos_empresa" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_tipos_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_sectores" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_sectores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_regimenes_tributarios" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_regimenes_tributarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_periodicidades_iva" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_periodicidades_iva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_tipos_servicio" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_tipos_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_municipios" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_municipios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_tipos_tarea" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_tipos_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_tipos_obligacion" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_tipos_obligacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_periodicidades" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cat_periodicidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_etiquetas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "cat_etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'por_iniciar',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'media',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "tipoTareaId" TEXT,
    "tipoObligacionId" TEXT,
    "periodicidadId" TEXT,
    "auditoria" "EstadoAuditoria" NOT NULL DEFAULT 'pendiente',
    "requiereRevisionTecnica" BOOLEAN NOT NULL DEFAULT false,
    "generaPago" BOOLEAN NOT NULL DEFAULT false,
    "valorPago" DECIMAL(14,2),
    "estadoPago" "EstadoPago" NOT NULL DEFAULT 'pendiente',
    "generaIneficacia" BOOLEAN NOT NULL DEFAULT false,
    "requiereSoporte" BOOLEAN NOT NULL DEFAULT false,
    "soporteLink" TEXT,
    "interno" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "actividadPlanId" TEXT,
    "areaId" TEXT,
    "periodo" TEXT,
    "asesorId" TEXT,
    "auxiliarId" TEXT,
    "comprobanteDesde" TEXT,
    "comprobanteHasta" TEXT,
    "cantidadRegistros" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea_asignados" (
    "tareaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "tarea_asignados_pkey" PRIMARY KEY ("tareaId","usuarioId")
);

-- CreateTable
CREATE TABLE "tarea_etiquetas" (
    "tareaId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,

    CONSTRAINT "tarea_etiquetas_pkey" PRIMARY KEY ("tareaId","etiquetaId")
);

-- CreateTable
CREATE TABLE "subtareas" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "estado" "EstadoSubtarea" NOT NULL DEFAULT 'pendiente',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subtareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "obligacionId" TEXT,
    "obligacionTexto" TEXT,
    "periodicidad" TEXT,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estadoTarea" "EstadoTareaPago" NOT NULL DEFAULT 'por_iniciar',
    "estadoPago" "EstadoPago" NOT NULL DEFAULT 'pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vencimientos" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "obligacionId" TEXT,
    "municipio" TEXT,
    "periodo" TEXT,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "nitRango" TEXT,

    CONSTRAINT "vencimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_liquidacion" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tasaMoraMensual" DECIMAL(6,4) NOT NULL DEFAULT 0.2679,
    "valorUvt" DECIMAL(12,2) NOT NULL DEFAULT 52374,
    "smmlv" DECIMAL(12,2) NOT NULL DEFAULT 1423500,
    "sancionMinimaUvt" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "pctSancionExtemporaneidad" DECIMAL(5,4) NOT NULL DEFAULT 0.05,

    CONSTRAINT "parametros_liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apariencia" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombreApp" TEXT NOT NULL DEFAULT 'Planeador',
    "subtitulo" TEXT NOT NULL DEFAULT 'Sistema de Gestión y Planificación',
    "colorPrimario" TEXT NOT NULL DEFAULT '#34C98B',

    CONSTRAINT "apariencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividades_plan" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "areaId" TEXT,
    "grupo" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "documentoFormato" TEXT,
    "periodicidad" TEXT,
    "esRegistroSoftware" BOOLEAN NOT NULL DEFAULT false,
    "requiereAuditoria" BOOLEAN NOT NULL DEFAULT false,
    "generaPago" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "actividades_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtareas_plantilla" (
    "id" TEXT NOT NULL,
    "actividadPlanId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subtareas_plantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_cliente_actividad" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "actividadPlanId" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "periodicidad" TEXT,

    CONSTRAINT "plan_cliente_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_cliente_area" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "asesorId" TEXT,
    "auxiliarId" TEXT,
    "talla" TEXT,

    CONSTRAINT "asignacion_cliente_area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_tributaria" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ivaPeriodicidad" TEXT,
    "retencionFuente" BOOLEAN NOT NULL DEFAULT false,
    "consumoPeriodicidad" TEXT,
    "rentaTipo" TEXT,
    "anticipoRstPeriodicidad" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_tributaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa_municipio_ica" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "icaPeriodicidad" TEXT,
    "reteica" BOOLEAN NOT NULL DEFAULT false,
    "reteicaPeriodicidad" TEXT,
    "autoica" BOOLEAN NOT NULL DEFAULT false,
    "autoicaPeriodicidad" TEXT,

    CONSTRAINT "empresa_municipio_ica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vencimientos_empresa" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "obligacion" TEXT NOT NULL,
    "periodicidad" TEXT,
    "periodo" TEXT,
    "municipioId" TEXT,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'pendiente',
    "generado" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "soporteLink" TEXT,
    "valorPago" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vencimientos_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizaciones_slug_key" ON "organizaciones"("slug");

-- CreateIndex
CREATE INDEX "usuarios_organizacionId_idx" ON "usuarios"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_organizacionId_email_key" ON "usuarios"("organizacionId", "email");

-- CreateIndex
CREATE INDEX "roles_organizacionId_idx" ON "roles"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organizacionId_nombre_key" ON "roles"("organizacionId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "asesores_usuarioId_key" ON "asesores"("usuarioId");

-- CreateIndex
CREATE INDEX "asesores_organizacionId_idx" ON "asesores"("organizacionId");

-- CreateIndex
CREATE INDEX "empresas_organizacionId_idx" ON "empresas"("organizacionId");

-- CreateIndex
CREATE INDEX "grupos_empresariales_organizacionId_idx" ON "grupos_empresariales"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_empresariales_organizacionId_nombre_key" ON "grupos_empresariales"("organizacionId", "nombre");

-- CreateIndex
CREATE INDEX "hallazgos_organizacionId_idx" ON "hallazgos"("organizacionId");

-- CreateIndex
CREATE INDEX "hallazgos_empresaId_idx" ON "hallazgos"("empresaId");

-- CreateIndex
CREATE INDEX "hallazgos_estado_idx" ON "hallazgos"("estado");

-- CreateIndex
CREATE INDEX "cat_tipos_empresa_organizacionId_idx" ON "cat_tipos_empresa"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_sectores_organizacionId_idx" ON "cat_sectores"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_regimenes_tributarios_organizacionId_idx" ON "cat_regimenes_tributarios"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_periodicidades_iva_organizacionId_idx" ON "cat_periodicidades_iva"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_tipos_servicio_organizacionId_idx" ON "cat_tipos_servicio"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_municipios_organizacionId_idx" ON "cat_municipios"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_tipos_tarea_organizacionId_idx" ON "cat_tipos_tarea"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_tipos_obligacion_organizacionId_idx" ON "cat_tipos_obligacion"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_periodicidades_organizacionId_idx" ON "cat_periodicidades"("organizacionId");

-- CreateIndex
CREATE INDEX "cat_etiquetas_organizacionId_idx" ON "cat_etiquetas"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "cat_etiquetas_organizacionId_nombre_key" ON "cat_etiquetas"("organizacionId", "nombre");

-- CreateIndex
CREATE INDEX "tareas_organizacionId_idx" ON "tareas"("organizacionId");

-- CreateIndex
CREATE INDEX "tareas_fechaVencimiento_idx" ON "tareas"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "tareas_estado_idx" ON "tareas"("estado");

-- CreateIndex
CREATE INDEX "tareas_empresaId_idx" ON "tareas"("empresaId");

-- CreateIndex
CREATE INDEX "tareas_actividadPlanId_idx" ON "tareas"("actividadPlanId");

-- CreateIndex
CREATE INDEX "tareas_areaId_idx" ON "tareas"("areaId");

-- CreateIndex
CREATE INDEX "pagos_organizacionId_idx" ON "pagos"("organizacionId");

-- CreateIndex
CREATE INDEX "pagos_fechaVencimiento_idx" ON "pagos"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "pagos_empresaId_idx" ON "pagos"("empresaId");

-- CreateIndex
CREATE INDEX "vencimientos_organizacionId_idx" ON "vencimientos"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_liquidacion_organizacionId_key" ON "parametros_liquidacion"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "apariencia_organizacionId_key" ON "apariencia"("organizacionId");

-- CreateIndex
CREATE INDEX "areas_organizacionId_idx" ON "areas"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "areas_organizacionId_nombre_key" ON "areas"("organizacionId", "nombre");

-- CreateIndex
CREATE INDEX "actividades_plan_organizacionId_idx" ON "actividades_plan"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "actividades_plan_organizacionId_codigo_key" ON "actividades_plan"("organizacionId", "codigo");

-- CreateIndex
CREATE INDEX "plan_cliente_actividad_organizacionId_idx" ON "plan_cliente_actividad"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_cliente_actividad_empresaId_actividadPlanId_key" ON "plan_cliente_actividad"("empresaId", "actividadPlanId");

-- CreateIndex
CREATE INDEX "asignacion_cliente_area_organizacionId_idx" ON "asignacion_cliente_area"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_cliente_area_empresaId_areaId_key" ON "asignacion_cliente_area"("empresaId", "areaId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_tributaria_empresaId_key" ON "configuracion_tributaria"("empresaId");

-- CreateIndex
CREATE INDEX "configuracion_tributaria_organizacionId_idx" ON "configuracion_tributaria"("organizacionId");

-- CreateIndex
CREATE INDEX "empresa_municipio_ica_organizacionId_idx" ON "empresa_municipio_ica"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_municipio_ica_empresaId_municipioId_key" ON "empresa_municipio_ica"("empresaId", "municipioId");

-- CreateIndex
CREATE INDEX "vencimientos_empresa_organizacionId_idx" ON "vencimientos_empresa"("organizacionId");

-- CreateIndex
CREATE INDEX "vencimientos_empresa_empresaId_idx" ON "vencimientos_empresa"("empresaId");

-- CreateIndex
CREATE INDEX "vencimientos_empresa_anio_idx" ON "vencimientos_empresa"("anio");

-- CreateIndex
CREATE INDEX "vencimientos_empresa_fechaVencimiento_idx" ON "vencimientos_empresa"("fechaVencimiento");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaClienteId_fkey" FOREIGN KEY ("empresaClienteId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_grupoClienteId_fkey" FOREIGN KEY ("grupoClienteId") REFERENCES "grupos_empresariales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asesores" ADD CONSTRAINT "asesores_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asesores" ADD CONSTRAINT "asesores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "cat_tipos_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "cat_sectores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_regimenId_fkey" FOREIGN KEY ("regimenId") REFERENCES "cat_regimenes_tributarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_periodicidadIvaId_fkey" FOREIGN KEY ("periodicidadIvaId") REFERENCES "cat_periodicidades_iva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "cat_municipios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_empresariales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_empresariales" ADD CONSTRAINT "grupos_empresariales_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgos" ADD CONSTRAINT "hallazgos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgos" ADD CONSTRAINT "hallazgos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgos" ADD CONSTRAINT "hallazgos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_tipos_empresa" ADD CONSTRAINT "cat_tipos_empresa_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_sectores" ADD CONSTRAINT "cat_sectores_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_regimenes_tributarios" ADD CONSTRAINT "cat_regimenes_tributarios_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_periodicidades_iva" ADD CONSTRAINT "cat_periodicidades_iva_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_tipos_servicio" ADD CONSTRAINT "cat_tipos_servicio_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_municipios" ADD CONSTRAINT "cat_municipios_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_tipos_tarea" ADD CONSTRAINT "cat_tipos_tarea_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_tipos_obligacion" ADD CONSTRAINT "cat_tipos_obligacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_periodicidades" ADD CONSTRAINT "cat_periodicidades_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_etiquetas" ADD CONSTRAINT "cat_etiquetas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_tipoTareaId_fkey" FOREIGN KEY ("tipoTareaId") REFERENCES "cat_tipos_tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_tipoObligacionId_fkey" FOREIGN KEY ("tipoObligacionId") REFERENCES "cat_tipos_obligacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_periodicidadId_fkey" FOREIGN KEY ("periodicidadId") REFERENCES "cat_periodicidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_actividadPlanId_fkey" FOREIGN KEY ("actividadPlanId") REFERENCES "actividades_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_auxiliarId_fkey" FOREIGN KEY ("auxiliarId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_asignados" ADD CONSTRAINT "tarea_asignados_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_asignados" ADD CONSTRAINT "tarea_asignados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_etiquetas" ADD CONSTRAINT "tarea_etiquetas_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_etiquetas" ADD CONSTRAINT "tarea_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "cat_etiquetas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtareas" ADD CONSTRAINT "subtareas_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "cat_tipos_obligacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vencimientos" ADD CONSTRAINT "vencimientos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vencimientos" ADD CONSTRAINT "vencimientos_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "cat_tipos_obligacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_liquidacion" ADD CONSTRAINT "parametros_liquidacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apariencia" ADD CONSTRAINT "apariencia_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades_plan" ADD CONSTRAINT "actividades_plan_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades_plan" ADD CONSTRAINT "actividades_plan_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtareas_plantilla" ADD CONSTRAINT "subtareas_plantilla_actividadPlanId_fkey" FOREIGN KEY ("actividadPlanId") REFERENCES "actividades_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_cliente_actividad" ADD CONSTRAINT "plan_cliente_actividad_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_cliente_actividad" ADD CONSTRAINT "plan_cliente_actividad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_cliente_actividad" ADD CONSTRAINT "plan_cliente_actividad_actividadPlanId_fkey" FOREIGN KEY ("actividadPlanId") REFERENCES "actividades_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_cliente_area" ADD CONSTRAINT "asignacion_cliente_area_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_cliente_area" ADD CONSTRAINT "asignacion_cliente_area_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_cliente_area" ADD CONSTRAINT "asignacion_cliente_area_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_cliente_area" ADD CONSTRAINT "asignacion_cliente_area_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_cliente_area" ADD CONSTRAINT "asignacion_cliente_area_auxiliarId_fkey" FOREIGN KEY ("auxiliarId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_tributaria" ADD CONSTRAINT "configuracion_tributaria_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_tributaria" ADD CONSTRAINT "configuracion_tributaria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_municipio_ica" ADD CONSTRAINT "empresa_municipio_ica_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_municipio_ica" ADD CONSTRAINT "empresa_municipio_ica_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_municipio_ica" ADD CONSTRAINT "empresa_municipio_ica_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "cat_municipios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vencimientos_empresa" ADD CONSTRAINT "vencimientos_empresa_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vencimientos_empresa" ADD CONSTRAINT "vencimientos_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vencimientos_empresa" ADD CONSTRAINT "vencimientos_empresa_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "cat_municipios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

