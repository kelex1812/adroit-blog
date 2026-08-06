/**
 * POST /api/progress/quiz/run — record a completed quiz run.
 * GET  /api/progress/quiz/run?quizName=... — fetch best score + attempt count.
 *
 * Stats drive the "Quiz avg 82% · 3 attempts" strip on PathCard / series
 * header (design brief §5.3, US-005 AC5). LocalStorage is the client's
 * authoritative copy; this route backs cross-device display for authed
 * users. Guests get stats purely from localStorage (QuizStats component).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  checkOrigin,
  checkRateLimit,
  getClientIp,
  sanitiseDbError,
  validateIndex,
  validateSlug,
} from "@/lib/api-security";

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

    const body = (await req.json()) as {
      quizName?: unknown;
      correct?: unknown;
      total?: unknown;
    };

    if (typeof body.quizName !== "string" || body.quizName.length === 0) {
      return NextResponse.json({ error: "quizName required" }, { status: 400 });
    }
    const quizErr = validateSlug(body.quizName, "quizName");
    if (quizErr) {
      return NextResponse.json({ error: quizErr }, { status: 400 });
    }

    if (typeof body.correct !== "number" || typeof body.total !== "number") {
      return NextResponse.json({ error: "correct and total required" }, { status: 400 });
    }
    const totalErr = validateIndex(body.total, "total", 1000);
    if (totalErr) {
      return NextResponse.json({ error: totalErr }, { status: 400 });
    }
    if (body.correct < 0 || body.correct > body.total) {
      return NextResponse.json({ error: "correct must be between 0 and total" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ status: "unauthenticated" });
    }

    const score = Math.round((body.correct / body.total) * 100);

    const { error } = await supabase.from("quiz_run").insert({
      user_id: user.id,
      quiz_name: body.quizName,
      correct: body.correct,
      total: body.total,
      score,
      completed_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ status: "error", error: sanitiseDbError(error) }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const quizName = req.nextUrl.searchParams.get("quizName") ?? "";

    if (!quizName) {
      return NextResponse.json({ error: "quizName required" }, { status: 400 });
    }
    const quizErr = validateSlug(quizName, "quizName");
    if (quizErr) {
      return NextResponse.json({ error: quizErr }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ bestScore: 0, attempts: 0 });
    }

    const { data, error } = await supabase
      .from("quiz_run")
      .select("score")
      .eq("user_id", user.id)
      .eq("quiz_name", quizName);

    if (error) {
      return NextResponse.json({ bestScore: 0, attempts: 0 });
    }

    const scores = (data ?? []) as { score: number }[];
    if (scores.length === 0) {
      return NextResponse.json({ bestScore: 0, attempts: 0 });
    }

    const bestScore = Math.max(...scores.map((s) => s.score));

    return NextResponse.json({ bestScore, attempts: scores.length });
  } catch {
    return NextResponse.json({ bestScore: 0, attempts: 0 });
  }
}
