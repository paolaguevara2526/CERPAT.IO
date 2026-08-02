# Migraciones de base de datos (Prisma)

Desde agosto 2026 el esquema se versiona con **migraciones de Prisma**, en vez de
`db push` + `ALTER TABLE` a mano. Esto da historial, evita el *drift* entre el
esquema del código y la base real, y elimina el paso manual de SQL.

## Baseline (una sola vez, ya realizado)

La migración **`0_init`** es el *baseline*: representa el esquema completo tal
como estaba en producción al adoptar migraciones. Como las tablas **ya existían**
(creadas antes con `db push`), NO se ejecuta contra producción — solo se **marca
como aplicada** para que Prisma la dé por hecha.

Se marcó con el SQL `baseline-prisma.sql` (crea la tabla de control
`_prisma_migrations` e inserta `0_init` como aplicada). Equivale a
`prisma migrate resolve --applied 0_init`.

## Flujo de aquí en adelante

**Al cambiar el esquema (`schema.prisma`):**

```bash
# en desarrollo: crea la migración y la aplica a la BD de desarrollo
npm run db:migrate -- --name descripcion_del_cambio
```

Esto crea una carpeta nueva en `prisma/migrations/` que se **commitea al repo**.

**En producción (Railway):**

```bash
npm run db:migrate:deploy   # aplica las migraciones pendientes (prisma migrate deploy)
npm run db:migrate:status   # muestra qué migraciones están aplicadas / pendientes
```

Lo ideal es que `db:migrate:deploy` corra **automáticamente en el deploy** de la
API (antes de arrancar). Se puede activar una vez confirmado el baseline.

## Reglas

- **Nunca** usar `prisma db push` ni `ALTER TABLE` manual en producción: todo
  cambio de esquema va como migración versionada.
- No editar una migración ya aplicada; crear una nueva.
- Las migraciones se aplican en orden; no borrar carpetas de migraciones pasadas.
