/**
 * GET /api/progress/summary — return all progress data for the authenticated user.
 *
 * Single endpoint to avoid multiple round-trips on page load (ADR-005).
 * Returns empty data if unauthenticated.
 */
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface ProgressSummary {
  readContent: {
    blog: string[];
    lesson: string[];
  };
  completedLessons: string[];
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        readContent: { blog: [], lesson: [] },
        completedLessons: [],
      });
    }

    const [readRes, lessonRes] = await Promise.all([
      supabase
        .from("read_progress")
        .select("content_type, content_slug")
        .eq("user_id", user.id),
      supabase
        .from("lesson_completion")
        .select("lesson_slug")
        .eq("user_id", user.id),
    ]);

    const readRows = (readRes.data ?? []) as {
      content_type: string;
      content_slug: string;
    }[];

    const summary: ProgressSummary = {
      readContent: {
        blog: readRows.filter((r) => r.content_type === "blog").map((r) => r.content_slug),
        lesson: readRows.filter((r) => r.content_type === "lesson").map((r) => r.content_slug),
      },
      completedLessons: (lessonRes.data as { lesson_slug: string }[] | null)
        ?.map((r) => r.lesson_slug) ?? [],
    };

    return NextResponse.json(summary);
  } catch {
    return NextResponse.json(
      { readContent: { blog: [], lesson: [] }, completedLessons: [] },
      { status: 500 },
    );
  }
}
