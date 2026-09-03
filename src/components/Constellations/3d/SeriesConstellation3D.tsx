/**
 * SeriesConstellation3D — public entry for the on-course 3D tracker.
 *
 * Self-contained for a server page: gates on WebGL (falls back to the 2D
 * SeriesConstellation), lazy-imports the whole three/r3f chunk (keeping blog
 * pages light), hosts the r3f scene + bloom + DOM tooltip overlay, and owns
 * lesson-click navigation via next/navigation.
 *
 * The 2D fallback renders when WebGL is unavailable — the exact same data,
 * so the surface never goes dark.
 */
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import type { ConstellationState } from "@/shared/contracts-constellations";
import { supportsWebGL } from "./webgl";
import { stateLabel } from "./star-model";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import type { HoverState } from "./SeriesScene";
import { StarTooltip } from "./StarTooltip";
import { LoadingSky } from "./LoadingSky";
import { SeriesConstellation } from "../SeriesConstellation";

// Lazy, browser-only import of the full three stack.
const ConstellationCanvas = dynamic(
  () => import("./ConstellationCanvas").then((m) => m.ConstellationCanvas),
  { ssr: false, loading: () => <LoadingSky label="Charting your sky" /> },
);
const SeriesScene = dynamic(
  () => import("./SeriesScene").then((m) => m.SeriesScene),
  { ssr: false },
);

export interface SeriesConstellation3DProps {
  constellation: ConstellationState;
  isGuest?: boolean;
  prefersReducedMotion?: boolean;
}

export function SeriesConstellation3D({
  constellation,
  isGuest = false,
  prefersReducedMotion = false,
}: SeriesConstellation3DProps) {
  const router = useRouter();
  // Client-only detection (see webgl.ts) so SSR never renders the 3D canvas.
  const [webgl] = useState(() => supportsWebGL());
  const [hover, setHover] = useState<HoverState | null>(null);
  // G2: bind to the user's motion preference (ignition/drift/parallax off).
  const reducedMotion = usePrefersReducedMotion();
  const effectiveReducedMotion = prefersReducedMotion || reducedMotion;

  const handleHover = useCallback((h: HoverState | null) => setHover(h), []);

  const handleSelect = useCallback(
    (lessonSlug: string) => {
      router.push(`/learn/${constellation.seriesSlug}/${lessonSlug}`);
    },
    [router, constellation.seriesSlug],
  );

  if (!webgl) {
    return <SeriesConstellation constellation={constellation} isGuest={isGuest} />;
  }

  return (
    <div className="cx3d-scene" data-testid="cx3d-series-scene" style={{ height: 460 }}>
      <ConstellationCanvas
        label="Charting your sky"
        fallback={
          <SeriesConstellation constellation={constellation} isGuest={isGuest} />
        }
        bloom={{ strength: 0.9, threshold: 0.82, radius: 0.6 }}
        prefersReducedMotion={effectiveReducedMotion}
      >
        <SeriesScene
          constellation={constellation}
          onHover={handleHover}
          onSelect={handleSelect}
          prefersReducedMotion={effectiveReducedMotion}
        />
      </ConstellationCanvas>
      {hover && (
        <StarTooltip
          x={hover.x}
          y={hover.y}
          kicker={`Lesson ${hover.star.index}`}
          title={hover.star.label}
          stateLabel={stateLabel(hover.star.state)}
        />
      )}
    </div>
  );
}

export default SeriesConstellation3D;
