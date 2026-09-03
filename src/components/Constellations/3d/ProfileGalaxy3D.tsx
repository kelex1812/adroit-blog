/**
 * ProfileGalaxy3D — public entry for the 3D profile galaxy hero (/profile).
 *
 * Self-contained for a server page: gates on WebGL (falls back to `fallback2D`),
 * lazy-imports the whole three/r3f chunk, hosts the galaxy scene + bloom +
 * sector minimap overlay, and wires minimap clicks to camera flight.
 *
 * This component is the "sky" — the hero IS the starfield. On the profile page
 * it replaces the flat static galaxy with a navigable 3D one; the caller passes
 * `fallback2D` (e.g. the existing FullSkySection content) for the no-WebGL case
 * so that surface never goes dark.
 */
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useCallback, useMemo } from "react";
import type { ProfileSky, RankId } from "@/shared/contracts-constellations";
import { supportsWebGL } from "./webgl";
import { buildGalaxyModel } from "./galaxy-model";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { SectorMinimap } from "./SectorMinimap";
import { StarTooltip } from "./StarTooltip";
import { LoadingSky } from "./LoadingSky";
import type { SectorHover } from "./ProfileScene";

const ConstellationCanvas = dynamic(
  () => import("./ConstellationCanvas").then((m) => m.ConstellationCanvas),
  { ssr: false, loading: () => <LoadingSky label="Materializing your galaxy" /> },
);
const ProfileScene = dynamic(
  () => import("./ProfileScene").then((m) => m.ProfileScene),
  { ssr: false },
);

export interface ProfileGalaxy3DProps {
  sky: ProfileSky;
  rank: RankId;
  certifiedSeriesSlugs?: ReadonlySet<string>;
  /** Rendered when WebGL is unavailable. */
  fallback2D: React.ReactNode;
  /** Optional chrome overlaid on top of the galaxy scene. */
  children?: React.ReactNode;
  onSelectSector?: (seriesSlug: string) => void;
  prefersReducedMotion?: boolean;
}

export function ProfileGalaxy3D({
  sky,
  rank,
  certifiedSeriesSlugs,
  fallback2D,
  children,
  onSelectSector,
  prefersReducedMotion = false,
}: ProfileGalaxy3DProps) {
  const router = useRouter();
  const [webgl] = useState(() => supportsWebGL());
  const [hover, setHover] = useState<SectorHover | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  // G2: bind to the user's motion preference (camera flight/parallax off).
  const reducedMotion = usePrefersReducedMotion();
  const effectiveReducedMotion = prefersReducedMotion || reducedMotion;

  // Minimap dots come from the pure galaxy model (deterministic, no three).
  const { sectors } = useMemo(
    () => buildGalaxyModel({ sky, certifiedSeriesSlugs }),
    [sky, certifiedSeriesSlugs],
  );

  const handleHover = useCallback((h: SectorHover | null) => setHover(h), []);

  const handleSelectSector = useCallback(
    (slug: string) => {
      setActiveSlug(slug);
      if (onSelectSector) onSelectSector(slug);
      else router.push(`/learn/${slug}`);
    },
    [onSelectSector, router],
  );

  if (!webgl) return <>{fallback2D}</>;

  return (
    <div
      className="cx3d-scene cx3d-scene--galaxy"
      data-testid="cx3d-galaxy-scene"
    >
      <ConstellationCanvas
        label="Materializing your galaxy"
        fallback={fallback2D}
        bloom={{ strength: 0.8, threshold: 0.85, radius: 0.55 }}
        prefersReducedMotion={effectiveReducedMotion}
      >
        <ProfileScene
          sky={sky}
          rank={rank}
          certifiedSeriesSlugs={certifiedSeriesSlugs}
          onHover={handleHover}
          onSelectSector={handleSelectSector}
          prefersReducedMotion={effectiveReducedMotion}
        />
      </ConstellationCanvas>
      <SectorMinimap
        sectors={sectors}
        activeSlug={activeSlug}
        onSelect={handleSelectSector}
      />
      {children ? (
        <div className="cx3d-overlay" data-testid="cx3d-galaxy-overlay">
          {children}
        </div>
      ) : null}
      {hover && (
        <StarTooltip
          x={hover.x}
          y={hover.y}
          kicker={hover.sector.name}
          title={hover.starLabel}
        />
      )}
    </div>
  );
}

export default ProfileGalaxy3D;
