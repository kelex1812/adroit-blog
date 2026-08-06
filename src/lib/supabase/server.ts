/**
 * Supabase server client for route handlers / server components.
 *
 * Cookie-based (via @supabase/ssr) so RLS policies resolve the real
 * authenticated user from the session cookie — unlike the browser
 * singleton (client.ts), which cannot see cookies from Node.
 *
 * Usage: await getSupabaseServerClient()
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and anon key are required");
}

/** Create a cookie-aware Supabase client bound to the current request. */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies() is read-only.
          // Safe to ignore — session refresh is handled by middleware/SSR flow.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<
  ReturnType<typeof getSupabaseServerClient>
>;
