/**
 * GET /api/progress/quiz/tiers?series=omni-studio-cert — tier progress rollup.
 *
 * Series page rollup + check/exam cards need per-check best scores without 10
 * round-trips. Returns, for the authed user:
 *   lessons  { completed, total }                 from lesson_completion
 *   checks   [{ n, bestScore, attempts, passed }] MAX(score) per check quizName
 *   exam     { bestScore, attempts, passed }      MAX(score) for <series>:exam
 *   unlocked true when every check passed >= 80   (ADR-101/Decision 9)
 *
 * Guests: all zeros / empty (client renders CTA-safe zeros — never question text).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getKnowledgeChecks } from "@/lib/quiz";
import { getSeriesBySlug, getLessonsForSeries } from "@/lib/learn";
import { validateSlug } from "@/lib/api-security";
import type { CheckProgress, TierProgress } from "@/shared/contracts";

const CHECK_PASS_PCT = 80;
const EXAM_PASS_PCT = 72;

function emptyChecks(series: string): CheckProgress[] {
  return getKnowledgeChecks(series).map((c) => ({
    n: c.n,
    bestScore: 0,
    attempts: 0,
    passed: false,
  }));
}

/** Guest / no-data tier progress (zeros, never question text). */
function emptyTierProgress(series: string): TierProgress {
  const s = getSeriesBySlug(series);
  const checks = emptyChecks(series);
  return {
    lessons: { completed: 0, total: s?.totalLessons ?? 0 },
    checks,
    exam: { bestScore: 0, attempts: 0, passed: false },
    unlocked: false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const series = req.nextUrl.searchParams.get("series") ?? "";
    const slugErr = validateSlug(series, "series");
    if (slugErr) {
      return NextResponse.json({ error: slugErr }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(emptyTierProgress(series));
    }

    const checkMetas = getKnowledgeChecks(series);
    const checkQuizNames = checkMetas.map((c) => `${series}:check:${c.n}`);
    const examQuizName = `${series}:exam`;

    const lessonSlugs = getLessonsForSeries(series).map((l) => l.slug);

    const [lessonRes, runRes] = await Promise.all([
      lessonSlugs.length > 0
        ? supabase
            .from("lesson_completion")
            .select("lesson_slug")
            .eq("user_id", user.id)
            .in("lesson_slug", lessonSlugs)
        : Promise.resolve({ data: [] as { lesson_slug: string }[], error: null }),
      supabase
        .from("quiz_run")
        .select("quiz_name, score")
        .eq("user_id", user.id)
        .in("quiz_name", [...checkQuizNames, examQuizName]),
    ]);

    const completedLessons = new Set(
      ((lessonRes.data ?? []) as { lesson_slug: string }[]).map((r) => r.lesson_slug),
    );

    // Group MAX(score) + attempt count per quiz_name.
    const scoresByQuiz = new Map<string, { best: number; attempts: number }>();
    for (const row of (runRes.data ?? []) as { quiz_name: string; score: number }[]) {
      const cur = scoresByQuiz.get(row.quiz_name) ?? { best: -1, attempts: 0 };
      scoresByQuiz.set(row.quiz_name, {
        best: Math.max(cur.best, row.score),
        attempts: cur.attempts + 1,
      });
    }

    const checks: CheckProgress[] = checkMetas.map((c) => {
      const stats = scoresByQuiz.get(`${series}:check:${c.n}`);
      const bestScore = stats?.best ?? 0;
      return {
        n: c.n,
        bestScore,
        attempts: stats?.attempts ?? 0,
        passed: bestScore >= CHECK_PASS_PCT,
      };
    });

    const examStats = scoresByQuiz.get(examQuizName);
    const examBest = examStats?.best ?? 0;

    const totalLessons = getSeriesBySlug(series)?.totalLessons ?? 0;
    const allChecksPassed = checks.every((c) => c.passed);

    const progress: TierProgress = {
      lessons: { completed: completedLessons.size, total: totalLessons },
      checks,
      exam: {
        bestScore: examBest,
        attempts: examStats?.attempts ?? 0,
        passed: examBest >= EXAM_PASS_PCT,
      },
      unlocked: allChecksPassed,
    };

    return NextResponse.json(progress);
  } catch {
    // Never leak question text; zeros are CTA-safe.
    const series = req.nextUrl.searchParams.get("series") ?? "";
    return NextResponse.json(emptyTierProgress(series));
  }
}
