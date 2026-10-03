import { requireSession } from '@/infrastructure/supabase/session';
import { checkOrigin, failure, success } from '@/infrastructure/http/response';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { db } = await requireSession();
    const { error } = await db.auth.signOut({ scope: 'local' });
    if (error) throw error;
    return success(request, { success: true }, 'logout');
  } catch (error) { return failure(error); }
}
