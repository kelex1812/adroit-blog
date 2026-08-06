/**
 * useQuizProgress — client hook for tracking quiz attempt state.
 *
 * Per ADR-004: quiz data stays client-side (localStorage).
 * Namespaced localStorage keys: adroit-blog:quiz:<quizName>
 *
 * Score preservation (BA requirement, US-005 AC4): the current run's
 * per-question attempts are cleared on retake, but `bestScore` and
 * `attemptCount` (completed runs) are preserved so the original score
 * is never wiped.
 */
"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY_PREFIX = "adroit-blog:quiz:";

interface QuizAttempt {
  quizName: string;
  questionIndex: number;
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  attemptedAt: string;
}

interface QuizProgress {
  attempts: QuizAttempt[];
  total: number;
  correct: number;
  /** Best completed-run score as a percentage (0-100). */
  bestScore: number;
  /** Number of completed full runs (retakes increment this). */
  attemptCount: number;
}

interface UseQuizProgressReturn {
  progress: QuizProgress;
  submitAnswer: (questionIndex: number, userAnswer: number, correctAnswer: number) => void;
  resetQuiz: () => void;
  /** Record a completed run (updates bestScore/attemptCount + syncs stats). */
  completeRun: () => void;
}

function getQuizFromStorage(quizName: string): QuizProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${quizName}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as QuizProgress;
    // Backfill older stored shapes that predate bestScore/attemptCount
    if (typeof parsed.bestScore !== "number") parsed.bestScore = 0;
    if (typeof parsed.attemptCount !== "number") parsed.attemptCount = 0;
    return parsed;
  } catch {
    return null;
  }
}

function setQuizInStorage(quizName: string, progress: QuizProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${quizName}`, JSON.stringify(progress));
  } catch {
    // silent fail
  }
}

/** Fire-and-forget sync of a single quiz attempt to Supabase (authed only). */
async function syncAttemptAPI(attempt: QuizAttempt): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/progress/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizName: attempt.quizName,
        questionIndex: attempt.questionIndex,
        userAnswerIndex: attempt.userAnswer,
        correctAnswerIndex: attempt.correctAnswer,
        isCorrect: attempt.isCorrect,
      }),
    });
  } catch {
    // fire-and-forget — localStorage remains authoritative
  }
}

/** Fire-and-forget sync of a completed quiz run (score stats). */
async function syncRunAPI(quizName: string, correct: number, total: number): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/progress/quiz/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizName, correct, total }),
    });
  } catch {
    // fire-and-forget — localStorage remains authoritative
  }
}

function emptyProgress(): QuizProgress {
  return { attempts: [], total: 0, correct: 0, bestScore: 0, attemptCount: 0 };
}

export function useQuizProgress(quizName: string): UseQuizProgressReturn {
  const [progress, setProgress] = useState<QuizProgress>(() => {
    const stored = getQuizFromStorage(quizName);
    return stored || emptyProgress();
  });

  const submitAnswer = useCallback(
    (questionIndex: number, userAnswer: number, correctAnswer: number) => {
      const isCorrect = userAnswer === correctAnswer;
      const attempt: QuizAttempt = {
        quizName,
        questionIndex,
        userAnswer,
        correctAnswer,
        isCorrect,
        attemptedAt: new Date().toISOString(),
      };
      const newAttempts = [...progress.attempts, attempt];
      const newProgress: QuizProgress = {
        attempts: newAttempts,
        total: newAttempts.length,
        correct: newAttempts.filter((a) => a.isCorrect).length,
        bestScore: progress.bestScore,
        attemptCount: progress.attemptCount,
      };
      setProgress(newProgress);
      setQuizInStorage(quizName, newProgress);
      syncAttemptAPI(attempt);
    },
    [progress, quizName],
  );

  const resetQuiz = useCallback(() => {
    // Preserve bestScore + attemptCount — retaking must not wipe the
    // original score (BA requirement, US-005 AC4).
    const newProgress: QuizProgress = {
      attempts: [],
      total: 0,
      correct: 0,
      bestScore: progress.bestScore,
      attemptCount: progress.attemptCount,
    };
    setProgress(newProgress);
    setQuizInStorage(quizName, newProgress);
  }, [progress.bestScore, progress.attemptCount, quizName]);

  const completeRun = useCallback(() => {
    if (progress.total === 0) return;
    const pct = quizScorePercentage(progress);
    const newProgress: QuizProgress = {
      ...progress,
      bestScore: Math.max(progress.bestScore, pct),
      attemptCount: progress.attemptCount + 1,
    };
    setProgress(newProgress);
    setQuizInStorage(quizName, newProgress);
    syncRunAPI(quizName, progress.correct, progress.total);
  }, [progress, quizName]);

  return { progress, submitAnswer, resetQuiz, completeRun };
}

/** Score a completed run (0-100) — used by QuizWidget to persist stats. */
export function quizScorePercentage(progress: QuizProgress): number {
  if (progress.total === 0) return 0;
  return Math.round((progress.correct / progress.total) * 100);
}
