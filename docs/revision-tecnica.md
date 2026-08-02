# Revisión técnica (curaduría estructural) — agosto 2026

Curaduría del estado estructural del repositorio, hecha antes de seguir agregando
funcionalidad, para no arrastrar problemas. Se prioriza por impacto/riesgo.
Este documento se mantiene vivo: marcar los ítems a medida que se resuelven.

## Lo que está sólido ✅

- **Secretos:** `.env` en `.gitignore`; no hay credenciales versionadas.
- **TypeScript estricto** (`strict: true`) en API y web.
- **Autenticación** con JWT + middleware de roles; validación de entrada en los
  `PATCH` (rangos, enums).
- **Monorepo** limpio (`apps/web`, `apps/api`, `prisma`, `docs`) y `.env.example`
  completo.

## Prioridad alta

### 1. Migraciones de base versionadas — ✅ HECHO (ago 2026)
Antes: cada columna/estado se aplicaba a mano con `ALTER TABLE` en Railway (sin
historial, con riesgo de *drift* entre el esquema del código y la base real).
Ahora: **migraciones de Prisma** con baseline `0_init`. Ver
[`prisma/migrations/README.md`](../prisma/migrations/README.md). Se acabó el SQL
manual para cambios de esquema.

### 2. Integración continua (CI) — ✅ HECHO (ago 2026)
Antes: no había chequeo automático; cada fusión confiaba en compilación local.
Ahora: **GitHub Actions** (`.github/workflows/ci.yml`) corre en cada PR y push a
`main`: `prisma validate` + build de API (`tsc`) + build de web (`next build`).
**Pendiente (manual, requiere admin del repo):** proteger `main` para exigir que
el check *"Validar y construir"* esté verde antes de fusionar
(GitHub → Settings → Branches → Require status checks).

### 3. Coordinación de despliegue (API/BD/Web) — 🟡 mejora con lo anterior
Se repitió la fricción de *"corre el SQL antes de fusionar"* / *"el preview no
muestra datos porque la API no está desplegada"*. Con migraciones versionadas +
correr `npm run db:migrate:deploy` en el deploy de la API (Railway), esto se
vuelve automático. **Pendiente:** activar el `migrate deploy` en el deploy.

## Prioridad media (deuda técnica)

### 4. `packages/shared` vacío + duplicación de estados — ⏳ pendiente
El paquete declarado "fuente de verdad de tipos" tiene **0 usos**; los mapas de
estado/color están repetidos en ~10 archivos del web y las validaciones en la
API. Agregar un estado obliga a tocar muchos lugares. → Centralizar enums,
etiquetas y colores en `packages/shared` (o un módulo común) y consumirlos.

### 5. Multi-tenant "a medias" — ⏳ pendiente
`slug: 'cerpat'` está hardcodeado en ~37 lugares; el `organizacionId` del token
casi no se usa para aislar. Hoy funciona (una sola firma) pero contradice el
diseño (ADR-0001) y complicaría entrar una segunda firma. → Resolver la org desde
`req.user.org` con un helper cuando sea relevante.

### 6. Modelos redundantes/confusos — ⏳ pendiente
- **`Pago`** está definido pero **no se usa** (el pago se maneja con
  `estadoPago`/`valorPago` en `Tarea` y `VencimientoEmpresa`). → Decidir si se
  elimina o se adopta.
- Hay **dos conceptos de vencimiento**: `Vencimiento` (plantilla/calendario del
  admin) y `VencimientoEmpresa` (por empresa, lo que usan Calendario/Pagos). →
  Documentar la diferencia para que nadie se confunda.

### 7. Documentación — 🟡 en curso
Mantener `docs/estado-y-plan.md` al día con lo construido (calendario unificado,
soporte documental, valor a pagar, festivos, migraciones, CI).

## Orden sugerido de los pendientes
1. Activar la protección de rama (exigir CI verde) — 2 min, manual.
2. Activar `migrate deploy` en el deploy de la API.
3. Centralizar estados/tipos en `packages/shared` (#4).
4. Resolver org desde el token (#5) — cuando entre una segunda firma.
5. Limpiar/definir `Pago` y documentar los dos vencimientos (#6).
