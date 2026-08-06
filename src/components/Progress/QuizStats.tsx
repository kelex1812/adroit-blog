/**
 * QuizStats — "Quiz avg 82% · 3 attempts" mono strip (design brief §5.3).
 *
 * Reads quiz stats from two sources and merges them:
 *  - localStorage (authoritative client copy via useQuizProgress)
 *  - Supabase quiz_run rows (GET /api/progress/quiz/run) for authed users
 *
 * Renders nothing when there are no attempts — never invents stats.
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuizProgress } from "@/lib/hooks/useQuizProgress";
import { useAuth } from "@/lib/hooks/useAuth";

interface QuizStatsProps {
  seriesSlug: string;
  /** Where the strip sits — controls onGradient (white) treatment. */
  onGradient?: boolean;
}

interface ServerStats {
  bestScore: number;
  attempts: number;
}

export default function QuizStats({ seriesSlug, onGradient = false }: QuizStatsProps) {
  const { progress } = useQuizProgress(seriesSlug);
  const { user } = useAuth();
  const [server, setServer] = useState<ServerStats | null>(null);

  // Local stats: bestScore + attemptCount persisted by useQuizProgress
  const localAttempts = progress.attemptCount;
  const localBest = progress.bestScore;

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(`/api/progress/quiz/run?quizName=${encodeURIComponent(seriesSlug)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) return;
        const data = (await res.json()) as ServerStats;
        if (!cancelled) setServer(data);
      } catch {
        // no server stats — local (localStorage) is authoritative
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, seriesSlug]);

  // Merge: server wins for authed users (cross-device), local as fallback
  const attempts = user ? (server?.attempts ?? localAttempts) : localAttempts;
  const best = user ? (server?.bestScore ?? localBest) : localBest;

  if (attempts === 0) return null;

  return (
    <Link
      href={`/learn/${seriesSlug}/quiz`}
      className={`inline-flex items-center gap-2 font-mono text-[10.5px] font-semibold no-underline transition-colors duration-150 active:scale-[0.98] ${
        onGradient
          ? "text-white/85 hover:text-white bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full"
          : "text-gray-500 hover:text-navy"
      }`}
    >
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
      Quiz avg {best}% &middot; {attempts} {attempts === 1 ? "attempt" : "attempts"}
    </Link>
  );
}
