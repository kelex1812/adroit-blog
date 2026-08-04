export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categoryColor: "sf" | "react" | "ai" | "mkt";
  categoryGradient: string;
  date: string;
  author: string;
  authorInitials: string;
  readTime: string;
  featured?: boolean;
  tags: string[];
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
}

/** A learning track — one directory under content/learn/ */
export interface LearningSeries {
  /** Series slug — equals content/learn/<series>/ dir name */
  slug: string;
  /** Display name from series.json; fallback: humanized slug */
  name: string;
  /** One-line description from series.json; fallback: "" */
  description: string;
  /** Tailwind gradient classes for card headers, e.g. "from-sky to-blue-600"; fallback: "from-navy to-navy-light" */
  gradient: string;
  /** Lessons sorted NEWEST FIRST (date desc) — enforced by build-learn.js AND lib/learn.ts */
  lessons: LearnLesson[];
  /** Highest lesson number present (BA decision: NOT hardcoded "90") */
  totalLessons: number;
}
