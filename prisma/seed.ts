// prisma/seed.ts
// Siembra multi-tenant: crea el usuario root de plataforma, una organización
// demo (la firma "CERPAT") y, dentro de ella, roles, catálogos, parámetros y
// apariencia. Es idempotente (upsert por ids fijos "seed-...").
// Ejecutar con: npx prisma db seed  (o: npx tsx prisma/seed.ts)
//
// Nota: los usuarios se crean con passwordHash vacío ("") como marcador — con un
// hash vacío ninguna contraseña verifica, así que la cuenta queda inerte hasta
// que el flujo de auth (bcrypt/argon2) fije un hash real. No hay credenciales en
// texto plano en el código.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ORG_ID = 'seed-org-cerpat';

async function main() {
  // ---------- Organización demo (tenant) ----------
  await prisma.organizacion.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, nombre: 'CERPAT', slug: 'cerpat', nit: '900000000-0', activo: true },
  });

  // ---------- Usuario root de plataforma (fuera de toda organización) ----------
  await prisma.usuario.upsert({
    where: { id: 'seed-root' },
    update: {},
    create: {
      id: 'seed-root',
      organizacionId: null,
      nombre: 'Root Plataforma',
      email: 'root@planeador.app',
      passwordHash: '', // marcador: se fija en el bootstrap de auth
      esRootPlataforma: true,
      activo: true,
    },
  });

  // ---------- Roles (por organización) ----------
  const roles = ['Administrador', 'Asesor', 'Auditor', 'Auxiliar', 'Coordinador'];
  const rolIds: Record<string, string> = {};
  for (const [i, nombre] of roles.entries()) {
    const id = `seed-rol-${i}`;
    rolIds[nombre] = id;
    await prisma.rol.upsert({
      where: { organizacionId_nombre: { organizacionId: ORG_ID, nombre } },
      update: {},
      create: { id, organizacionId: ORG_ID, nombre },
    });
  }

  // ---------- Administrador de la organización ----------
  await prisma.usuario.upsert({
    where: { organizacionId_email: { organizacionId: ORG_ID, email: 'admin@cerpat.com' } },
    update: {},
    create: {
      id: 'seed-admin',
      organizacionId: ORG_ID,
      nombre: 'Administrador CERPAT',
      email: 'admin@cerpat.com',
      passwordHash: '', // marcador: se fija en el bootstrap de auth
      activo: true,
      roles: { create: [{ rolId: rolIds['Administrador'] }] },
    },
  });

  // ---------- Catálogos: Tipos de Empresa ----------
  const tiposEmpresa = ['Persona Jurídica', 'Persona Natural', 'Consorcio o Unión Temporal', 'Sucursal Extranjera'];
  for (const [i, nombre] of tiposEmpresa.entries()) {
    await prisma.tipoEmpresa.upsert({ where: { id: `seed-tipo-empresa-${i}` }, update: {}, create: { id: `seed-tipo-empresa-${i}`, organizacionId: ORG_ID, nombre, orden: i + 1 } });
  }

  // ---------- Catálogos: Sectores ----------
  const sectores = ['Construcción', 'Transporte', 'Comercial', 'Salud', 'Educación', 'Agropecuario', 'Tecnología'];
  for (const [i, nombre] of sectores.entries()) {
    await prisma.sector.upsert({ where: { id: `seed-sector-${i}` }, update: {}, create: { id: `seed-sector-${i}`, organizacionId: ORG_ID, nombre, orden: i + 1 } });
  }

  // ---------- Catálogos: Regímenes tributarios ----------
  const regimenes = ['Régimen Simple de Tributación (RST)', 'Régimen Ordinario', 'Régimen Especial', 'Gran Contribuyente'];
  for (const [i, nombre] of regimenes.entries()) {
    await prisma.regimenTributario.upsert({ where: { id: `seed-regimen-${i}` }, update: {}, create: { id: `seed-regimen-${i}`, organizacionId: ORG_ID, nombre, orden: i + 1 } });
  }

  // ---------- Catálogos: Periodicidades IVA ----------
  const periodicidadesIva = ['Bimestral', 'Cuatrimestral', 'Anual'];
  for (const [i, nombre] of periodicidadesIva.entries()) {
    await prisma.periodicidadIva.upsert({ where: { id: `seed-periva-${i}` }, update: {}, create: { id: `seed-periva-${i}`, organizacionId: ORG_ID, nombre, orden: i + 1 } });
  }

  // ---------- Catálogos: Tipos de servicio ----------
  const tiposServicio = ['Asesoría Contable', 'Outsourcing Contable', 'Auditoría Externa'];
  for (const [i, nombre] of tiposServicio.entries()) {
    await prisma.tipoServicio.upsert({ where: { id: `seed-tiposerv-${i}` }, update: {}, create: { id: `seed-tiposerv-${i}`, organizacionId: ORG_ID, nombre, orden: i + 1 } });
  }

  // ---------- Catálogos: Municipios ----------
  const municipios = [
    { nombre: 'Villavicencio', departamento: 'Meta' },
    { nombre: 'Acacías', departamento: 'Meta' },
    { nombre: 'Granada', departamento: 'Meta' },
    { nombre: 'Bogotá', departamento: 'Bogotá D.C.' },
  ];
  for (const [i, m] of municipios.entries()) {
    await prisma.municipio.upsert({ where: { id: `seed-municipio-${i}` }, update: {}, create: { id: `seed-municipio-${i}`, organizacionId: ORG_ID, nombre: m.nombre, departamento: m.departamento, orden: i + 1 } });
  }

  // ---------- Cat. Tareas: Tipos de tarea ----------
  const tiposTarea = ['Fiscal', 'Contable', 'Laboral', 'Legal', 'Auditoría', 'Visita'];
  for (const [i, nombre] of tiposTarea.entries()) {
    await prisma.tipoTarea.upsert({ where: { id: `seed-tipotarea-${i}` }, update: {}, create: { id: `seed-tipotarea-${i}`, organizacionId: ORG_ID, nombre, orden: i + 1 } });
  }

  // ---------- Cat. Tareas: Tipos de obligación ----------
  const tiposObligacion = ['IVA', 'Renta', 'Retención en la Fuente', 'Seguridad Social', 'Información Exógena', 'Otro'];
  for (const [i, nombre] of tiposObligacion.entries()) {
    await prisma.tipoObligacion.upsert({ where: { id: `seed-tipoobl-${i}` }, update: {}, create: { id: `seed-tipoobl-${i}`, organizacionId: ORG_ID, nombre, orden: i + 1 } });
  }

  // ---------- Cat. Tareas: Periodicidades ----------
  const periodicidades = ['Mensual', 'Bimestral', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual', 'Quincenal', 'Eventual'];
  for (const [i, nombre] of periodicidades.entries()) {
    await prisma.periodicidad.upsert({ where: { id: `seed-periodicidad-${i}` }, update: {}, create: { id: `seed-periodicidad-${i}`, organizacionId: ORG_ID, nombre, orden: i + 1 } });
  }

  // ---------- Cat. Tareas: Etiquetas ----------
  const etiquetas = ['Laboral', 'Nómina', 'Contable', 'Legal', 'Fiscal'];
  for (const nombre of etiquetas) {
    await prisma.etiqueta.upsert({
      where: { organizacionId_nombre: { organizacionId: ORG_ID, nombre } },
      update: {},
      create: { organizacionId: ORG_ID, nombre },
    });
  }

  // ---------- Áreas de la firma (Plan de Trabajo) ----------
  const areas = ['Impuestos', 'Informes', 'Cumplimiento', 'Nómina', 'Tesorería'];
  for (const [i, nombre] of areas.entries()) {
    await prisma.area.upsert({
      where: { organizacionId_nombre: { organizacionId: ORG_ID, nombre } },
      update: {},
      create: { organizacionId: ORG_ID, nombre, orden: i + 1 },
    });
  }

  // ---------- Parámetros del liquidador (fila única por organización) ----------
  await prisma.parametrosLiquidacion.upsert({
    where: { organizacionId: ORG_ID },
    update: {},
    create: {
      organizacionId: ORG_ID,
      tasaMoraMensual: 0.2679,
      valorUvt: 52374,
      smmlv: 1423500,
      sancionMinimaUvt: 10,
      pctSancionExtemporaneidad: 0.05,
    },
  });

  // ---------- Apariencia (fila única por organización) ----------
  await prisma.apariencia.upsert({
    where: { organizacionId: ORG_ID },
    update: {},
    create: { organizacionId: ORG_ID, nombreApp: 'Planeador', subtitulo: 'Sistema de Gestión y Planificación', colorPrimario: '#34C98B' },
  });

  console.log('✓ Seed completado: root, organización demo (CERPAT), roles (incl. Coordinador), áreas y catálogos base cargados.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
