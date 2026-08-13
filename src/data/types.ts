export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categoryColor: "sf" | "react" | "ai" | "mkt" | "ux" | "pm";
  categoryGradient: string;
  date: string;
  author: string;
  authorInitials: string;
  readTime: string;
  featured?: boolean;
  tags: string[];
  /** Optional banner image path (public/) — gradient fallback when absent. */
  bannerImage?: string;
  /** Optional draft flag: "draft" is excluded from public build data. Default "published". */
  status?: "draft" | "published";
}

/** A single lesson MDX file under content/learn/<series>/<slug>.mdx */
export interface LearnLesson {
  /** URL slug — equals MDX filename; falls back to frontmatter `slug` */
  slug: string;
  /** Frontmatter title */
  title: string;
  /** Series slug — directory name under content/learn/, e.g. "salesforce-architect" */
  series: string;
  /** Sequence int from frontmatter — defines intended order ("Lesson N of M") */
  lesson: number;
  /** Frontmatter excerpt */
  excerpt: string;
  /** Display date, canonical "Month DD, YYYY"; "Date unknown" when unparseable */
  date: string;
  /** Frontmatter author; default "Adroit Consulting" */
  author: string;
  /** e.g. "5 min read"; default if missing */
  readTime: string;
  /** Frontmatter tags */
  tags: string[];
  /** Optional draft flag: "draft" is excluded from public build data. Default "published". */
  status?: "draft" | "published";
}

/** A learning track — one directory under content/learn/ */
export interface LearningSeries {
  /** Series slug — equals content/learn/<series>/ dir name */
  slug: string;
  /** Display name from series.json; fallback: humanized slug */
  name: string;
  /** One-line description from series.json; fallback: "" */
  description: string;
  /** Optional grouping label for the Learn hub (e.g. "Salesforce Certifications") */
  group?: string;
  /** Optional subgroup under a group (content metadata only, e.g. "Developer"); no DB. */
  subgroup?: string;
  /** Tailwind gradient classes for card headers, e.g. "from-sky to-blue-600"; fallback: "from-navy to-navy-light" */
  gradient: string;
  /** Lessons sorted NEWEST FIRST (date desc) — enforced by build-learn.js AND lib/learn.ts */
  lessons: LearnLesson[];
  /** Highest lesson number present (BA decision: NOT hardcoded "90") */
  totalLessons: number;
}

/**
 * Slim series projection for the /learn hub card grid (guest hardening
 * t_3dbf4826). Carries ONLY what the PathCard + filters render — the per-lesson
 * metadata (slug/title/excerpt/date/author/readTime/tags) is never shipped to
 * the client. `lessonSlugs` is populated for signed-in cards (SeriesProgress)
 * and always empty for guests.
 */
export interface LearnCardSeries {
  /** Series slug — link target + card label. */
  slug: string;
  /** Display name from series.json. */
  name: string;
  /** One-line description from series.json. */
  description: string;
  /** Optional grouping label for the Learn hub (e.g. "Salesforce Certifications"). */
  group?: string;
  /** Optional subgroup under a group (content metadata only, e.g. "Developer"). */
  subgroup?: string;
  /** Tailwind gradient classes for card headers. */
  gradient: string;
  /** Published lesson count — "{n} / {total} lessons" badge. */
  lessonCount: number;
  /** Total (incl. unpublished) lesson count from series.json. */
  totalLessons: number;
  /** Lesson slugs — signed-in only (SeriesProgress); empty for guests. */
  lessonSlugs: string[];
}
