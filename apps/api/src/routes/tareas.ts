// apps/api/src/routes/tareas.ts
//
// Router de ejemplo — implementa dos de las reglas de negocio críticas descritas en
// CONTEXTO-PARA-CLAUDE-CODE.md, para que Claude Code siga el mismo patrón en el resto
// de endpoints: TODA validación de negocio ocurre aquí, del lado del servidor, nunca
// solo en el frontend.
//
// TODO (Claude Code):
//  - Agregar middleware de autenticación (verificar sesión antes de cada ruta).
//  - Agregar verificación de rol/permiso según la acción.
//  - Completar el resto de reglas de negocio (auditoría bloqueada, asignación automática,
//    etc.) siguiendo el mismo patrón de este archivo.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';

export const tareasRouter = Router();

const ESTADOS_QUE_REQUIEREN_SUBTAREAS_COMPLETAS = ['terminado', 'auditado'];

const actualizarTareaSchema = z.object({
  estado: z.enum(['por_iniciar', 'en_curso', 'en_revision', 'terminado', 'auditado', 'no_realizado']).optional(),
  // ...resto de campos editables de la tarea
});

tareasRouter.get('/', async (_req, res) => {
  const tareas = await prisma.tarea.findMany({
    include: { subtareas: true, asignados: { include: { usuario: true } }, etiquetas: { include: { etiqueta: true } } },
    orderBy: { fechaVencimiento: 'asc' },
  });
  res.json(tareas);
});

tareasRouter.patch('/:id', async (req, res) => {
  const parsed = actualizarTareaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
  }

  const tarea = await prisma.tarea.findUnique({
    where: { id: req.params.id },
    include: { subtareas: true },
  });
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

  // Regla de negocio: no se puede bloquear/editar una tarea ya auditada (aprobada)
  // sin pasar antes por "Desbloquear" en la vista de Auditoría.
  if (tarea.auditoria === 'aprobada') {
    return res.status(403).json({
      error: 'Esta tarea está bloqueada porque ya fue aprobada en Auditoría. Debe desbloquearse primero.',
    });
  }

  const nuevoEstado = parsed.data.estado ?? tarea.estado;

  // Regla de negocio: no se puede marcar Terminado/Auditado si hay subtareas "pendiente".
  if (ESTADOS_QUE_REQUIEREN_SUBTAREAS_COMPLETAS.includes(nuevoEstado)) {
    const haySubtareasPendientes = tarea.subtareas.some((s) => s.estado === 'pendiente');
    if (haySubtareasPendientes) {
      return res.status(422).json({
        error: `No se puede marcar la tarea como "${nuevoEstado}" mientras tenga subtareas sin resolver (Realizada / No aplica / No realizada).`,
      });
    }
  }

  const actualizada = await prisma.tarea.update({
    where: { id: tarea.id },
    data: parsed.data,
  });

  res.json(actualizada);
});
