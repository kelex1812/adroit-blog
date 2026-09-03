/**
 * Legend — collapsible state key for the deep-sky galaxy (kara t_ea789325).
 * Explains the five achievement states (unstarted / in-progress / completed /
 * certified / next) with their color swatches. Pure DOM + SSR-safe.
 */
"use client";

import { useState } from "react";
import type { LegendProps } from "@/shared/contracts-galaxy";

const ITEMS: { key: string; state: string; label: string }[] = [
  { key: "certified", state: "is-certified", label: "Certified" },
  { key: "completed", state: "is-completed", label: "Completed" },
  { key: "inprogress", state: "is-inprogress", label: "In progress" },
  { key: "frontier", state: "is-frontier", label: "Next waypoint" },
  { key: "unstarted", state: "is-unstarted", label: "Unstarted" },
];

export function Legend({ open = false }: LegendProps) {
  const [isOpen, setIsOpen] = useState(open);

  return (
    <div className="cx3d-legend" data-testid="cx3d-legend">
      <button
        type="button"
        className="cx3d-legend-toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span aria-hidden="true" className="cx3d-legend-swatch-group">
          <span className="cx3d-dot is-certified" />
          <span className="cx3d-dot is-completed" />
          <span className="cx3d-dot is-inprogress" />
        </span>
        <span className="cx3d-legend-title">Sky legend</span>
        <span aria-hidden="true" className="cx3d-legend-chevron">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen ? (
        <ul className="cx3d-legend-list">
          {ITEMS.map((item) => (
            <li key={item.key} className="cx3d-legend-row">
              <span
                aria-hidden="true"
                className={`cx3d-dot ${item.state}`}
              />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
