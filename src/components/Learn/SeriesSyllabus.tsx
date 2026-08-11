/**
 * SeriesSyllabus — client wrapper for the series syllabus list (ADR-105).
 *
 * Owns the lesson-number sort (via LessonSortToggle + ?sort=asc|desc) and the
 * "Hide completed" filter. Receives the server-rendered lesson list as props
 * (server sorts defensively by lesson number asc; the client re-sorts in the
 * requested direction without a server round-trip).
 *
 * Hide-completed is hydration-gated (QA F-1 pattern): the filter state is
 * client-only and merges localStorage + Supabase completion via
 * useProgressSummary, so guests see the same list with nothing to hide.
 */
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import LessonCard from "@/components/Learn/LessonCard";
import MarkComplete from "@/components/Progress/MarkComplete";
import LessonSortToggle from "@/components/Learn/LessonSortToggle";
import { useProgressSummary } from "@/lib/hooks/useProgressSummary";
import { sortLessonsByLessonNumber } from "@/lib/lesson-sort";
import type { LearnLesson } from "@/data/types";

interface SeriesSyllabusProps {
  /** Server-rendered lessons (already lesson-number sorted). */
  lessons: LearnLesson[];
  totalLessons: number;
  /** Published count (server-side). */
  published: number;
  upcoming: number;
}

export default function SeriesSyllabus({
  lessons,
  totalLessons,
  published,
  upcoming,
}: SeriesSyllabusProps) {
  const [hideCompleted, setHideCompleted] = useState(false);
  const { merge } = useProgressSummary(
    [],
    lessons.map((l) => l.slug),
  );

  // Read the ?sort=asc|desc URL param written by LessonSortToggle (ADR-105).
  const searchParams = useSearchParams();
  const sortOrder = searchParams.get("sort") === "desc" ? "desc" : "asc";

  const displayed = useMemo(() => {
    const sorted = sortLessonsByLessonNumber(lessons, sortOrder);
    if (!hideCompleted) return sorted;
    return sorted.filter((l) => !merge.lessons.has(l.slug));
  }, [lessons, hideCompleted, merge.lessons, sortOrder]);

  return (
    <>
      <div className="flex items-center justify-between px-2 mb-1.5">
        <h2 className="font-mono text-[13px] font-bold text-gray-500 uppercase tracking-[0.08em]">
          {hideCompleted ? "In Progress" : "All Lessons"}
        </h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11.5px] text-gray-500 font-medium">
            {published} published · {upcoming} upcoming
          </span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <span className="font-mono text-[10.5px] font-semibold text-gray-500">
              Hide completed
            </span>
            {/* a11y (finding 6): 44x44 hit target — the visual track stays
                32x18 but the button is w-11 h-11 with the track centered. */}
            <button
              role="switch"
              aria-checked={hideCompleted}
              aria-label="Hide completed lessons"
              onClick={() => setHideCompleted((v) => !v)}
              className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-200 cursor-pointer ${
                hideCompleted ? "bg-navy/[0.06]" : "bg-transparent"
              }`}
            >
              <span
                aria-hidden="true"
                className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${
                  hideCompleted ? "bg-navy" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform duration-200 ${
                    hideCompleted ? "translate-x-[14px]" : ""
                  }`}
                />
              </span>
            </button>
          </label>
          <LessonSortToggle compact />
        </div>
      </div>

      <div className="border-t border-gray-200 mt-3">
        {displayed.length > 0 ? (
          displayed.map((lesson) => (
            <div key={lesson.slug} className="relative">
              <LessonCard lesson={lesson} totalLessons={totalLessons} />
              {/* Per-lesson completion tracking */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-[0.07em]">
                  Mark complete
                </span>
                <MarkComplete lessonSlug={lesson.slug} label={`lesson ${lesson.slug}`} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-[13px] text-gray-500 py-6 text-center font-mono">
            {hideCompleted ? "All lessons completed — nice work." : "No lessons yet."}
          </p>
        )}
      </div>
    </>
  );
}
