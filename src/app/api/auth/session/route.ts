import { requireSession } from '@/infrastructure/supabase/session';
import { failure, json } from '@/infrastructure/http/response';
export async function GET() {
  try {
    const { user } = await requireSession();
    return json({ user: { id: user.id, email: user.email } });
  } catch (error) { return failure(error); }
}
