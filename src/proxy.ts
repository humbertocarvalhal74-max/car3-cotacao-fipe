import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
/** A página técnica usa Server Components; o proxy renova cookies antes da renderização. */
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
  const db = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: changes => {
        for (const { name, value } of changes) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of changes) response.cookies.set(name, value, options);
      },
    },
  });
  await db.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/dev'] };
