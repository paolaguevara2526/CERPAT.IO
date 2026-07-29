// prisma/import-usuarios.ts
// Importa el personal de CERPAT (prisma/data/usuarios-cerpat.csv) a la tabla
// Usuario, bajo la organización demo (seed-org-cerpat), y le asigna su rol.
// Idempotente: upsert por (organizacionId, email), así que puede re-ejecutarse.
//
// Requiere el esquema aplicado y el seed corrido antes (organización + roles).
// Ejecutar con:  npx tsx prisma/import-usuarios.ts
//
// Sólo campos operativos: nombre, correo corporativo, cargo, área y rol. NO se
// importan datos sensibles del archivo de personal (cédula, salario, cuenta
// bancaria, salud, contactos personales, contraseñas): quedan fuera del repo.
// Los usuarios se crean con passwordHash vacío ("") como marcador — la clave se
// fija cuando se implemente el bootstrap de autenticación.

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-cerpat';
const CSV_PATH = path.resolve(process.cwd(), 'prisma/data/usuarios-cerpat.csv');

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const nn = (s: string | undefined) => { const v = (s || '').trim(); return v.length ? v : null; };

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(raw);
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const data = rows.slice(1).filter((r) => (r[idx('email')] || '').trim());

  const org = await prisma.organizacion.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error('No existe la organización demo (corre el seed primero).');

  // Roles de la organización, para asignar por nombre.
  const roles = await prisma.rol.findMany({ where: { organizacionId: ORG_ID } });
  const rolIdByName = new Map(roles.map((r) => [r.nombre, r.id]));

  let creados = 0, actualizados = 0;
  const rolesNoEncontrados = new Set<string>();

  for (const r of data) {
    const nombre = (r[idx('nombre')] || '').trim();
    const email = (r[idx('email')] || '').trim().toLowerCase();
    const cargo = nn(r[idx('cargo')]);
    const area = nn(r[idx('area')]);
    const rolNombre = (r[idx('rol')] || '').trim();
    const esRoot = (r[idx('es_root')] || '').trim().toLowerCase() === 'si';

    const rolId = rolIdByName.get(rolNombre);
    if (rolNombre && !rolId) rolesNoEncontrados.add(rolNombre);

    const existing = await prisma.usuario.findUnique({
      where: { organizacionId_email: { organizacionId: ORG_ID, email } },
      include: { roles: true },
    });

    if (existing) {
      await prisma.usuario.update({
        where: { id: existing.id },
        data: { nombre, cargo, area, activo: true, esRootPlataforma: esRoot },
      });
      // Asegura la asignación de rol sin duplicar.
      if (rolId && !existing.roles.some((ur) => ur.rolId === rolId)) {
        await prisma.usuarioRol.create({ data: { usuarioId: existing.id, rolId } });
      }
      actualizados++;
    } else {
      await prisma.usuario.create({
        data: {
          organizacionId: ORG_ID,
          nombre,
          email,
          passwordHash: '', // marcador: se fija en el bootstrap de auth
          cargo,
          area,
          activo: true,
          esRootPlataforma: esRoot,
          roles: rolId ? { create: [{ rolId }] } : undefined,
        },
      });
      creados++;
    }
  }

  console.log(`✓ Importación de usuarios completada. Creados: ${creados}, actualizados: ${actualizados}, total en CSV: ${data.length}.`);
  if (rolesNoEncontrados.size) {
    console.log('  Roles no encontrados (usuarios quedaron sin rol):', Array.from(rolesNoEncontrados).join(', '));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
