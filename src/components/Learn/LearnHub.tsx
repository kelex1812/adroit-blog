/**
 * LearnHub — client orchestrator for the /learn hub.
 *
 * Holds the group/subgroup filter state and composes LearnFilters +
 * ContinueLearning + the grouped PathCard grid. `gate` comes from the server
 * (guest vs signed-in) so cards render non-clickable with a CTA for guests.
 */

"use client";

import { useMemo, useState } from "react";
import PathCard from "./PathCard";
import LearnFilters, { bucketOf } from "./LearnFilters";
import ContinueLearning from "./ContinueLearning";
import type { LearningSeries } from "@/data/types";
import type { CardGateState } from "@/shared/contracts-account";

interface LearnHubProps {
  series: LearningSeries[];
  gate: CardGateState;
}

export default function LearnHub({ series, gate }: LearnHubProps) {
  const [bucket, setBucket] = useState<string | null>(null);
  const [subgroup, setSubgroup] = useState<string | null>(null);

  // Group series by top-level group, then subgroup, respecting filters.
  const visible = useMemo(() => {
    let list = series;
    if (bucket) {
      list = list.filter((s) => bucketOf(s.group || "Learning Paths") === bucket);
    }
    if (subgroup) {
      list = list.filter((s) => s.subgroup === subgroup);
    }
    return list;
  }, [series, bucket, subgroup]);

  // Order: group asc, then subgroup asc, then series as provided.
  const sections = useMemo(() => {
    const byGroup = new Map<string, { bySubgroup: Map<string, LearningSeries[]> }>();
    for (const s of visible) {
      const g = s.group || "Learning Paths";
      if (!byGroup.has(g)) byGroup.set(g, { bySubgroup: new Map() });
      const sub = s.subgroup || "__none__";
      const entry = byGroup.get(g)!;
      if (!entry.bySubgroup.has(sub)) entry.bySubgroup.set(sub, []);
      entry.bySubgroup.get(sub)!.push(s);
    }
    const orderedGroups = Array.from(byGroup.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return orderedGroups.map(([group, { bySubgroup }]) => ({
      group,
      subgroups: Array.from(bySubgroup.entries()).sort(([a], [b]) =>
        a === "__none__" ? 1 : b === "__none__" ? -1 : a.localeCompare(b),
      ),
    }));
  }, [visible]);

  return (
    <>
      <LearnFilters
        series={series}
        bucket={bucket}
        subgroup={subgroup}
        onBucketChange={(b) => {
          setBucket(b);
          setSubgroup(null); // subgroup scope resets when the track changes
        }}
        onSubgroupChange={setSubgroup}
      />

      <ContinueLearning />

      {sections.map(({ group, subgroups }) => {
        const groupCount = subgroups.reduce((acc, [, items]) => acc + items.length, 0);
        return (
          <section key={group} className="mt-9 first:mt-4">
            {/* Top-level group header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="w-[3px] h-4 rounded-sm bg-[var(--accent)]" aria-hidden />
              <h2 className="font-mono text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-[0.1em]">
                {group}
              </h2>
              <span className="font-mono text-[10.5px] font-bold text-[var(--accent-on-tint)] bg-[var(--accent)]/[0.08] px-2 py-0.5 rounded-full">
                {groupCount} {groupCount === 1 ? "path" : "paths"}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-[var(--border-default)] to-transparent" aria-hidden />
            </div>

            {subgroups.map(([sub, items]) => (
              <div key={sub} className="mb-6 last:mb-0">
                {/* Subgroup sub-header (skip for the ungrouped "__none__" bucket) */}
                {sub !== "__none__" && (
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="text-[13px] font-bold text-[var(--ink-primary)] tracking-[-0.01em]">
                      {sub}
                    </span>
                    <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {items.map((s) => (
                    <PathCard
                      key={s.slug}
                      series={s}
                      gate={gate}
                      loginNext={`/learn/${s.slug}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
