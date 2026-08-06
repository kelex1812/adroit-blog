/**
 * QuizWidget — interactive multiple-choice quiz component.
 *
 * Matches design/mockup-quiz.html: segment progress bar, 4-option MCQ with
 * radio states (selected / correct / wrong / correct-unselected), "Why"
 * explanation panel, and a score-ring results card.
 * Uses useQuizProgress hook for localStorage-only state (ADR-004).
 */
"use client";

import { useEffect, useState } from "react";
import { useQuizProgress } from "@/lib/hooks/useQuizProgress";

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer_index: number;
  explanation?: string;
}

interface QuizWidgetProps {
  quizName: string;
  questions: QuizQuestion[];
}

export default function QuizWidget({
  quizName,
  questions,
}: QuizWidgetProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  // Score ring Moment fill (QA M-2): starts 0 and animates to the final
  // dasharray once the results view mounts — setting the final value at
  // mount meant the CSS transition had no from→to change and never played.
  const [ringFilled, setRingFilled] = useState(false);

  const { progress, hydrated, submitAnswer, resetQuiz } = useQuizProgress(
    quizName,
    questions.length,
  );

  const answeredIndexes = new Set(
    progress.attempts.map((a) => a.questionIndex),
  );
  const isAnswered = answeredIndexes.has(currentQ);
  const question = questions[currentQ];

  const allAnswered = questions.length > 0 && questions.every((_, i) => answeredIndexes.has(i));

  // Score ring Moment fill (QA M-2): when the results view becomes visible,
  // flip ringFilled on the next animation frame so the CSS transition has a
  // from→to pair (0 → final dasharray) and actually plays. Retake resets it
  // in the handler so every completion re-animates.
  useEffect(() => {
    if (!hydrated) return;
    if (allAnswered || currentQ >= questions.length) {
      const raf = requestAnimationFrame(() => setRingFilled(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [allAnswered, currentQ, questions.length, hydrated]);

  // Hydration gate (QA F-1): before the stored quiz state has been read
  // after mount, render a placeholder instead of the question/results view.
  // This keeps server HTML and the client's first paint identical — the
  // server always renders the empty state, and the client does too until
  // useQuizProgress has hydrated. Avoids the "Hydration failed because the
  // server rendered HTML didn't match the client" error for returning users.
  if (!hydrated) {
    return (
      <div className="mt-8 max-w-[640px] rounded-[20px] border border-gray-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-red uppercase tracking-[0.08em] mb-1.5">
          <span className="w-[3px] h-3 rounded-sm bg-red" />
          Quiz
        </div>
        <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse mb-4" />
        <div className="h-4 w-full rounded bg-gray-100 animate-pulse mb-2" />
        <div className="h-4 w-5/6 rounded bg-gray-100 animate-pulse mb-6" />
        <div className="flex flex-col gap-2.5 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-[14px] bg-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="h-11 w-2/3 rounded-xl bg-gray-100 animate-pulse" />
        <span className="sr-only">Loading quiz…</span>
      </div>
    );
  }

  function handleSelect(index: number) {
    if (isAnswered) return;
    setSelected(index);
  }

  // WAI-ARIA radiogroup arrow-key roving (QA F-4): ArrowDown/Right move to
  // the next option, ArrowUp/Left to the previous, wrapping around. The
  // newly focused option becomes selected (automatic-activation pattern).
  function handleRadiogroupKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (isAnswered) return; // options disabled after submission
    const dir =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (dir === 0) return;
    event.preventDefault();
    const optionCount = question.options.length;
    const start = selected === null ? -1 : selected;
    const next = (start + dir + optionCount) % optionCount;
    handleSelect(next);
    document.getElementById(`quiz-option-${quizName}-${currentQ}-${next}`)?.focus();
  }

  function handleSubmit() {
    if (selected === null || !question) return;
    submitAnswer(currentQ, selected, question.correct_answer_index);
    setShowExplanation(true);
  }

  function handleNext() {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setSelected(null);
      setShowExplanation(false);
    } else {
      setCurrentQ(questions.length); // jump to results
    }
  }

  // Results view
  if (allAnswered || currentQ >= questions.length) {
    return (
      <div className="mt-8 max-w-[640px]">
        <div className="rounded-[20px] border border-gray-200 bg-white p-8 text-center shadow-sm">
          {/* Score ring */}
          <h2 className="sr-only">Quiz results</h2>
          <div className="relative w-32 h-32 mx-auto mb-4">
            <svg
              viewBox="0 0 128 128"
              className="w-full h-full -rotate-90"
              role="img"
              aria-label={`${progress.correct} of ${progress.total} questions correct`}
            >
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke="var(--color-gray-200, #E5E7EB)"
                strokeWidth="10"
              />
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke="var(--color-red, #C8102E)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${ringFilled && progress.total > 0 ? (progress.correct / progress.total) * 339.3 : 0} 339.3`}
                className="transition-[stroke-dasharray] duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-mono text-[1.75rem] font-extrabold text-navy tabular-nums">
              {progress.correct}/{progress.total}
            </div>
          </div>
          <p className="text-[12.5px] text-gray-500 mb-6">
            {progress.total === 0
              ? "No answers yet."
              : progress.correct === progress.total
                ? "Perfect score — all questions answered correctly."
                : `${Math.round((progress.correct / progress.total) * 100)}% correct — review the explanations below.`}
          </p>

          {/* Preserved score + attempt history (US-005 AC4) */}
          {progress.attemptCount > 0 && (
            <div className="flex items-center justify-center gap-4 mb-5 font-mono text-[10.5px] font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                Best score {progress.bestScore}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-navy/40" />
                {progress.attemptCount}{" "}
                {progress.attemptCount === 1 ? "attempt" : "attempts"}
              </span>
            </div>
          )}

          {/* Review list */}
          <div className="text-left mb-6">
            {questions.map((q, i) => {
              const attempt = progress.attempts.find((a) => a.questionIndex === i);
              const correct = attempt?.isCorrect ?? false;
              return (
                <div
                  key={i}
                  className="flex items-start gap-2.5 py-2.5 border-b border-gray-100 text-[12.5px] last:border-0"
                >
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4 mt-0.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={correct ? "var(--color-red, #C8102E)" : "var(--color-gray-400, #9CA3AF)"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {correct ? (
                      <path d="M20 6L9 17l-5-5" />
                    ) : (
                      <circle cx="12" cy="12" r="9" />
                    )}
                  </svg>
                  <span className="text-gray-600 leading-relaxed">
                    {i + 1}. {q.question}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => {
              resetQuiz();
              setCurrentQ(0);
              setSelected(null);
              setShowExplanation(false);
              setRingFilled(false); // re-arm so the next completion re-animates
            }}
            className="w-full h-11 rounded-xl bg-navy text-white text-sm font-bold cursor-pointer hover:bg-navy-light active:scale-[0.98] transition-all duration-150"
          >
            Retake quiz
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  const isCorrect = selected !== null && selected === question.correct_answer_index;

  const segmentsLabel = questions
    .map((_, i) => {
      const attempt = progress.attempts.find((a) => a.questionIndex === i);
      return attempt
        ? `Question ${i + 1} ${attempt.isCorrect ? "correct" : "incorrect"}`
        : `Question ${i + 1} unanswered`;
    })
    .join(". ");

  return (
    <div className="mt-8 max-w-[640px] rounded-[20px] border border-gray-200 bg-white p-7 shadow-sm">
      {/* Kicker */}
      <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-red uppercase tracking-[0.08em] mb-1.5">
        <span className="w-[3px] h-3 rounded-sm bg-red" />
        Quiz
      </div>

      {/* Progress label + segment bar */}
      <div className="font-mono text-[11.5px] text-gray-500 mb-4">
        Question {currentQ + 1} of {questions.length}
      </div>
      <div
        role="img"
        aria-label={`Quiz progress: ${segmentsLabel}`}
        className="flex gap-[5px] mb-5"
      >
        {questions.map((_, i) => {
          const answered = answeredIndexes.has(i);
          const correct = progress.attempts.find((a) => a.questionIndex === i)?.isCorrect;
          return (
            <div
              key={i}
              title={answered ? (correct ? "Correct" : "Incorrect") : "Unanswered"}
              className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                answered
                  ? correct
                    ? "bg-green-500"
                    : "bg-red"
                  : "bg-gray-200"
              }`}
            />
          );
        })}
      </div>

      {/* Segment legend — non-color state cues (WCAG 1.4.1) */}
      {answeredIndexes.size > 0 && (
        <div
          aria-hidden="true"
          className="flex items-center gap-4 -mt-2 mb-5 font-mono text-[10px] font-medium text-gray-500"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border-[1.5px] border-green-500 text-green-700 text-[9px] font-bold leading-none">
              ✓
            </span>
            correct
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border-[1.5px] border-red text-red text-[9px] font-bold leading-none">
              ✕
            </span>
            incorrect
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border-[1.5px] border-gray-300" />
            unanswered
          </span>
        </div>
      )}

      <p className="text-[17px] font-bold text-navy leading-snug mb-[18px]">
        {question.question}
      </p>

      <div
        className="flex flex-col gap-2.5 mb-5"
        role="radiogroup"
        aria-label="Answer options"
        onKeyDown={handleRadiogroupKeyDown}
      >
        {question.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrectOption = i === question.correct_answer_index;
          const showTag = isAnswered && (isCorrectOption || isSelected);

          let borderClass = "border-gray-200 bg-white hover:border-navy/40 hover:bg-navy/[0.02]";
          let radioClass = "border-gray-300";
          let radioFill = "";
          let textClass = "text-gray-700";

          if (isAnswered) {
            if (isCorrectOption) {
              borderClass = "border-green-500 bg-green-50";
              radioClass = "border-green-500 bg-green-500";
              radioFill = "bg-white";
              textClass = "text-green-800";
            } else if (isSelected && !isCorrectOption) {
              borderClass = "border-red bg-[#FDE8EB]";
              radioClass = "border-red bg-red";
              radioFill = "bg-white";
              textClass = "text-red-800";
            } else if (isSelected) {
              borderClass = "border-green-500 bg-white";
              radioClass = "border-green-500";
              radioFill = "";
              textClass = "text-gray-700";
            }
          } else if (isSelected) {
            borderClass = "border-navy bg-navy/[0.03]";
            radioClass = "border-navy";
            radioFill = "bg-navy";
            textClass = "text-gray-700";
          }

          return (
            <button
              key={i}
              id={`quiz-option-${quizName}-${currentQ}-${i}`}
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(i)}
              disabled={isAnswered}
              className={`w-full min-h-12 flex items-center gap-3 px-4 rounded-[14px] border-[1.5px] text-left text-[14.5px] font-medium transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${borderClass} ${textClass}`}
            >
              <span
                className={`w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-150 ${radioClass}`}
              >
                <span className={`w-2 h-2 rounded-full ${radioFill}`} />
              </span>
              {option}
              {showTag && (
                <span className="ml-auto font-mono text-[10px] font-bold uppercase tracking-wide">
                  {isCorrectOption
                    ? isSelected
                      ? "Correct"
                      : "Correct answer"
                    : "Your answer"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Answer correctness live region (WCAG 4.1.3) */}
      <span role="status" className="sr-only">
        {showExplanation ? (isCorrect ? "Correct answer" : "Incorrect answer") : ""}
      </span>

      {/* Explanation panel */}
      {showExplanation && question.explanation && (
        <div
          role="status"
          className={`reveal-up rounded-[14px] border p-[18px] mb-5 text-[13px] leading-relaxed ${
            isCorrect
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red/20 bg-red/5 text-gray-600"
          }`}
        >
          <div className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em] mb-1.5">
            Why
          </div>
          <p>{question.explanation}</p>
        </div>
      )}

      <div className="flex gap-2.5">
        {!isAnswered ? (
          <button
            onClick={handleSubmit}
            disabled={selected === null}
            className="flex-[2] h-11 rounded-xl bg-navy text-white text-[13.5px] font-bold cursor-pointer hover:bg-navy-light active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex-[2] h-11 rounded-xl bg-navy text-white text-[13.5px] font-bold cursor-pointer hover:bg-navy-light active:scale-[0.98] transition-all duration-150"
          >
            {currentQ < questions.length - 1 ? "Next Question" : "View Results"}
          </button>
        )}
      </div>
    </div>
  );
}
