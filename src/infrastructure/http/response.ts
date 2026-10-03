import 'server-only';
import { NextResponse } from 'next/server';
import { assertSameOrigin, HttpError } from '../../application/http-validation';
export function checkOrigin(request: Request) { assertSameOrigin(request.headers.get('origin'), process.env.APP_ORIGIN); }
export async function readBody(request: Request): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (Number(request.headers.get('content-length') ?? 0) > 8192) throw new HttpError(413, 'Corpo excede o limite.');
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); throw new HttpError(413, 'Corpo excede o limite.'); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const raw = new TextDecoder().decode(bytes);
  if (type.includes('application/json')) {
    try { return JSON.parse(raw); } catch { throw new HttpError(400, 'JSON inválido.'); }
  }
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  throw new HttpError(415, 'Formato não suportado.');
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function success(request: Request, data: unknown, status: string, code = 200) {
  if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
    return NextResponse.redirect(new URL(`/dev?status=${status}`, process.env.APP_ORIGIN!), 303);
  }
  return json(data, code);
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Não devolver tokens, respostas Supabase, stack traces ou detalhes do banco.
  return json({ error: 'Não foi possível concluir a operação.' }, 503);
}
