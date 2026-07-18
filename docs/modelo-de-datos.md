# Modelo de datos — Planeador CERPAT

> Estado: plantilla inicial (bootstrap). Completar a medida que se definan las
> entidades reales del dominio con el usuario.

## Propósito

Este documento es la fuente de verdad sobre las entidades, atributos y
relaciones del dominio del Planeador CERPAT. Debe mantenerse sincronizado con
lo implementado en `packages/shared` y `apps/api`.

## Entidades

_Pendiente de definir. Para cada entidad, documentar:_

- Nombre y propósito.
- Atributos principales y su tipo.
- Relaciones con otras entidades.
- Reglas de validación relevantes (referenciar
  [`reglas-de-negocio.md`](./reglas-de-negocio.md) si aplica).

## Relaciones

_Pendiente — agregar diagrama entidad-relación cuando el modelo esté
definido._

## Convenciones

- Nombrar entidades y atributos en español, consistente con el dominio de
  negocio de CERPAT, salvo que el equipo decida lo contrario.
- Cualquier cambio en el modelo de datos debe reflejarse en este documento en
  el mismo cambio que lo introduce en el código.
