/**
 * POST /api/progress/quiz — submit a quiz attempt.
 *
 * Per ADR-004: quiz data primarily stays client-side (localStorage via
 * useQuizProgress hook). For authenticated users, the attempt is also
 * persisted to the quiz_attempt Supabase table so progress survives
 * device changes and session resets.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      quizName: string;
      questionIndex: number;
      userAnswerIndex: number;
      correctAnswerIndex: number;
      isCorrect: boolean;
    } | null;

    if (!body || !body.quizName) {
      return NextResponse.json({ status: "ok" });
    }

    const { quizName, questionIndex, userAnswerIndex, correctAnswerIndex, isCorrect } = body;

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ status: "unauthenticated" });
    }

    const { error } = await supabase.from("quiz_attempt").insert({
      user_id: user.id,
      quiz_name: quizName,
      question_index: questionIndex,
      correct_answer_index: correctAnswerIndex,
      user_answer_index: userAnswerIndex,
      is_correct: isCorrect,
      attempted_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    // Client keeps the authoritative copy in localStorage
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}