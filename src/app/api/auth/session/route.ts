/**
 * GET /api/auth/session — current auth state for the client.
 *
 * Returns `{ user: { id, email } | null }` resolved from the HttpOnly
 * session cookie via the SSR client (same auth source as the progress
 * API routes). No sensitive tokens ever leave the server.
 */
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? "",
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
