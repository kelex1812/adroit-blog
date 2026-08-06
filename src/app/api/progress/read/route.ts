/**
 * POST /api/progress/read — mark content as read.
 *
 * Upserts a read_progress row in Supabase for authenticated users.
 * Silently fails if no auth or Supabase is unavailable (client keeps
 * localStorage as the fallback).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { contentType, contentSlug } = (await req.json()) as {
      contentType: "blog" | "lesson";
      contentSlug: string;
    };

    if (!contentType || !contentSlug) {
      return NextResponse.json({ error: "contentType and contentSlug required" }, { status: 400 });
    }

    if (contentType !== "blog" && contentType !== "lesson") {
      return NextResponse.json({ error: "contentType must be 'blog' or 'lesson'" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ status: "unauthenticated" });
    }

    // Upsert: insert or update read_at timestamp
    const { error } = await supabase.from("read_progress").upsert(
      {
        user_id: user.id,
        content_type: contentType,
        content_slug: contentSlug,
        read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,content_slug" },
    );

    if (error) {
      return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    // Silently fail — client has localStorage fallback
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
