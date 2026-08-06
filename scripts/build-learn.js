/**
 * Build-time script: reads MDX frontmatter from content/learn/<series>/,
 * reads optional per-series series.json config, and generates
 * src/data/learn.ts with typed LearningSeries[] + flat LearnLesson[].
 *
 * Mirrors scripts/build-posts.js (which must remain untouched).
 * Ordering contract: ALL lesson listings newest-first (date desc);
 * invalid dates sort last, stable. Empty series dirs are emitted with
 * lessons: [] so pages render a graceful "coming soon" state.
 *
 * Run via package.json prebuild: node scripts/build-posts.js && node scripts/build-learn.js
 */
const fs = require("fs");
const path = require("path");

const LEARN_DIR = path.join(__dirname, "..", "content", "learn");
const OUT_PATH = path.join(__dirname, "..", "src", "data", "learn.ts");

// Fallback identity for the two known tracks (ADR-003 / data contract).
// Adding a new series requires NO code change — drop a folder (+ optional series.json).
const KNOWN_SERIES = {
  "salesforce-architect": {
    name: "Salesforce System Architect Primer",
    description:
      "A structured path from Flow fundamentals to platform architecture — 90 lessons on designing Salesforce systems that scale.",
    gradient: "from-sky to-blue-600",
  },
  "agentic-ai": {
    name: "Agentic AI Implementation Path",
    description:
      "From single-agent prototypes to multi-agent orchestration — a practitioner's curriculum for shipping agentic systems.",
    gradient: "from-amber to-yellow-600",
  },
};

const FALLBACK_GRADIENT = "from-navy to-navy-light";

function parseFrontmatter(raw) {
  const lines = raw.split("\n");
  if (lines[0].trim() !== "---") return [null, raw];
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return [null, raw];
  const fm = {};
  for (const line of lines.slice(1, end)) {
    const ci = line.indexOf(":");
    if (ci === -1) continue;
    let k = line.slice(0, ci).trim();
    let v = line.slice(ci + 1).trim();
    if (v === "true") v = true;
    else if (v === "false") v = false;
    else if (v.startsWith("[")) {
      v = v
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else v = v.replace(/^["']|["']$/g, "");
    fm[k] = v;
  }
  return [fm, lines.slice(end + 1).join("\n")];
}

/** Parse "Month DD, YYYY"; returns valid Date or null. */
function parseDate(str) {
  if (!str || typeof str !== "string") return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function humanize(slug) {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Sort lessons NEWEST FIRST (date desc). Invalid dates sort last, stable. */
function sortLessonsNewestFirst(lessons) {
  return lessons
    .map((l, idx) => ({ l, idx }))
    .sort((a, b) => {
      const da = parseDate(a.l.date);
      const db = parseDate(b.l.date);
      const ta = da ? da.getTime() : -Infinity;
      const tb = db ? db.getTime() : -Infinity;
      if (tb !== ta) return tb - ta;
      // ties → stable (original order)
      return a.idx - b.idx;
    })
    .map((x) => x.l);
}

function readSeriesJson(dir) {
  const cfgPath = path.join(dir, "series.json");
  try {
    return JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  } catch {
    return null;
  }
}

function buildSeries(seriesSlug, dir) {
  const cfg = readSeriesJson(dir) || {};
  const known = KNOWN_SERIES[seriesSlug] || {};

  const lessons = [];
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx")).sort();
  } catch {
    files = [];
  }

  for (const file of files) {
    const slug = file.replace(/\.mdx$/, "");
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const [fm] = parseFrontmatter(raw);
    if (!fm) {
      console.warn(`Warning: ${seriesSlug}/${file} has no frontmatter, skipping`);
      continue;
    }
    const dateRaw = fm.date || "";
    const date = parseDate(dateRaw) ? dateRaw : "Date unknown";
    const lesson = Number.isNaN(parseInt(fm.lesson, 10)) ? 0 : parseInt(fm.lesson, 10);
    lessons.push({
      slug: fm.slug || slug,
      title: fm.title || "",
      series: fm.series || seriesSlug,
      lesson,
      excerpt: fm.excerpt || "",
      date,
      author: fm.author || "Adroit Consulting",
      readTime: fm.readTime || "5 min read",
      tags: fm.tags || [],
    });
  }

  const sorted = sortLessonsNewestFirst(lessons);
  const totalLessons = sorted.reduce((max, l) => Math.max(max, l.lesson), 0);

  return {
    slug: seriesSlug,
    name: cfg.name || known.name || humanize(seriesSlug),
    description: cfg.description ?? known.description ?? "",
    group: cfg.group || undefined,
    gradient: cfg.gradient || known.gradient || FALLBACK_GRADIENT,
    lessons: sorted,
    totalLessons,
  };
}

function build() {
  let dirs = [];
  try {
    dirs = fs
      .readdirSync(LEARN_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    dirs = [];
    console.log("content/learn/ missing — emitting empty learn data");
  }

  const series = dirs.map((slug) => buildSeries(slug, path.join(LEARN_DIR, slug)));

  // Sort series: newest lesson date DESC, ties → slug ASC. Empty series sort last.
  series.sort((a, b) => {
    const aNewest = a.lessons.length ? parseDate(a.lessons[0].date) : null;
    const bNewest = b.lessons.length ? parseDate(b.lessons[0].date) : null;
    const ta = aNewest ? aNewest.getTime() : -Infinity;
    const tb = bNewest ? bNewest.getTime() : -Infinity;
    if (tb !== ta) return tb - ta;
    return a.slug.localeCompare(b.slug);
  });

  // Flat list, NEWEST FIRST across all series (sitemap, nav, lookups).
  const flat = series.flatMap((s) => s.lessons).sort((a, b) => {
    const da = parseDate(a.date);
    const db = parseDate(b.date);
    const ta = da ? da.getTime() : -Infinity;
    const tb = db ? db.getTime() : -Infinity;
    if (tb !== ta) return tb - ta;
    return a.series.localeCompare(b.series) || a.lesson - b.lesson;
  });

  const content = `import { LearnLesson, LearningSeries } from "./types";

/**
 * GENERATED by scripts/build-learn.js — DO NOT HAND-EDIT.
 * Run \`node scripts/build-learn.js\` (or npm run prebuild) to regenerate.
 */

/** All series, sorted by newest lesson date DESC (ties → slug asc). Empty dirs included with lessons: []. */
export const learnSeries: LearningSeries[] = ${JSON.stringify(series, null, 2)};

/** Flat list of every lesson, NEWEST FIRST (for sitemap, nav, flat lookups). */
export const learnLessons: LearnLesson[] = ${JSON.stringify(flat, null, 2)};
`;

  fs.writeFileSync(OUT_PATH, content);
  const counts = series.map((s) => `${s.slug}: ${s.lessons.length} lessons`).join(", ");
  console.log(`Generated learn.ts: ${series.length} series (${counts}) — ${flat.length} lessons total`);
}

build();
