import fs from "fs";
import path from "path";
import { learnLessons, learnSeries } from "@/data/learn";
import { LearnLesson, LearningSeries } from "@/data/types";
import { sortLessonsByLessonNumber } from "@/lib/lesson-sort";

/**
 * Learn tab data-access seam (ADR-002, superseded for lesson listings by
 * ADR-105).
 *
 * Ordering contract:
 *  - LESSON listings (series syllabus) are ordered by LESSON NUMBER ascending
 *    (ADR-105, course progression pattern) — NOT date. build-learn.js enforces
 *    this at generation time; getLessonsForSeries re-sorts defensively so a
 *    component can never accidentally render stale order. Missing lesson
 *    numbers (0) sort last, stable.
 *  - SERIES-level listings (learn hub PathCards) stay activity-based (newest
 *    lesson date desc) — unchanged.
 */

function dateTime(date: string): number {
  if (!date || date === "Date unknown") return -Infinity;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

/** All series, newest-activity first (defensive re-sort by newest lesson). */
export function getAllSeries(): LearningSeries[] {
  return [...learnSeries].sort((a, b) => {
    const aNewest = a.lessons.length
      ? Math.max(...a.lessons.map((l) => dateTime(l.date)))
      : -Infinity;
    const bNewest = b.lessons.length
      ? Math.max(...b.lessons.map((l) => dateTime(l.date)))
      : -Infinity;
    if (bNewest !== aNewest) return bNewest - aNewest;
    return a.slug.localeCompare(b.slug);
  });
}

export function getSeriesBySlug(slug: string): LearningSeries | undefined {
  return learnSeries.find((s) => s.slug === slug);
}

/** Lessons for a series, defensively LESSON-NUMBER ASC (ADR-105). */
export function getLessonsForSeries(slug: string): LearnLesson[] {
  const series = getSeriesBySlug(slug);
  if (!series) return [];
  return sortLessonsByLessonNumber(series.lessons);
}

/** Scoped lookup — no cross-series slug bleed. */
export function getLesson(
  series: string,
  slug: string,
): LearnLesson | undefined {
  return learnLessons.find((l) => l.series === series && l.slug === slug);
}

/** Read the raw MDX content for a learn lesson (mirrors lib/mdx.ts). */
export function getLearnMDXContent(
  series: string,
  slug: string,
): string | null {
  const mdxPath = path.join(
    process.cwd(),
    "content",
    "learn",
    series,
    `${slug}.mdx`,
  );
  try {
    return fs.readFileSync(mdxPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Strip the `---` frontmatter block from raw MDX before rendering.
 * (The blog renderer passes raw content through and renders the frontmatter
 * blob as a heading — pre-existing behavior we do NOT replicate for Learn.)
 */
export function stripMDXFrontmatter(raw: string): string {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return raw;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return raw;
  return lines.slice(end + 1).join("\n");
}

/** All MDX slugs available in a series dir (mirrors lib/mdx.ts). */
export function getAllLearnMDXSlugs(series: string): string[] {
  const dir = path.join(process.cwd(), "content", "learn", series);
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, ""));
  } catch {
    return [];
  }
}

/** Display helper — "Date unknown" passes through. */
export function formatLessonDate(date: string): string {
  return date;
}

/**
 * Progress derivation (ADR-004): published = lessons present,
 * total = highest lesson number in the series (NOT hardcoded "90").
 */
export function getSeriesProgress(series: LearningSeries): {
  published: number;
  total: number;
} {
  return { published: series.lessons.length, total: series.totalLessons };
}

/** Short display label for a series (band tag pill). */
export function seriesShortLabel(slug: string): string {
  const map: Record<string, string> = {
    "salesforce-architect": "Salesforce",
    "agentic-ai": "Agentic AI",
    "omni-studio-cert": "OmniStudio",
  };
  if (map[slug]) return map[slug];
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Avatar initials from an author name ("Adroit Consulting" → "AC"). */
export function getAuthorInitials(author: string): string {
  const words = author.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AC";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
