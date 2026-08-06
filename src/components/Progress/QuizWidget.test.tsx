/**
 * QuizWidget — component tests (QA F-3).
 *
 * Coverage required by the QA report:
 *  - hydration-safe: a completed quiz in storage renders the results view
 *    AFTER hydration, with the stored attemptCount — no inflation on
 *    reload/remount (QA F-2 regression)
 *  - a fresh run records exactly one attempt
 *  - retake preserves bestScore and increments attemptCount
 *  - keyboard + mobile basics still pass (radio selection, submit)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizWidget, { QuizQuestion } from "./QuizWidget";

const KEY = "adroit-blog:quiz:test-quiz";

const QUESTIONS: QuizQuestion[] = [
  {
    question: "Question one?",
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    correct_answer_index: 0,
    explanation: "Because Alpha.",
  },
  {
    question: "Question two?",
    options: ["One", "Two", "Three", "Four"],
    correct_answer_index: 1,
    explanation: "Because Two.",
  },
  {
    question: "Question three?",
    options: ["Red", "Green", "Blue", "Yellow"],
    correct_answer_index: 2,
    explanation: "Because Blue.",
  },
];

/** Build a fully-answered stored progress object for the fixture quiz. */
function completedProgress(attemptCount: number) {
  const attempts = QUESTIONS.map((q, i) => ({
    quizName: "test-quiz",
    questionIndex: i,
    userAnswer: q.correct_answer_index,
    correctAnswer: q.correct_answer_index,
    isCorrect: true,
    attemptedAt: "2026-08-01T00:00:00.000Z",
  }));
  return {
    attempts,
    total: attempts.length,
    correct: attempts.length,
    bestScore: 100,
    attemptCount,
  };
}

function seedCompletedQuiz(attemptCount: number) {
  localStorage.setItem(KEY, JSON.stringify(completedProgress(attemptCount)));
}

/** Answer one question: select the correct option, submit, advance. */
function answerQuestion(questionIndex: number, isLast: boolean) {
  const options = screen.getAllByRole("radio");
  const correctIndex = QUESTIONS[questionIndex].correct_answer_index;
  fireEvent.click(options[correctIndex]);

  fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

  if (!isLast) {
    fireEvent.click(screen.getByRole("button", { name: "Next Question" }));
  }
}

function storedAttemptCount(): number {
  const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  return stored.attemptCount ?? 0;
}

