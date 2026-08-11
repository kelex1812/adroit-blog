/**
 * POST /api/progress/quiz/batch — batch exam grading (ADR-102).
 *
 * One request for the whole exam — never 60 sequential POSTs. The server:
 *   1. Origin + rate-limit checks (a batch submit is 1 request; 30/min ample).
 *   2. validateQuizName (colon tier names, ADR-101) + resolveQuizByName → must
 *      be the exam tier (reject lesson/check/bare series).
 *   3. Validates elapsedSeconds ∈ [0, 105*60 + 60] (60s grace, ADR-103) and
 *      every questionIndex/userAnswerIndex via validateIndex.
 *   4. Recomputes correctness server-side from the canonical exam.json
 *      (F3 — client isCorrect is never trusted).
 *   5. Upserts all attempt rows in one batch (`onConflict:
 *      user_id,quiz_name,question_index`).
 *   6. Inserts one quiz_run row for best-score tracking (MAX semantics).
 *   7. Returns score + per-question results for the review screen — correct
 *      answers never ship in the initial HTML.
 *
 * Double-submit guard: the client disables submit while in flight; the server
 * tolerates duplicate runs via MAX best-score semantics (attemptCount may
 * over-count on a rare double-fire — documented in the impl plan risks).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { parseQuizName, resolveQuizByName } from "@/lib/quiz";
import {
  checkOrigin,
  checkRateLimit,
  getClientIp,
  sanitiseDbError,
  validateIndex,
  validateQuizName,
} from "@/lib/api-security";
import type {
  ExamAnswer,
  ExamResultItem,
  ExamSubmitRequest,
  ExamSubmitResult,
} from "@/shared/contracts";

const EXAM_MINUTES = 105;
const EXAM_SECONDS = EXAM_MINUTES * 60;
const GRACE_SECONDS = 60;
const EXAM_PASS_PCT = 72;

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

    const body = (await req.json()) as ExamSubmitRequest | null;
    if (!body || typeof body.quizName !== "string" || !Array.isArray(body.answers)) {
      return NextResponse.json({ error: "quizName and answers required" }, { status: 400 });
    }

    /* --- Quiz-name validation + exam-tier check (ADR-101/102) --- */
    const quizErr = validateQuizName(body.quizName, "quizName");
    if (quizErr) {
      return NextResponse.json({ error: quizErr }, { status: 400 });
    }
    const parsed = parseQuizName(body.quizName);
    if (!parsed || parsed.tier !== "exam") {
      return NextResponse.json(
        { error: "quizName must be an exam tier quiz" },
        { status: 400 },
      );
    }

    const quiz = resolveQuizByName(body.quizName);
    if (!quiz) {
      return NextResponse.json({ error: "Unknown exam" }, { status: 404 });
    }
    const questionCount = quiz.questions.length;
    if (questionCount === 0) {
      return NextResponse.json({ error: "Exam has no questions" }, { status: 404 });
    }

    /* --- Elapsed-time bound (ADR-103) --- */
    if (
      typeof body.elapsedSeconds !== "number" ||
      !Number.isInteger(body.elapsedSeconds) ||
      body.elapsedSeconds < 0 ||
      body.elapsedSeconds > EXAM_SECONDS + GRACE_SECONDS
    ) {
      return NextResponse.json(
        { error: "elapsedSeconds out of range" },
        { status: 400 },
      );
    }

    /* --- Validate every answer + recompute correctness (F3) --- */
    const seenIndexes = new Set<number>();
    const results: ExamResultItem[] = [];
    const attemptRows: {
      user_id: string;
      quiz_name: string;
      question_index: number;
      correct_answer_index: number;
      user_answer_index: number;
      is_correct: boolean;
      attempted_at: string;
    }[] = [];
    let correctCount = 0;

    for (const answer of body.answers as ExamAnswer[]) {
      if (
        !answer ||
        typeof answer.questionIndex !== "number" ||
        typeof answer.userAnswerIndex !== "number"
      ) {
        return NextResponse.json({ error: "Invalid answer item" }, { status: 400 });
      }
      if (seenIndexes.has(answer.questionIndex)) {
        return NextResponse.json(
          { error: "Duplicate questionIndex" },
          { status: 400 },
        );
      }
      seenIndexes.add(answer.questionIndex);

      const qIdxErr = validateIndex(answer.questionIndex, "questionIndex", questionCount);
      if (qIdxErr) {
        return NextResponse.json({ error: qIdxErr }, { status: 400 });
      }
      const question = quiz.questions[answer.questionIndex]!;
      const aIdxErr = validateIndex(
        answer.userAnswerIndex,
        "userAnswerIndex",
        question.options.length,
      );
      if (aIdxErr) {
        return NextResponse.json({ error: aIdxErr }, { status: 400 });
      }

      const isCorrect = answer.userAnswerIndex === question.correct_answer_index;
      if (isCorrect) correctCount += 1;
      results.push({
        questionIndex: answer.questionIndex,
        isCorrect,
        correctAnswerIndex: question.correct_answer_index,
      });
    }

    /* --- Auth --- */
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
    }

    const now = new Date().toISOString();
    for (const answer of body.answers as ExamAnswer[]) {
      const question = quiz.questions[answer.questionIndex]!;
      const isCorrect = answer.userAnswerIndex === question.correct_answer_index;
      attemptRows.push({
        user_id: user.id,
        quiz_name: body.quizName,
        question_index: answer.questionIndex,
        correct_answer_index: question.correct_answer_index,
        user_answer_index: answer.userAnswerIndex,
        is_correct: isCorrect,
        attempted_at: now,
      });
    }

    /* --- Batch upsert attempts (one request, onConflict upsert) --- */
    if (attemptRows.length > 0) {
      const { error } = await supabase
        .from("quiz_attempt")
        .upsert(attemptRows, { onConflict: "user_id,quiz_name,question_index" });
      if (error) {
        return NextResponse.json({ status: "error", error: sanitiseDbError(error) }, { status: 500 });
      }
    }

    /* --- Insert one quiz_run row (best-score MAX semantics) --- */
    const score = Math.round((correctCount / questionCount) * 100);
    const { error: runErr } = await supabase.from("quiz_run").insert({
      user_id: user.id,
      quiz_name: body.quizName,
      correct: correctCount,
      total: questionCount,
      score,
      completed_at: now,
    });
    if (runErr) {
      return NextResponse.json({ status: "error", error: sanitiseDbError(runErr) }, { status: 500 });
    }

    const result: ExamSubmitResult = {
      score,
      correct: correctCount,
      total: questionCount,
      passed: score >= EXAM_PASS_PCT,
      results,
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
