import { credentials } from '@/application/http-validation';
import { createSessionClient } from '@/infrastructure/supabase/session';
import { checkOrigin, failure, json, readBody, success } from '@/infrastructure/http/response';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = credentials(await readBody(request));
    const db = await createSessionClient();
    const { data, error } = await db.auth.signInWithPassword(input);
    if (error || !data.user) return json({ error: 'Email ou senha inválidos.' }, 401);
    return success(request, { user: { id: data.user.id, email: data.user.email } }, 'login');
  } catch (error) { return failure(error); }
}
