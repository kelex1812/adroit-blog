import Link from "next/link";
import { LearnLesson } from "@/data/types";

interface LessonNavigationProps {
  /** Full series lesson list (any order — sorted here by lesson number). */
  lessons: LearnLesson[];
  /** Current lesson slug. */
  currentSlug: string;
}

/**
 * Prev/next within the same series, ordered by authored sequence
 * (lesson number), mirroring PostNavigation visuals (ADR-005).
 */
export default function LessonNavigation({
  lessons,
  currentSlug,
}: LessonNavigationProps) {
  const ordered = [...lessons].sort((a, b) => a.lesson - b.lesson);
  const idx = ordered.findIndex((l) => l.slug === currentSlug);
  const prev = idx > 0 ? ordered[idx - 1] : undefined;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : undefined;

  return (
    <div className="max-w-[720px] mx-auto px-6 py-6 grid grid-cols-2 gap-4">
      {prev ? (
        <Link
          href={`/learn/${prev.series}/${prev.slug}`}
          className="p-5 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all duration-150 no-underline"
        >
          <div className="font-mono text-[10.5px] text-gray-400 uppercase tracking-[0.06em] font-bold mb-2">
            &larr; Lesson {prev.lesson}
          </div>
          <h4 className="text-sm font-semibold text-navy leading-snug">
            {prev.title}
          </h4>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/learn/${next.series}/${next.slug}`}
          className="p-5 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all duration-150 no-underline text-right"
        >
          <div className="font-mono text-[10.5px] text-gray-400 uppercase tracking-[0.06em] font-bold mb-2">
            Lesson {next.lesson} &rarr;
          </div>
          <h4 className="text-sm font-semibold text-navy leading-snug">
            {next.title}
          </h4>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
