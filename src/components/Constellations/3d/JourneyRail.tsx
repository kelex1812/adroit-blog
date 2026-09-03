/**
 * JourneyRail — horizontal waypoint strip of course names in road order
 * (deep-sky HUD, kara t_ea789325). State-coded chips, the frontier
 * highlighted with a "NEXT" marker, prev/next arrow buttons that move focus
 * along the road (keyboard-friendly: arrow keys move focus, Enter flies).
 *
 * Pure DOM + SSR-safe — the rail is the accessible navigation surface for the
 * 3D galaxy, so it MUST work even when WebGL falls back to 2D.
 */
"use client";

import { useCallback, useMemo, useRef } from "react";
import type { JourneyRailProps } from "@/shared/contracts-galaxy";
import { isTraveled } from "./galaxy-model";

const STATE_CLASS: Record<string, string> = {
  certified: "is-certified",
  completed: "is-completed",
  "in-progress": "is-inprogress",
  unstarted: "is-unstarted",
};

function stateLabel(sector: JourneyRailProps["sectors"][number]): string {
  if (sector.state === "certified") return "Certified";
  if (sector.state === "completed") return "Completed";
  if (sector.state === "in-progress") return "In progress";
  return "Unstarted";
}

export function JourneyRail({
  sectors,
  road,
  focusSlug,
  frontierSlug,
  onSelect,
}: JourneyRailProps) {
  // Order the chips by the road's node sequence (the canonical journey order).
  const ordered = useMemo(() => {
    const bySlug = new Map(sectors.map((s) => [s.seriesSlug, s]));
    const out = road.nodes
      .map((slug) => bySlug.get(slug))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    // Safety: if the road somehow omits a sector, append it (never drop a course).
    for (const s of sectors) {
      if (!road.nodes.includes(s.seriesSlug)) out.push(s);
    }
    return out;
  }, [sectors, road.nodes]);

  const listRef = useRef<HTMLOListElement>(null);

  // Arrow-key navigation along the road: Left/Up = previous, Right/Down = next.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLOListElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const buttons = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>(
          "[data-journey-chip]",
        ) ?? [],
      );
      if (buttons.length === 0) return;
      const current = document.activeElement;
      const idx = buttons.findIndex((b) => b === current);
      if (idx === -1) return;
      e.preventDefault();
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      const next = buttons[(idx + dir + buttons.length) % buttons.length];
      next?.focus();
    },
    [],
  );

  return (
    <nav
      className="cx3d-rail"
      data-testid="cx3d-journey-rail"
      aria-label="Journey road"
    >
      <ol
        ref={listRef}
        className="cx3d-rail-list"
        onKeyDown={handleKeyDown}
        data-testid="cx3d-journey-rail-list"
      >
        {ordered.map((sector) => {
          const isFocus = sector.seriesSlug === focusSlug;
          const isFrontier = sector.seriesSlug === frontierSlug;
          const state = STATE_CLASS[sector.state] ?? "is-unstarted";
          const ariaLabel = `${sector.name} — ${stateLabel(sector)}, ${sector.litStars} of ${sector.totalStars} lit${isFrontier ? ", next waypoint" : ""}`;
          return (
            <li key={sector.seriesSlug} className="cx3d-rail-item">
              <button
                type="button"
                data-journey-chip
                data-testid={`cx3d-rail-chip-${sector.seriesSlug}`}
                className={`cx3d-rail-chip ${state} ${
                  isFocus ? "is-active" : ""
                } ${isFrontier ? "is-frontier" : ""}`}
                aria-label={ariaLabel}
                aria-current={isFocus ? "true" : undefined}
                onClick={() => onSelect(sector.seriesSlug)}
              >
                <span className="cx3d-rail-chip-state" aria-hidden="true">
                  {sector.state === "certified" ? "◆" : isTraveled(sector.state) ? "●" : "○"}
                </span>
                <span className="cx3d-rail-chip-name">{sector.name}</span>
                {isFrontier ? (
                  <span className="cx3d-rail-chip-next" aria-hidden="true">
                    NEXT
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
