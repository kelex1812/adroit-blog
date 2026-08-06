/**
 * useQuizProgress — client hook for tracking quiz attempt state.
 *
 * Per ADR-004: quiz data stays client-side only (localStorage).
 * Namespaced localStorage keys: adroit-blog:quiz:<quizName>
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
}

interface UseQuizProgressReturn {
  progress: QuizProgress;
  submitAnswer: (questionIndex: number, userAnswer: number, correctAnswer: number) => void;
  resetQuiz: () => void;
}

function getQuizFromStorage(quizName: string): QuizProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${quizName}`);
    if (!stored) return null;
    return JSON.parse(stored);
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

function emptyProgress(): QuizProgress {
  return { attempts: [], total: 0, correct: 0 };
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
      };
      setProgress(newProgress);
      setQuizInStorage(quizName, newProgress);
      syncAttemptAPI(attempt);
    },
    [progress, quizName],
  );

  const resetQuiz = useCallback(() => {
    const newProgress = emptyProgress();
    setProgress(newProgress);
    setQuizInStorage(quizName, newProgress);
  }, [quizName]);

  return { progress, submitAnswer, resetQuiz };
}
