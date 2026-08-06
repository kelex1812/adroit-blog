/**
 * QuizWidget — interactive multiple-choice quiz component.
 *
 * Matches design/mockup-quiz.html: segment progress bar, 4-option MCQ with
 * radio states (selected / correct / wrong / correct-unselected), "Why"
 * explanation panel, and a score-ring results card.
 * Uses useQuizProgress hook for localStorage-only state (ADR-004).
 */
"use client";

import { useState } from "react";
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

  const { progress, submitAnswer, resetQuiz } = useQuizProgress(quizName);

  const answeredIndexes = new Set(
    progress.attempts.map((a) => a.questionIndex),
  );
  const isAnswered = answeredIndexes.has(currentQ);
  const question = questions[currentQ];

  const allAnswered = questions.length > 0 && questions.every((_, i) => answeredIndexes.has(i));

  function handleSelect(index: number) {
    if (isAnswered) return;
    setSelected(index);
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
                strokeDasharray={`${(progress.total > 0 ? (progress.correct / progress.total) * 339.3 : 0)} 339.3`}
                className="transition-[stroke-dasharray] duration-500"
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
            }}
            className="w-full h-11 rounded-xl bg-navy text-white text-sm font-bold cursor-pointer hover:bg-navy-light transition-colors duration-150"
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
          className={`rounded-[14px] border p-[18px] mb-5 text-[13px] leading-relaxed ${
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
            className="flex-[2] h-11 rounded-xl bg-navy text-white text-[13.5px] font-bold cursor-pointer hover:bg-navy-light transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex-[2] h-11 rounded-xl bg-navy text-white text-[13.5px] font-bold cursor-pointer hover:bg-navy-light transition-colors duration-150"
          >
            {currentQ < questions.length - 1 ? "Next Question" : "View Results"}
          </button>
        )}
      </div>
    </div>
  );
}
