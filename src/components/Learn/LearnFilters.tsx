/**
 * LearnFilters — client filter chips for the Learn hub (All / Certifications /
 * General) plus optional subgroup chips revealed under a top-level group.
 *
 * Pure presentational + reporting: derives bucket labels + counts from the
 * series and reports the active bucket/subgroup via onBucketChange /
 * onSubgroupChange. The parent (LearnHub) owns the state and renders/hides the
 * card sections. Cards stay server-rendered in the DOM for SEO; filtering only
 * toggles visibility.
 */

"use client";

import type { LearnCardSeries } from "@/data/types";

/** "Salesforce Certifications" → "Certifications"; everything else → "General". */
export function bucketOf(group: string): string {
  return /certification/i.test(group) ? "Certifications" : "General";
}

export const BUCKETS = ["Certifications", "General"] as const;

interface LearnFiltersProps {
  series: LearnCardSeries[];
  bucket: string | null; // null = "All"
  subgroup: string | null;
  onBucketChange: (bucket: string | null) => void;
  onSubgroupChange: (subgroup: string | null) => void;
}

export default function LearnFilters({
  series,
  bucket,
  subgroup,
  onBucketChange,
  onSubgroupChange,
}: LearnFiltersProps) {
  const countForBucket = (b: string) =>
    series.filter((s) => bucketOf(s.group || "Learning Paths") === b).length;

  // Subgroups present across the whole catalogue.
  const subgroups = Array.from(
    new Set(
      series
        .map((s) => s.subgroup)
        .filter((s): s is string => Boolean(s)),
    ),
  );

  return (
    <div>
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by track">
        <button
          type="button"
          onClick={() => onBucketChange(null)}
          aria-pressed={bucket === null}
          className={`text-[13px] font-semibold px-[18px] py-2.5 rounded-full border cursor-pointer transition-all duration-150 ${
            bucket === null
              ? "bg-[var(--surface-inverse)] text-[var(--ink-on-inverse)] border-[var(--surface-inverse)] shadow-md"
              : "bg-[var(--surface-card)] text-[var(--ink-muted)] border-[var(--border-default)] hover:border-[var(--ink-primary)] hover:text-[var(--ink-primary)]"
          }`}
        >
          All{" "}
          <span className="font-mono text-[10.5px] ml-1.5 opacity-75">{series.length}</span>
        </button>
        {BUCKETS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onBucketChange(b)}
            aria-pressed={bucket === b}
            className={`text-[13px] font-semibold px-[18px] py-2.5 rounded-full border cursor-pointer transition-all duration-150 ${
              bucket === b
                ? "bg-[var(--surface-inverse)] text-[var(--ink-on-inverse)] border-[var(--surface-inverse)] shadow-md"
                : "bg-[var(--surface-card)] text-[var(--ink-muted)] border-[var(--border-default)] hover:border-[var(--ink-primary)] hover:text-[var(--ink-primary)]"
            }`}
          >
            {b}{" "}
            <span className="font-mono text-[10.5px] ml-1.5 opacity-75">{countForBucket(b)}</span>
          </button>
        ))}
      </div>

      {/* Subgroup chips — revealed when any track is active and subgroups exist */}
      {bucket && subgroups.length > 0 && (
        <div
          className="flex gap-2 flex-wrap mt-1.5"
          role="group"
          aria-label="Filter by subgroup"
        >
          <button
            type="button"
            onClick={() => onSubgroupChange(null)}
            aria-pressed={subgroup === null}
            className={`font-mono text-[11px] font-bold px-[14px] py-1.5 rounded-full border cursor-pointer uppercase tracking-[0.05em] transition-all duration-150 ${
              subgroup === null
                ? "bg-[var(--accent-bg)] text-white border-[var(--accent-bg)]"
                : "bg-[var(--surface-card-soft)] text-[var(--ink-faint)] border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            }`}
          >
            All subgroups
          </button>
          {subgroups.map((sg) => (
            <button
              key={sg}
              type="button"
              onClick={() => onSubgroupChange(sg)}
              aria-pressed={subgroup === sg}
              className={`font-mono text-[11px] font-bold px-[14px] py-1.5 rounded-full border cursor-pointer uppercase tracking-[0.05em] transition-all duration-150 ${
                subgroup === sg
                  ? "bg-[var(--accent-bg)] text-white border-[var(--accent-bg)]"
                  : "bg-[var(--surface-card-soft)] text-[var(--ink-faint)] border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {sg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
