/**
 * POST /api/progress/read — mark content as read.
 * DELETE /api/progress/read — unmark content as read (removes the row).
 *
 * Upserts a read_progress row in Supabase for authenticated users.
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

/** Parse + validate the shared body shape (POST/DELETE). */
async function parseBody(req: NextRequest): Promise<
  | { ok: true; contentType: "blog" | "lesson"; contentSlug: string }
  | { ok: false; response: NextResponse }
> {
  const body = (await req.json()) as {
    contentType?: unknown;
    contentSlug?: unknown;
  };

  if (typeof body.contentSlug !== "string" || body.contentSlug.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "contentType and contentSlug required" },
        { status: 400 },
      ),
    };
  }

  if (body.contentType !== "blog" && body.contentType !== "lesson") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "contentType must be 'blog' or 'lesson'" },
        { status: 400 },
      ),
    };
  }

  /* --- Slug validation (F2) --- */
  const slugErr = validateSlug(body.contentSlug, "contentSlug");
  if (slugErr) {
    return {
      ok: false,
      response: NextResponse.json({ error: slugErr }, { status: 400 }),
    };
  }

  return { ok: true, contentType: body.contentType, contentSlug: body.contentSlug };
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

    // Upsert: insert or update read_at timestamp
    const { error } = await supabase.from("read_progress").upsert(
      {
        user_id: user.id,
        content_type: parsed.contentType,
        content_slug: parsed.contentSlug,
        read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,content_slug" },
    );

    if (error) {
      return NextResponse.json({ status: "error", error: sanitiseDbError(error) }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    // Silently fail — client has localStorage fallback
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

    // Delete: remove the read row so unmark survives reloads
    const { error } = await supabase
      .from("read_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("content_type", parsed.contentType)
      .eq("content_slug", parsed.contentSlug);

    if (error) {
      return NextResponse.json({ status: "error", error: sanitiseDbError(error) }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
