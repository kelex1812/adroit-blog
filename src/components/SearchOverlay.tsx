"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { posts } from "@/data/posts";
import { learnSeries, learnLessons } from "@/data/learn";
import { buildSearchIndex, type SearchResults } from "@/lib/search";

const EMPTY: SearchResults = { posts: [], series: [], lessons: [], total: 0 };

/**
 * B-21 — Client-side site search overlay. Self-contained: renders its own
 * trigger button (a search icon) and, when opened, a full-screen overlay with
 * a live input whose results are grouped by post / series / lesson.
 *
 * Client-side over the static datasets (`posts.ts` + `learn.ts`) — no backend.
 */
export default function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const search = useMemo(
    () => buildSearchIndex(posts, learnSeries, learnLessons),
    [],
  );
  const results = useMemo(
    () => (query.trim() ? search(query) : EMPTY),
    [query, search],
  );

  // Auto-focus the input when the overlay opens; close on Escape.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      // keep body scroll locked while the overlay is up
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const empty =
    results.total === 0 && query.trim().length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search site"
        className="bg-none border-none cursor-pointer p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] transition-colors duration-150"
      >
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site search"
          className="fixed inset-0 z-[80] bg-navy/50 dark:bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[560px] bg-[var(--surface-card)] rounded-xl shadow-2xl ring-1 ring-[var(--border-default)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input row */}
            <div className="flex items-center gap-3 px-4 border-b border-[var(--border-default)]">
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--ink-faint)] shrink-0"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts, series & lessons…"
                aria-label="Search query"
                className="flex-1 h-[52px] bg-transparent border-none outline-none text-[15px] text-[var(--ink-primary)] placeholder:text-[var(--ink-faint)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="bg-none border-none cursor-pointer text-[var(--ink-faint)] hover:text-[var(--ink-primary)] text-sm shrink-0"
                  aria-label="Clear search"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {!query.trim() && (
                <p className="px-3 py-6 text-center text-sm text-[var(--ink-muted)]">
                  Type to search across posts, series and lessons.
                </p>
              )}

              {empty && (
                <p className="px-3 py-6 text-center text-sm text-[var(--ink-muted)]">
                  No results for “{query}”.
                </p>
              )}

              {results.total > 0 && (
                <div className="flex flex-col gap-1">
                  {(["posts", "series", "lessons"] as const).map((key) =>
                    results[key].length > 0 ? (
                      <div key={key}>
                        <div className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                          {results[key][0].group}
                        </div>
                        {results[key].map((hit) => (
                          <button
                            key={`${key}-${hit.href}`}
                            type="button"
                            onClick={() => go(hit.href)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-sunken)] transition-colors duration-100 cursor-pointer bg-none border-none"
                          >
                            <span className="block text-[14px] font-semibold text-[var(--ink-primary)] truncate">
                              {hit.title}
                            </span>
                            <span className="block text-[12px] text-[var(--ink-muted)] truncate mt-0.5">
                              {hit.snippet}
                            </span>
                            {hit.meta && (
                              <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-faint)] mt-1">
                                {hit.meta}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
