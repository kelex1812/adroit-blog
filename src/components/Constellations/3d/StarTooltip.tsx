/**
 * StarTooltip — 2D DOM overlay tooltip for the 3D scenes (design token
 * `.cx3d-tooltip`). Pure DOM: the r3f scene projects a hovered star's world
 * position to screen coords and passes them here. Anchored above the point.
 */
import type { ReactNode } from "react";

export interface StarTooltipProps {
  /** Kicker line (mono, uppercase) — e.g. "Lesson 15". */
  kicker?: string;
  title: string;
  /** State label chip — e.g. "Ignited" / "Current". */
  stateLabel?: string;
  /** Screen position as percentages of the canvas container (0–100). */
  x: number;
  y: number;
  children?: ReactNode;
}

export function StarTooltip({
  kicker,
  title,
  stateLabel,
  x,
  y,
  children,
}: StarTooltipProps) {
  return (
    <div
      data-testid="cx3d-tooltip"
      className="cx3d-tooltip"
      style={{ left: `${x}%`, top: `${y}%` }}
      role="tooltip"
    >
      {kicker ? <span className="cx3d-tooltip-kicker">{kicker}</span> : null}
      <span>{title}</span>
      {stateLabel ? <span className="cx3d-tooltip-state"> · {stateLabel}</span> : null}
      {children}
    </div>
  );
}
