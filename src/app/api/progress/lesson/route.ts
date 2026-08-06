/**
 * POST /api/progress/lesson — mark a lesson as complete.
 * DELETE /api/progress/lesson — unmark a lesson as complete (removes the row).
 *
 * Upserts a lesson_completion row in Supabase for authenticated users.
 * Silently fails if no auth or Supabase is unavailable (client keeps
 * localStorage as the fallback).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  checkOrigin,
  checkRateLimit,
  getClientIp,
  sanitiseDbError,
  validateSlug,
} from "@/lib/api-security";

/** Parse + validate the shared lessonSlug body (POST/DELETE). */
async function parseBody(req: NextRequest): Promise<
  | { ok: true; lessonSlug: string }
  | { ok: false; response: NextResponse }
> {
  const body = (await req.json()) as { lessonSlug?: unknown };

  if (typeof body.lessonSlug !== "string" || body.lessonSlug.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "lessonSlug required" },
        { status: 400 },
      ),
    };
  }

  /* --- Slug validation (F2) --- */
  const slugErr = validateSlug(body.lessonSlug, "lessonSlug");
  if (slugErr) {
    return {
      ok: false,
      response: NextResponse.json({ error: slugErr }, { status: 400 }),
    };
  }

  return { ok: true, lessonSlug: body.lessonSlug };
}

export async function POST(req: NextRequest) {
  try {
    /* --- Origin / CSRF check (F6) --- */
    const originErr = checkOrigin(req);
    if (originErr) {
      return NextResponse.json({ error: originErr }, { status: 403 });
    }

    /* --- Rate limit (F2) --- */
    if (!checkRateLimit(getClientIp(req))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await parseBody(req);
    if (!parsed.ok) return parsed.response;

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ status: "unauthenticated" });
    }

    const { error } = await supabase.from("lesson_completion").upsert(
      {
        user_id: user.id,
        lesson_slug: parsed.lessonSlug,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_slug" },
    );

    if (error) {
      return NextResponse.json({ status: "error", error: sanitiseDbError(error) }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    /* --- Origin / CSRF check (F6) --- */
    const originErr = checkOrigin(req);
    if (originErr) {
      return NextResponse.json({ error: originErr }, { status: 403 });
    }

    /* --- Rate limit (F2) --- */
    if (!checkRateLimit(getClientIp(req))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await parseBody(req);
    if (!parsed.ok) return parsed.response;

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ status: "unauthenticated" });
    }

    // Delete: remove the completion row so unmark survives reloads
    const { error } = await supabase
      .from("lesson_completion")
      .delete()
      .eq("user_id", user.id)
      .eq("lesson_slug", parsed.lessonSlug);

    if (error) {
      return NextResponse.json({ status: "error", error: sanitiseDbError(error) }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
