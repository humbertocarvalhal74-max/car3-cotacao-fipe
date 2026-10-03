import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Cliente por requisição; nunca compartilhar tokens entre usuários. */
export function createSupabaseClient(accessToken?: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no servidor.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}
