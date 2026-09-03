/**
 * SkyChart — mini sky-road map (deep-sky HUD, kara t_ea789325). Replaces the
 * old SectorMinimap: node dots ON the route, traveled/untraveled road stroke,
 * "you are here" pulse, next-waypoint marker, view cone wedge. Click a dot to
 * fly. Pure DOM + SSR-safe — no three import, so it renders even in the 2D
 * fallback.
 */
"use client";

import type { SkyChartProps } from "@/shared/contracts-galaxy";
import { isTraveled } from "./galaxy-model";

const STATE_CLASS: Record<string, string> = {
  certified: "is-certified",
  completed: "is-completed",
  "in-progress": "is-inprogress",
  unstarted: "is-unstarted",
};

export function SkyChart({
  sectors,
  road,
  focusSlug,
  frontierSlug,
  onSelect,
}: SkyChartProps) {
  const travelSet = new Set(road.traveled);
  const focus = sectors.find((s) => s.seriesSlug === focusSlug);
  const frontier = sectors.find((s) => s.seriesSlug === frontierSlug);

  // Build the road polyline in minimap space (x right, y down, 0..1).
  const polyline = road.nodes
    .map((slug) => sectors.find((s) => s.seriesSlug === slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => s.minimap);
  const polyPoints = polyline.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(" ");

  return (
    <div className="cx3d-chart" data-testid="cx3d-sky-chart" aria-hidden="true">
      <p className="cx3d-chart-title">Your sky</p>
      <svg
        viewBox="0 0 100 100"
        className="cx3d-chart-svg"
        role="img"
        aria-label="Mini map of the sky road"
      >
        {/* Road polyline: traveled warm, untraveled cool */}
        <polyline
          points={polyPoints}
          className={`cx3d-chart-road ${travelSet.size === road.nodes.length ? "is-all-traveled" : ""}`}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        {/* View cone wedge from the focused node, oriented toward the frontier */}
        {focus && frontier && focus.seriesSlug !== frontier.seriesSlug ? (
          <path
            d={`M${focus.minimap.x * 100},${focus.minimap.y * 100} L${Math.max(
              0,
              Math.min(100, frontier.minimap.x * 100 - 6),
            )},${Math.max(0, Math.min(100, frontier.minimap.y * 100 - 6))} L${Math.max(
              0,
              Math.min(100, frontier.minimap.x * 100 + 6),
            )},${Math.max(0, Math.min(100, frontier.minimap.y * 100 + 6))} Z`}
            className="cx3d-chart-viewcone"
          />
        ) : null}
        {/* Node dots */}
        {sectors.map((sector) => {
          const state = STATE_CLASS[sector.state] ?? "is-unstarted";
          const isFocus = sector.seriesSlug === focusSlug;
          const isFrontier = sector.seriesSlug === frontierSlug;
          return (
            <button
              type="button"
              key={sector.seriesSlug}
              data-testid={`cx3d-chart-dot-${sector.seriesSlug}`}
              className={`cx3d-chart-dot ${state} ${isFocus ? "is-active" : ""} ${
                isFrontier ? "is-frontier" : ""
              } ${isTraveled(sector.state) ? "is-traveled" : ""}`}
              style={{
                left: `${(sector.minimap.x * 100).toFixed(2)}%`,
                top: `${(sector.minimap.y * 100).toFixed(2)}%`,
              }}
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => onSelect(sector.seriesSlug)}
            />
          );
        })}
        {/* You-are-here pulse */}
        {focus ? (
          <span
            className="cx3d-chart-you"
            style={{
              left: `${(focus.minimap.x * 100).toFixed(2)}%`,
              top: `${(focus.minimap.y * 100).toFixed(2)}%`,
            }}
          >
            <span className="cx3d-chart-you-ring" data-testid="cx3d-chart-you-ring" />
          </span>
        ) : null}
      </svg>
    </div>
  );
}
