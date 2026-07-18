// prisma/seed.ts
// Carga los catálogos y parámetros por defecto, tal como estaban en el prototipo.
// Ejecutar con: npx prisma db seed

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Roles base
  const roles = ['Administrador', 'Asesor', 'Auditor', 'Auxiliar'];
  for (const nombre of roles) {
    await prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // Catálogos: Tipos de Empresa
  const tiposEmpresa = ['Persona Jurídica', 'Persona Natural', 'Consorcio o Unión Temporal', 'Sucursal Extranjera'];
  for (const [i, nombre] of tiposEmpresa.entries()) {
    await prisma.tipoEmpresa.upsert({ where: { id: `seed-tipo-empresa-${i}` }, update: {}, create: { id: `seed-tipo-empresa-${i}`, nombre, orden: i + 1 } });
  }

  // Catálogos: Sectores
  const sectores = ['Construcción', 'Transporte', 'Comercial', 'Salud', 'Educación', 'Agropecuario', 'Tecnología'];
  for (const [i, nombre] of sectores.entries()) {
    await prisma.sector.upsert({ where: { id: `seed-sector-${i}` }, update: {}, create: { id: `seed-sector-${i}`, nombre, orden: i + 1 } });
  }

  // Catálogos: Regímenes tributarios
  const regimenes = ['Régimen Simple de Tributación (RST)', 'Régimen Ordinario', 'Régimen Especial', 'Gran Contribuyente'];
  for (const [i, nombre] of regimenes.entries()) {
    await prisma.regimenTributario.upsert({ where: { id: `seed-regimen-${i}` }, update: {}, create: { id: `seed-regimen-${i}`, nombre, orden: i + 1 } });
  }

  // Catálogos: Periodicidades IVA
  const periodicidadesIva = ['Bimestral', 'Cuatrimestral', 'Anual'];
  for (const [i, nombre] of periodicidadesIva.entries()) {
    await prisma.periodicidadIva.upsert({ where: { id: `seed-periva-${i}` }, update: {}, create: { id: `seed-periva-${i}`, nombre, orden: i + 1 } });
  }

  // Catálogos: Tipos de servicio
  const tiposServicio = ['Asesoría Contable', 'Outsourcing Contable', 'Auditoría Externa'];
  for (const [i, nombre] of tiposServicio.entries()) {
    await prisma.tipoServicio.upsert({ where: { id: `seed-tiposerv-${i}` }, update: {}, create: { id: `seed-tiposerv-${i}`, nombre, orden: i + 1 } });
  }

  // Cat. Tareas: Tipos de tarea
  const tiposTarea = ['Fiscal', 'Contable', 'Laboral', 'Legal', 'Auditoría', 'Visita'];
  for (const [i, nombre] of tiposTarea.entries()) {
    await prisma.tipoTarea.upsert({ where: { id: `seed-tipotarea-${i}` }, update: {}, create: { id: `seed-tipotarea-${i}`, nombre, orden: i + 1 } });
  }

  // Cat. Tareas: Tipos de obligación
  const tiposObligacion = ['IVA', 'Renta', 'Retención en la Fuente', 'Seguridad Social', 'Información Exógena', 'Otro'];
  for (const [i, nombre] of tiposObligacion.entries()) {
    await prisma.tipoObligacion.upsert({ where: { id: `seed-tipoobl-${i}` }, update: {}, create: { id: `seed-tipoobl-${i}`, nombre, orden: i + 1 } });
  }

  // Cat. Tareas: Periodicidades
  const periodicidades = ['Mensual', 'Bimestral', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual', 'Quincenal', 'Eventual'];
  for (const [i, nombre] of periodicidades.entries()) {
    await prisma.periodicidad.upsert({ where: { id: `seed-periodicidad-${i}` }, update: {}, create: { id: `seed-periodicidad-${i}`, nombre, orden: i + 1 } });
  }

  // Cat. Tareas: Etiquetas
  const etiquetas = ['Laboral', 'Nómina', 'Contable', 'Legal', 'Fiscal'];
  for (const nombre of etiquetas) {
    await prisma.etiqueta.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // Parámetros del liquidador (fila única)
  const parametrosExistentes = await prisma.parametrosLiquidacion.findFirst();
  if (!parametrosExistentes) {
    await prisma.parametrosLiquidacion.create({
      data: {
        tasaMoraMensual: 0.2679,
        valorUvt: 52374,
        smmlv: 1423500,
        sancionMinimaUvt: 10,
        pctSancionExtemporaneidad: 0.05,
      },
    });
  }

  // Apariencia (fila única)
  const aparienciaExistente = await prisma.apariencia.findFirst();
  if (!aparienciaExistente) {
    await prisma.apariencia.create({
      data: { nombreApp: 'Planeador', subtitulo: 'Sistema de Gestión y Planificación', colorPrimario: '#34C98B' },
    });
  }

  console.log('✓ Seed completado: roles y catálogos base cargados.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
