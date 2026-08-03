// apps/web/app/api/admin/[...path]/route.ts
// Proxy autenticado (catch-all) hacia los endpoints /admin de la API.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL, COOKIE } from '@/lib/session';

async function forward(req: Request, path: string[], method: string) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await req.text() : undefined;
  const search = new URL(req.url).search; // conserva ?q=… y demás filtros
  const res = await fetch(`${API_URL}/admin/${path.map(encodeURIComponent).join('/')}${search}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

type Ctx = { params: { path: string[] } };
export async function GET(req: Request, { params }: Ctx) { return forward(req, params.path, 'GET'); }
export async function POST(req: Request, { params }: Ctx) { return forward(req, params.path, 'POST'); }
export async function PATCH(req: Request, { params }: Ctx) { return forward(req, params.path, 'PATCH'); }
export async function PUT(req: Request, { params }: Ctx) { return forward(req, params.path, 'PUT'); }
export async function DELETE(req: Request, { params }: Ctx) { return forward(req, params.path, 'DELETE'); }
