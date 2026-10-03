import { HttpError, object, text } from '@/application/http-validation';
import { requireSession } from '@/infrastructure/supabase/session';
import { checkOrigin, failure, json, readBody, success } from '@/infrastructure/http/response';
export async function GET() {
  try {
    const { db } = await requireSession();
    const { data, error } = await db.from('clientes').select('id,nome').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return json({ clientes: data });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = object(await readBody(request));
    if ('created_by' in body || 'ownerId' in body) throw new HttpError(400, 'Proprietário definido pelo servidor.');
    const nome = text(body.nome, 'nome');
    const { db, user } = await requireSession();
    const { data, error } = await db.from('clientes').insert({ nome, created_by: user.id }).select('id,nome').single();
    if (error) throw error;
    return success(request, { cliente: data }, 'cliente', 201);
  } catch (error) { return failure(error); }
}
