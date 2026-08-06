/**
 * Supabase client singleton for client-side (browser) use.
 * Uses the anonymous key from Next.js public env vars.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and anon key are required");
}

/** Singleton anonymous Supabase client. */
let client: ReturnType<typeof createClient> | undefined;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey);
  }
  return client;
}

export type SupabaseClient = ReturnType<typeof getSupabaseClient>;
