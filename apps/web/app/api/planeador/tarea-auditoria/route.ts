// apps/web/app/api/planeador/tarea-auditoria/route.ts
// Proxy autenticado para aprobar/devolver una tarea en auditoría.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL, COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: 'Falta el id de la tarea.' }, { status: 400 });

  const res = await fetch(`${API_URL}/plan/tareas/${encodeURIComponent(body.id)}/auditoria`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion: body.accion, observaciones: body.observaciones }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.error || 'No se pudo procesar la auditoría.' }, { status: res.status });
  return NextResponse.json({ ok: true, estado: data.estado, auditoria: data.auditoria });
}
