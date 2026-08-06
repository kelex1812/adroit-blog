/**
 * Quiz data access — loads `content/<series>/questions.json` at build/request
 * time. Mirrors the pattern used by lib/learn.ts for MDX content.
 */
import fs from "fs";
import path from "path";

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer_index: number;
  explanation?: string;
}

export interface QuizData {
  quizName: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
}

/** Read a series quiz from `content/<series>/questions.json`, or null. */
export function getQuizForSeries(series: string): QuizData | null {
  const quizPath = path.join(
    process.cwd(),
    "content",
    series,
    "questions.json",
  );
  try {
    const raw = fs.readFileSync(quizPath, "utf-8");
    const parsed = JSON.parse(raw) as QuizData;
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** All series slugs that currently ship a quiz. */
export function getQuizSeriesSlugs(): string[] {
  const root = path.join(process.cwd(), "content");
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, "questions.json")))
      .map((d) => d.name);
  } catch {
    return [];
  }
}
