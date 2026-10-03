import { requireSession } from '@/infrastructure/supabase/session';
import { failure, json } from '@/infrastructure/http/response';
export async function GET() {
  try {
    const { db } = await requireSession();
    // PostgREST retorna bigint como JSON number; converter no SQL antes do transporte.
    const { data, error } = await db.rpc('car3_list_quotes');
    if (error) throw error;
    return json({ cotacoes: data });
  } catch (error) { return failure(error); }
}
