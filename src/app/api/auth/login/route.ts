/**
 * POST /api/auth/login — email/password sign in OR sign up (Supabase).
 *
 * Uses the SSR client so the session cookie is written server-side
 * (HttpOnly) and proxy.ts / progress API routes pick it up naturally.
 *
 * Body: { mode: "signin" | "signup", email, password }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildAuthRedirect } from "@/lib/auth-emails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      mode?: unknown;
      email?: unknown;
      password?: unknown;
    };

    const mode = body.mode === "signup" ? "signup" : "signin";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: buildAuthRedirect("/blog") },
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      // Email confirmation may be required — treat as success with a hint.
      return NextResponse.json({
        status: "check-email",
        message: "Account created. Check your inbox to confirm your email, then sign in.",
      });
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
