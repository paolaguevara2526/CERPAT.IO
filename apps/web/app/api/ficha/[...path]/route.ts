// Proxy de la hoja de vida del cliente: adjunta el token de la sesión (cookie
// httpOnly) para que el navegador nunca hable directo con la API.
import { NextResponse } from 'next/server';
import { API_URL, getToken } from '@/lib/session';

async function reenviar(req: Request, path: string[], metodo: string) {
  const token = getToken();
  const url = `${API_URL}/ficha/${path.map(encodeURIComponent).join('/')}`;
  const cuerpo = metodo === 'GET' || metodo === 'DELETE' ? undefined : await req.text();
  const res = await fetch(url, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo,
    cache: 'no-store',
  });
  const texto = await res.text();
  return new NextResponse(texto, { status: res.status, headers: { 'Content-Type': 'application/json' } });
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) { return reenviar(req, params.path, 'GET'); }
export async function POST(req: Request, { params }: { params: { path: string[] } }) { return reenviar(req, params.path, 'POST'); }
export async function PATCH(req: Request, { params }: { params: { path: string[] } }) { return reenviar(req, params.path, 'PATCH'); }
export async function DELETE(req: Request, { params }: { params: { path: string[] } }) { return reenviar(req, params.path, 'DELETE'); }