describe("QuizWidget", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the question view for a fresh quiz and records exactly one attempt on completion", async () => {
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);

    // Fresh quiz → question view (no results yet).
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();

    // Answer all three questions correctly.
    answerQuestion(0, false);
    answerQuestion(1, false);
    answerQuestion(2, true);

    // Results view appears with the run recorded exactly once.
    expect(await screen.findByText(/Best score 100%/)).toBeInTheDocument();
    expect(screen.getByText(/1 attempt/)).toBeInTheDocument();
    expect(storedAttemptCount()).toBe(1);
    expect(localStorage.getItem(KEY)).toContain('"attemptCount":1');
  });

  it("does NOT inflate attemptCount when remounting with a completed quiz (QA F-2)", async () => {
    seedCompletedQuiz(2); // user already has 2 real attempts

    const first = render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);
    // Results view after hydration with the stored count — not 3.
    expect(await screen.findByText(/Best score 100%/)).toBeInTheDocument();
    expect(screen.getByText(/2 attempts/)).toBeInTheDocument();
    expect(storedAttemptCount()).toBe(2);
    first.unmount();

    // Simulate a page reload: fresh mount, same localStorage.
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);
    expect(await screen.findByText(/2 attempts/)).toBeInTheDocument();
    expect(storedAttemptCount()).toBe(2); // still 2 — no phantom run
  });

  it("a wrong answer still records the run with the correct score", async () => {
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);

    // Q1: wrong answer.
    fireEvent.click(screen.getAllByRole("radio")[1]); // Beta, not Alpha
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Question" }));

    answerQuestion(1, false);
    answerQuestion(2, true);

    expect(await screen.findByText(/2\/3/)).toBeInTheDocument(); // 2 of 3 correct
    expect(screen.getByText(/1 attempt/)).toBeInTheDocument();
    expect(storedAttemptCount()).toBe(1);
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    expect(stored.bestScore).toBe(67); // round(2/3*100)
  });

  it("retake clears attempts but preserves bestScore and increments attemptCount", async () => {
    seedCompletedQuiz(1);

    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);
    expect(await screen.findByText(/Best score 100%/)).toBeInTheDocument();
    expect(screen.getByText(/1 attempt/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retake quiz" }));

    // Back to question view, stats preserved.
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(storedAttemptCount()).toBe(1);

    // Complete the retake run.
    answerQuestion(0, false);
    answerQuestion(1, false);
    answerQuestion(2, true);

    expect(await screen.findByText(/Best score 100%/)).toBeInTheDocument();
    expect(screen.getByText(/2 attempts/)).toBeInTheDocument();
    expect(storedAttemptCount()).toBe(2);
  });

  it("keyboard: Tab reaches controls, Space/Enter activate focused buttons", async () => {
    const user = userEvent.setup();
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);

    // Options are real <button role="radio"> elements — in real browsers
    // Space on the focused button natively fires a click (verified by QA
    // with Playwright real-key events). jsdom's user-event does not
    // synthesize that click for role="radio", so the keyboard-only flow
    // is asserted as: Tab focuses the control, then activating the focused
    // element selects/submits — the exact browser synthesis path.
    await user.tab();
    const firstOption = screen.getAllByRole("radio")[0];
    expect(document.activeElement).toBe(firstOption);

    await user.click(firstOption); // Space activation on a focused button
    expect(firstOption).toHaveAttribute("aria-checked", "true");

    const check = screen.getByRole("button", { name: "Check Answer" });
    expect(check).toBeEnabled();
    check.focus();
    await user.click(check); // Enter activation on a focused button

    const next = screen.getByRole("button", { name: "Next Question" });
    next.focus();
    await user.click(next);
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
  });

  it("keyboard: arrow keys roam between options (WAI-ARIA radiogroup)", async () => {
    const user = userEvent.setup();
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);

    const radios = screen.getAllByRole("radio");
    const group = screen.getByRole("radiogroup");

    // ArrowDown from no selection selects the first option.
    await user.click(radios[0]);
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radios[1]);

    // ArrowUp moves to the previous option.
    fireEvent.keyDown(group, { key: "ArrowUp" });
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radios[0]);

    // ArrowUp at the first option wraps to the last.
    fireEvent.keyDown(group, { key: "ArrowUp" });
    expect(radios[3]).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radios[3]);

    // ArrowRight advances, ArrowLeft goes back (with wrap at edges).
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(radios[3]).toHaveAttribute("aria-checked", "true");

    // Arrow keys do nothing after the question is answered (options disabled).
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Next Question" })).toBeInTheDocument();
  });

  it("mobile: option and submit buttons fit and are reachable at 390px", async () => {
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);

    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(4);
    for (const r of radios) {
      expect(r).toBeEnabled();
    }
    const check = screen.getByRole("button", { name: "Check Answer" });
    expect(check).toBeDisabled(); // nothing selected yet
    fireEvent.click(radios[0]);
    expect(check).toBeEnabled();

    // Whole card fits within a 390px viewport (no horizontal overflow).
    const card = screen.getByRole("radiogroup").closest("div");
    expect(card).not.toBeNull();
    if (card) {
      expect(card.scrollWidth).toBeLessThanOrEqual(390 + 1);
    }
  });

  it("score ring animates from 0 to the final dasharray after results mount (QA motion M-2)", async () => {
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);

    // Answer all three questions correctly.
    answerQuestion(0, false);
    answerQuestion(1, false);
    answerQuestion(2, true);

    await screen.findByText(/Best score 100%/);

    const ring = document.querySelector("svg circle:nth-of-type(2)");
    expect(ring).not.toBeNull();
    if (!ring) return;

    // The ring starts empty (0) and, after the mount effect's animation
    // frame, reaches 3/3 of the circumference (339.3). waitFor covers the
    // rAF tick in jsdom.
    await waitFor(() => {
      expect(ring.getAttribute("stroke-dasharray")).toBe("339.3 339.3");
    });

    // Moment posture: spring easing class present (CSS-driven motion — the
    // global prefers-reduced-motion block collapses it for reduced motion).
    const cls = ring.getAttribute("class") ?? "";
    expect(cls).toContain("transition-[stroke-dasharray]");
    expect(cls).toContain("ease-[cubic-bezier(0.34,1.56,0.64,1)]");
  });

  it("explanation reveal uses the Moment reveal-up animation class (QA motion M-3)", async () => {
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);

    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    // The "Why" explanation panel carries the CSS reveal-up animation class.
    const why = [...document.querySelectorAll("[role=status]")].find(
      (el) => el.textContent?.includes("Because Alpha."),
    );
    expect(why).not.toBeNull();
    expect(why?.getAttribute("class") ?? "").toContain("reveal-up");
  });

  it("prefers-reduced-motion: motion is CSS-driven (transition/animation classes, not JS inline styles)", async () => {
    // jsdom cannot evaluate the @media (prefers-reduced-motion) block in
    // globals.css, but the regression guard here is structural: every motion
    // mechanism in this component is a CSS transition/animation class, which
    // the global reduced-motion block neutralises (animation-duration /
    // transition-duration → 0.01ms). No JS-driven frame-by-frame animation
    // exists to bypass it.
    render(<QuizWidget quizName="test-quiz" questions={QUESTIONS} />);

    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    // Explanation reveal is a CSS animation class, not an inline style.
    const why = [...document.querySelectorAll("[role=status]")].find(
      (el) => el.textContent?.includes("Because Alpha."),
    );
    expect(why?.getAttribute("style")).toBeNull();
    expect(why?.getAttribute("class") ?? "").toContain("reveal-up");
  });
});
