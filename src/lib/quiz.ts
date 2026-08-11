/**
 * Quiz data access — loads per-tier quiz JSON for the learn series:
 *
 *   content/<series>/questions.json              legacy series quiz (getQuizForSeries)
 *   content/learn/<series>/questions/<slug>.json per-lesson quiz   (getQuizForLesson)
 *   content/learn/<series>/checks/check-<n>.json knowledge check   (getKnowledgeCheck)
 *   content/learn/<series>/exam.json             cert prep exam     (getCertExam)
 *
 * Mirrors the pattern used by lib/learn.ts for MDX content. All functions
 * reject invalid series/slug/n via the QUIZ_SERIES_RE guard (no dots/slashes
 * → no path traversal).
 */
import fs from "fs";
import path from "path";

import type {
  KnowledgeCheckMeta,
  ParsedQuizName,
  QuizData,
  QuizQuestion,
  QuizTier,
} from "@/shared/contracts";

export type { QuizData, QuizQuestion, KnowledgeCheckMeta, ParsedQuizName, QuizTier };

/**
 * Strict charset for values that flow into a filesystem path join.
 * Kebab/snake-case slugs only — no dots, slashes, or path separators
 * (blocks `../` traversal). Defense-in-depth: the API routes already
 * validate via `validateSlug`/`validateQuizName`, but page routes feed the
 * raw `series` URL param here, so the join itself must refuse anything unsafe.
 * (Security audit t_4ee14a75 F2.)
 */
const QUIZ_SERIES_RE = /^[a-zA-Z0-9_-]+$/;

/** Max accepted length for series/slug/id segments (matches api-security). */
const SEGMENT_MAX = 200;

function isValidSegment(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= SEGMENT_MAX &&
    QUIZ_SERIES_RE.test(value)
  );
}

/** Read + parse a quiz JSON file, or null when missing/invalid. */
function readQuizJson(quizPath: string): QuizData | null {
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

/** Root of a series' tier quiz files: content/learn/<series>/. */
function tierRoot(series: string): string {
  return path.join(process.cwd(), "content", "learn", series);
}

/** Read a series quiz from `content/<series>/questions.json`, or null. */
export function getQuizForSeries(series: string): QuizData | null {
  if (!isValidSegment(series)) {
    console.warn("[quiz] rejecting invalid series slug:", JSON.stringify(series));
    return null;
  }
  return readQuizJson(
    path.join(process.cwd(), "content", series, "questions.json"),
  );
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

/* ------------------------------------------------------------------ */
/*  Tier lookups (ADR-101)                                             */
/* ------------------------------------------------------------------ */

/**
 * Per-lesson quiz from `content/learn/<series>/questions/<slug>.json`, or null.
 * Lesson quizName scheme: `<series>:lesson:<slug>`.
 */
export function getQuizForLesson(series: string, slug: string): QuizData | null {
  if (!isValidSegment(series) || !isValidSegment(slug)) return null;
  return readQuizJson(path.join(tierRoot(series), "questions", `${slug}.json`));
}

/**
 * Knowledge-check metadata for a series: scans `content/learn/<series>/checks/`
 * for `check-<n>.json` and returns `[{ n, lessons: [a, b] }]` sorted by n.
 * Check n covers lessons [5n−4, 5n]. Empty array when the dir is missing.
 */
export function getKnowledgeChecks(series: string): KnowledgeCheckMeta[] {
  if (!isValidSegment(series)) return [];
  const dir = path.join(tierRoot(series), "checks");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const checks: KnowledgeCheckMeta[] = [];
  for (const file of files) {
    const m = /^check-(\d+)\.json$/.exec(file);
    if (!m) continue;
    const n = parseInt(m[1]!, 10);
    if (!Number.isInteger(n) || n < 1) continue;
    checks.push({ n, lessons: [5 * n - 4, 5 * n] });
  }
  return checks.sort((a, b) => a.n - b.n);
}

/**
 * Knowledge check quiz from `content/learn/<series>/checks/check-<n>.json`,
 * or null. n validated to a positive integer (actual range checked by caller
 * against getKnowledgeChecks when needed).
 */
export function getKnowledgeCheck(series: string, n: number): QuizData | null {
  if (!isValidSegment(series) || !Number.isInteger(n) || n < 1) return null;
  return readQuizJson(path.join(tierRoot(series), "checks", `check-${n}.json`));
}

/**
 * Cert prep exam from `content/learn/<series>/exam.json`, or null.
 * Exam quizName scheme: `<series>:exam`.
 */
export function getCertExam(series: string): QuizData | null {
  if (!isValidSegment(series)) return null;
  return readQuizJson(path.join(tierRoot(series), "exam.json"));
}

/* ------------------------------------------------------------------ */
/*  Quiz-name resolver (ADR-101)                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a tier quiz name into its parts:
 *   `omni-studio-cert:lesson:day-01-f1` → { series, tier: "lesson", id: slug }
 *   `omni-studio-cert:check:3`          → { series, tier: "check", id: "3" }
 *   `omni-studio-cert:exam`             → { series, tier: "exam", id: "exam" }
 * Bare series names (legacy `omni-studio-cert`) return null — resolveQuizByName
 * falls back to getQuizForSeries for those.
 */
export function parseQuizName(quizName: string): ParsedQuizName | null {
  if (typeof quizName !== "string" || quizName.length === 0) return null;
  const parts = quizName.split(":");
  if (parts.length < 2) return null;
  const series = parts[0]!;
  const tier = parts[1] as QuizTier;
  if (!isValidSegment(series)) return null;
  if (tier === "exam" && parts.length === 2) {
    return { series, tier: "exam", id: "exam" };
  }
  if ((tier === "lesson" || tier === "check") && parts.length === 3) {
    const id = parts[2]!;
    if (!isValidSegment(id)) return null;
    return { series, tier, id };
  }
  return null;
}

/**
 * Resolve a quiz name to its canonical QuizData:
 *  - tier names (`<series>:lesson:<slug>` etc.) dispatch to the tier lookup
 *  - bare series names fall back to the legacy getQuizForSeries
 * Returns null when unknown/invalid.
 */
export function resolveQuizByName(quizName: string): QuizData | null {
  const parsed = parseQuizName(quizName);
  if (!parsed) {
    // Legacy series-scoped quiz name (e.g. "omni-studio-cert") — the grading
    // route previously passed the whole quizName to getQuizForSeries.
    return getQuizForSeries(quizName);
  }
  switch (parsed.tier) {
    case "lesson":
      return getQuizForLesson(parsed.series, parsed.id);
    case "check": {
      const n = parseInt(parsed.id, 10);
      return getKnowledgeCheck(parsed.series, n);
    }
    case "exam":
      return getCertExam(parsed.series);
    default:
      return null;
  }
}
