# Planeador CERPAT

Sistema de gestión y planificación de tareas para CERPAT (firma contable). Permite el seguimiento de obligaciones tributarias y contables de empresas clientes, medición de desempeño por equipo, y (en fase futura) un portal de consulta para los equipos contables de nuestros clientes.

## Estado del proyecto

🚧 En construcción — migrando desde un prototipo funcional (`prototipo-referencia/`) hacia una implementación de producción con arquitectura real.

## Antes de tocar código

Lee, en este orden:
1. [`CONTEXTO-PARA-CLAUDE-CODE.md`](./CONTEXTO-PARA-CLAUDE-CODE.md) — resumen de producto, arquitectura, modelo de datos y reglas de negocio ya validadas.
2. [`docs/arquitectura.md`](./docs/arquitectura.md) — arquitectura completa del sistema.
3. Abre `prototipo-referencia/planeador-cerpat.html` en el navegador para ver el comportamiento esperado de cada pantalla.

## Arquitectura (resumen)

- **Frontend:** Next.js → Vercel (`app.cerpat.io`)
- **Backend:** Node.js/Express → Railway (`api.cerpat.io`)
- **Base de datos:** PostgreSQL (Railway)
- **Autenticación:** Auth.js / Clerk
- **Automatización:** n8n (Railway)
- **Correo:** Microsoft 365 (Graph API) vía buzón `notificaciones@cerpat.io`
- **Monitoreo:** Sentry

## Estructura del repositorio

```
apps/
  web/     → Frontend (Next.js)
  api/      → Backend (Node/Express)
packages/
  shared/    → Tipos y validaciones compartidas
docs/         → Documentación de arquitectura, modelo de datos y reglas de negocio
prototipo-referencia/  → Prototipo HTML de referencia visual y funcional
```

## Desarrollo local

```bash
# instrucciones de instalación y variables de entorno se agregan
# a medida que el proyecto se inicializa
```

## Seguridad

Este repositorio eventualmente manejará datos de clientes reales. Nunca subir credenciales, contraseñas ni llaves de API al código — usar variables de entorno (`.env`, excluido del control de versiones) desde el primer commit.
