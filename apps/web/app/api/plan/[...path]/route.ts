// apps/web/app/api/plan/[...path]/route.ts
// Proxy autenticado (catch-all) hacia /plan/... de la API. Lo usa el portal del
// cliente (GET /plan/portal) entre otros.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL, COOKIE } from '@/lib/session';

async function forward(req: Request, path: string[], method: string) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const suffix = `${path.map(encodeURIComponent).join('/')}${url.search}`;
  const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && req.body ? await req.text() : undefined;
  const res = await fetch(`${API_URL}/plan/${suffix}`, {
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
export async function PUT(req: Request, { params }: Ctx) { return forward(req, params.path, 'PUT'); }
export async function PATCH(req: Request, { params }: Ctx) { return forward(req, params.path, 'PATCH'); }
export async function DELETE(req: Request, { params }: Ctx) { return forward(req, params.path, 'DELETE'); }
