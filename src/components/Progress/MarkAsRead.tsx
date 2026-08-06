/**
 * MarkAsRead — toggle button for marking blog/lesson content as read.
 *
 * Uses useReadProgress hook which handles Supabase (auth) / localStorage (guest) fallback.
 */
"use client";

import { useReadProgress } from "@/lib/hooks/useReadProgress";

interface MarkAsReadProps {
  slug: string;
  contentType?: "blog" | "lesson";
  /** Show text label alongside icon. */
  showLabel?: boolean;
}

export default function MarkAsRead({ slug, contentType = "blog", showLabel = true }: MarkAsReadProps) {
  const { isRead, markAsRead, isLoading } = useReadProgress(slug, contentType);

  return (
    <button
      onClick={markAsRead}
      disabled={isLoading}
      aria-pressed={isRead}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 no-underline ${
        isRead
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-gray-100 text-gray-600 hover:bg-navy hover:text-white"
      } ${isLoading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isRead ? (
          <>
            <path d="M20 6L9 17l-5-5" />
          </>
        ) : (
          <circle cx="12" cy="12" r="10" />
        )}
      </svg>
      {showLabel && <span>{isRead ? "Read" : "Mark as read"}</span>}
    </button>
  );
}
