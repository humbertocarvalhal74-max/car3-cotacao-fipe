import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { HttpError } from '../../application/http-validation';
export async function createSessionClient(readOnly = false) {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new HttpError(503, 'Conexão Supabase não configurada.');
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: changes => { if (!readOnly) for (const { name, value, options } of changes) jar.set(name, value, options); },
    },
  });
}
export async function requireSession() {
  const db = await createSessionClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'Autenticação obrigatória.');
  const { data: sessionData } = await db.auth.getSession();
  const session = sessionData.session;
  if (!session || session.user.id !== data.user.id) throw new HttpError(401, 'Sessão inválida.');
  return { db, user: data.user, accessToken: session.access_token };
}
