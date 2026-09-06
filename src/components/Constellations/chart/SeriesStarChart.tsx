/**
 * SeriesStarChart — the on-course tracker at `/learn/[series]`.
 *
 * The course's own constellation, drawn once and centred, with its star lines
 * lit to match real progress. Replaces `SeriesConstellation3D` in the Hubble
 * Field Phase 2 port; both that component and the `SeriesConstellation` vertical
 * rail it fell back to are left in tree and unmounted for one release.
 *
 * There is no WebGL gate and no lazy chunk to wait for, because the chart is
 * SVG — which is the point. The old surface shipped a WebGL probe, a
 * three/r3f dynamic import, a loading state and a 2D fallback to render one
 * constellation; this needs none of them.
 *
 * Nothing here is selectable: the page already *is* the course, so the figure
 * carries no interaction and the syllabus below owns lesson navigation.
 */
"use client";

import { useMemo } from "react";
import type { ConstellationState } from "@/shared/contracts-constellations";
import { buildChartFigure } from "@/lib/chart";
import { StarChart } from "./StarChart";

export interface SeriesStarChartProps {
  constellation: ConstellationState;
  isGuest?: boolean;
  /**
   * Whether the cert exam has been passed. The page would need its own query to
   * know, so it defaults off and the crowning node then follows `complete` —
   * see `docs/implementation-plan-hubble-field.md` §3.1.
   */
  examPassed?: boolean;
}

export function SeriesStarChart({
  constellation,
  isGuest = false,
  examPassed = false,
}: SeriesStarChartProps) {
  const figures = useMemo(
    () => [buildChartFigure(constellation, { examPassed })],
    [constellation, examPassed],
  );

  return (
    <StarChart
      figures={figures}
      variant="single"
      focusSlug={null}
      onFocusChange={() => {}}
      isGuest={isGuest}
    />
  );
}

export default SeriesStarChart;
