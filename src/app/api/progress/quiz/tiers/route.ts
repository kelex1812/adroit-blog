/**
 * GET /api/progress/quiz/tiers?series=omni-studio-cert — tier progress rollup.
 *
 * Series page rollup + check/exam cards need per-check best scores without 10
 * round-trips. Returns, for the authed user:
 *   lessons  { completed, total }                 from lesson_completion
 *   checks   [{ n, bestScore, attempts, passed }] score per check quizName
 *   exam     { bestScore, attempts, passed }      score for <series>:exam
 *   unlocked true when every check passed >= 80   (ADR-101/Decision 9)
 *
 * Security (t_7469e31d F2): bestScore/passed/unlocked derive from
 * SERVER-GRADED `quiz_attempt` rows (scoreQuizAttemptsByQuiz) — never from
 * client-writable `quiz_run`. `quiz_run` is read only for the display-only
 * attempt count; it cannot grant anything.
 *
 * Guests: all zeros / empty (client renders CTA-safe zeros — never question text).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCertExam,
  getKnowledgeCheck,
  getKnowledgeChecks,
  scoreQuizAttemptsByQuiz,
} from "@/lib/quiz";
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
    const tierQuizNames = [...checkQuizNames, examQuizName];

    const [lessonRes, attemptRes, runCountRes] = await Promise.all([
      lessonSlugs.length > 0
        ? supabase
            .from("lesson_completion")
            .select("lesson_slug")
            .eq("user_id", user.id)
            .in("lesson_slug", lessonSlugs)
        : Promise.resolve({ data: [] as { lesson_slug: string }[], error: null }),
      // Source of truth for scores (F2): server-graded quiz_attempt rows.
      supabase
        .from("quiz_attempt")
        .select("quiz_name, question_index, is_correct")
        .eq("user_id", user.id)
        .in("quiz_name", tierQuizNames),
      // Display-only attempt counts — quiz_run rows are server-derived
      // (F1) and never influence pass/unlock decisions.
      supabase
        .from("quiz_run")
        .select("quiz_name")
        .eq("user_id", user.id)
        .in("quiz_name", tierQuizNames),
    ]);

    const completedLessons = new Set(
      ((lessonRes.data ?? []) as { lesson_slug: string }[]).map((r) => r.lesson_slug),
    );

    // Score per quiz from graded attempts (F2).
    // Canonical coverage (t_55105899): build quizName → canonical question
    // count so scoreQuizAttemptsByQuiz rejects partial attempt sets — a
    // client that answers 8 of 15 check questions must NOT derive 100%.
    const canonicalTotals = new Map<string, number>();
    for (const c of checkMetas) {
      const quiz = getKnowledgeCheck(series, c.n);
      if (quiz) canonicalTotals.set(`${series}:check:${c.n}`, quiz.questions.length);
    }
    const exam = getCertExam(series);
    if (exam) canonicalTotals.set(examQuizName, exam.questions.length);

    const scoresByQuiz = scoreQuizAttemptsByQuiz(
      (attemptRes.data ?? []) as {
        quiz_name: string;
        question_index: number;
        is_correct: boolean;
      }[],
      canonicalTotals,
    );

    // Display-only run counts (F1: quiz_run rows are server-derived).
    const runCounts = new Map<string, number>();
    for (const row of (runCountRes.data ?? []) as { quiz_name: string }[]) {
      runCounts.set(row.quiz_name, (runCounts.get(row.quiz_name) ?? 0) + 1);
    }

    const checks: CheckProgress[] = checkMetas.map((c) => {
      const stats = scoresByQuiz.get(`${series}:check:${c.n}`);
      const bestScore = stats?.score ?? 0;
      return {
        n: c.n,
        bestScore,
        attempts: runCounts.get(`${series}:check:${c.n}`) ?? 0,
        passed: bestScore >= CHECK_PASS_PCT,
      };
    });

    const examStats = scoresByQuiz.get(examQuizName);
    const examBest = examStats?.score ?? 0;

    const totalLessons = getSeriesBySlug(series)?.totalLessons ?? 0;
    const allChecksPassed = checks.every((c) => c.passed);

    const progress: TierProgress = {
      lessons: { completed: completedLessons.size, total: totalLessons },
      checks,
      exam: {
        bestScore: examBest,
        attempts: runCounts.get(examQuizName) ?? 0,
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
