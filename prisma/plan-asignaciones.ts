// prisma/plan-asignaciones.ts
// Asignación automática "por área del empleado": para cada empresa × área del
// plan, reparte (round-robin) un asesor responsable y un auxiliar ejecutor entre
// las personas de esa área, y rellena esos ejes en las tareas ya generadas.
//
// Es un punto de partida aproximado: luego se ajusta por cliente si hace falta.
// Idempotente: upsert por (empresaId, areaId) y updateMany sobre las tareas.
//
// Requiere usuarios cargados (db:import-usuarios) y el plan generado
// (db:plan-asignar + db:plan-generar). Ejecutar con:
//   npx tsx prisma/plan-asignaciones.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';

// Normaliza para comparar áreas sin depender de acentos/mayúsculas.
const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

async function main() {
  const org = await prisma.organizacion.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error('No existe la organización demo (corre el seed primero).');

  const areas = await prisma.area.findMany({ where: { organizacionId: ORG_ID } });
  const empresas = await prisma.empresa.findMany({ where: { organizacionId: ORG_ID }, select: { id: true }, orderBy: { id: 'asc' } });

  // Usuarios con sus roles (para saber quién es Asesor / Auxiliar / Coordinador).
  const usuarios = await prisma.usuario.findMany({
    where: { organizacionId: ORG_ID, activo: true },
    select: { id: true, area: true, roles: { select: { rol: { select: { nombre: true } } } } },
  });
  const rolesDe = (u: (typeof usuarios)[number]) => u.roles.map((r) => r.rol.nombre);

  // Pools por área del plan: asesores (rol Asesor; si no hay, Coordinador como
  // responsable) y auxiliares (rol Auxiliar).
  const pools = new Map<string, { asesores: string[]; auxiliares: string[] }>();
  for (const a of areas) {
    const key = norm(a.nombre);
    const enArea = usuarios.filter((u) => norm(u.area) === key);
    let asesores = enArea.filter((u) => rolesDe(u).includes('Asesor')).map((u) => u.id);
    if (asesores.length === 0) asesores = enArea.filter((u) => rolesDe(u).includes('Coordinador')).map((u) => u.id);
    const auxiliares = enArea.filter((u) => rolesDe(u).includes('Auxiliar')).map((u) => u.id);
    pools.set(a.id, { asesores, auxiliares });
  }

  // 1) Crea/actualiza AsignacionClienteArea repartiendo round-robin por empresa.
  let asignaciones = 0;
  const asignMap = new Map<string, { asesorId: string | null; auxiliarId: string | null }>();
  for (let i = 0; i < empresas.length; i++) {
    const empresaId = empresas[i].id;
    for (const a of areas) {
      const pool = pools.get(a.id)!;
      const asesorId = pool.asesores.length ? pool.asesores[i % pool.asesores.length] : null;
      const auxiliarId = pool.auxiliares.length ? pool.auxiliares[i % pool.auxiliares.length] : null;
      asignMap.set(`${empresaId}|${a.id}`, { asesorId, auxiliarId });
      await prisma.asignacionClienteArea.upsert({
        where: { empresaId_areaId: { empresaId, areaId: a.id } },
        update: { asesorId, auxiliarId },
        create: { organizacionId: ORG_ID, empresaId, areaId: a.id, asesorId, auxiliarId, talla: 'M' },
      });
      asignaciones++;
    }
  }

  // 2) Backfill de las tareas del plan ya generadas (todas las de cada empresa×área).
  let tareasActualizadas = 0;
  for (const [key, val] of asignMap) {
    const [empresaId, areaId] = key.split('|');
    const res = await prisma.tarea.updateMany({
      where: { organizacionId: ORG_ID, empresaId, areaId, actividadPlanId: { not: null } },
      data: { asesorId: val.asesorId, auxiliarId: val.auxiliarId },
    });
    tareasActualizadas += res.count;
  }

  console.log(`✓ Asignaciones por área: ${asignaciones} filas (empresas ${empresas.length} × áreas ${areas.length}).`);
  console.log(`  Tareas del plan actualizadas con asesor/auxiliar: ${tareasActualizadas}.`);
  for (const a of areas) {
    const p = pools.get(a.id)!;
    console.log(`  · ${a.nombre}: asesores ${p.asesores.length}, auxiliares ${p.auxiliares.length}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
