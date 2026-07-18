# Planeador CERPAT

Monorepo del **Planeador CERPAT**: la herramienta de planificación y programación
de operaciones de CERPAT.

## Estructura del repositorio

```
.
├── apps/
│   ├── web/              # Frontend (interfaz del planeador)
│   └── api/               # Backend (API y lógica de negocio)
├── packages/
│   └── shared/            # Tipos, utilidades y contratos compartidos entre web y api
└── docs/
    ├── arquitectura.md         # Decisiones y visión general de arquitectura
    ├── modelo-de-datos.md      # Entidades, relaciones y esquema de datos
    └── reglas-de-negocio.md    # Reglas y lógica de negocio del dominio CERPAT
```

## Primeros pasos

Este repositorio está en fase de bootstrap. Aún no hay stack tecnológico ni
dependencias definidas en `apps/web`, `apps/api` ni `packages/shared`; cada uno
contiene por ahora un `README.md` describiendo su propósito.

Consulta [`CLAUDE.md`](./CLAUDE.md) para las convenciones de trabajo con Claude
Code en este repositorio, y
[`CONTEXTO-PARA-CLAUDE-CODE.md`](./CONTEXTO-PARA-CLAUDE-CODE.md) para el
contexto de negocio detrás del proyecto.

## Documentación

- [Arquitectura](./docs/arquitectura.md)
- [Modelo de datos](./docs/modelo-de-datos.md)
- [Reglas de negocio](./docs/reglas-de-negocio.md)
