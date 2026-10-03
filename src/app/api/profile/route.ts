import { object, text } from '@/application/http-validation';
import { requireSession } from '@/infrastructure/supabase/session';
import { checkOrigin, failure, readBody, success } from '@/infrastructure/http/response';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const nome = text(object(await readBody(request)).nome, 'nome');
    const { db, user } = await requireSession();
    const { data: profile, error: readError } = await db.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (readError) throw readError;
    const result = profile ? await db.from('profiles').update({ nome }).eq('id', user.id) :
      await db.from('profiles').insert({ id: user.id, nome });
    if (result.error) throw result.error;
    return success(request, { id: user.id, nome }, 'profile');
  } catch (error) { return failure(error); }
}
