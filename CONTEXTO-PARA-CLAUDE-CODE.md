# Contexto para Claude Code — Planeador CERPAT

Este documento resume el contexto de negocio del **Planeador CERPAT** para que
Claude Code pueda tomar decisiones informadas al trabajar en este repositorio.
Complementa a [`CLAUDE.md`](./CLAUDE.md) (convenciones técnicas) y a los
documentos en [`docs/`](./docs/).

## Qué es CERPAT

CERPAT es la organización dueña de este producto. El **Planeador** es la
herramienta interna que usa CERPAT para planificar y programar sus
operaciones.

> Este repositorio se creó como bootstrap inicial. Este documento debe
> actualizarse a medida que se defina con más detalle el negocio de CERPAT, los
> usuarios del planeador y sus procesos, para que futuras sesiones de Claude
> Code tengan contexto real y no solo la estructura del proyecto.

## Objetivo del Planeador

Centralizar y automatizar la planificación de operaciones de CERPAT,
reemplazando procesos manuales o dispersos (hojas de cálculo, comunicación
informal, etc.) por una herramienta con datos consistentes y trazables.

## Estado actual

- Fase: **bootstrap**. Existe la estructura de carpetas del monorepo, pero no
  hay stack tecnológico, modelo de datos ni reglas de negocio implementadas
  todavía.
- Los documentos en `docs/` (`arquitectura.md`, `modelo-de-datos.md`,
  `reglas-de-negocio.md`) están como plantillas a completar a medida que se
  definan los requerimientos reales con el usuario.

## Cómo usar este documento

Al iniciar una sesión de trabajo sobre este repositorio:

1. Lee este archivo para el contexto de negocio.
2. Lee `CLAUDE.md` para las convenciones técnicas.
3. Revisa `docs/` para el estado más reciente de arquitectura, modelo de datos
   y reglas de negocio antes de proponer cambios.
4. Si el usuario da contexto de negocio nuevo (procesos, reglas, stakeholders),
   regístralo aquí o en el documento de `docs/` correspondiente, no solo en la
   conversación.
