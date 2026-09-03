/**
 * ProfileScene — the r3f profile galaxy scene (/profile), deep-sky "Sky Roads"
 * LOD (kara t_ea789325 + arch t_2156deb1).
 *
 * The LOD scene: ONE focused constellation renders at full deep-sky fidelity
 * (all member stars via IgnitedStar, real spectral colors, per-star lit state,
 * figure lines — the Command/Inspect surface); every other sector renders as a
 * compact bright-anchor ConstellationGlyph. The additive SkyRoad threads the
 * nodes (traveled warm / untraveled cool), the WaypointReticle pulses on the
 * frontier, and the CameraRig dolly-and-tilts between sectors (reduced motion
 * = static). Free-floating article stars scatter through the interior.
 * Blooms via the parent EffectComposer.
 */
"use client";

import { useMemo, useCallback } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { IgnitedStar } from "./IgnitedStar";
import { STAR_PALETTE, type Star3D } from "./star-model";
import { asterismFor, projectAsterism } from "./asterism-data";
import { buildGalaxyModel, type GalaxySector } from "./galaxy-model";
import { ConstellationGlyph } from "./ConstellationGlyph";
import { SkyRoad } from "./SkyRoad";
import { WaypointReticle } from "./WaypointReticle";
import { CameraRig } from "./CameraRig";
import type { ProfileSky, RankId } from "@/shared/contracts-constellations";

export interface SectorHover {
  sector: GalaxySector;
  starLabel: string;
  x: number;
  y: number;
}

export interface ProfileSceneProps {
  sky: ProfileSky;
  rank: RankId;
  certifiedSeriesSlugs?: ReadonlySet<string>;
  /** Focused sector slug (null = overview). Owned by the parent (shared with HUD). */
  focusSlug?: string | null;
  /** Fired when the camera settles on a sector (or null on return to overview). */
  onSettled?: (slug: string | null) => void;
  /** DOM overlay for a hovered glyph star. */
  onHover?: (h: SectorHover | null) => void;
  onSelectSector?: (seriesSlug: string) => void;
  prefersReducedMotion?: boolean;
}

function projectToPercent(
  pos: THREE.Vector3,
  camera: THREE.Camera,
): { x: number; y: number } {
  const v = pos.clone().project(camera);
  return { x: ((v.x + 1) / 2) * 100, y: ((1 - v.y) / 2) * 100 };
}

/**
 * The focused constellation, rendered at full deep-sky fidelity: real asterism
 * member stars (scaled to fit), spectral colors, per-star lit state, figure
 * lines. This is the Command/Inspect surface.
 */
function FocusedConstellation({
  sector,
  onHover,
  onSelect,
}: {
  sector: GalaxySector;
  onHover: (s: Star3D | null, sector: GalaxySector) => void;
  onSelect: (sector: GalaxySector) => void;
}) {
  const stars: Star3D[] = useMemo(() => {
    const asterism = asterismFor(sector.seriesSlug);
    if (asterism) {
      return projectAsterism(asterism, 1.7).map((real, i) => {
        const lit = i < sector.litStars;
        return {
          slug: `${sector.seriesSlug}#${i}`,
          label: real.name,
          index: i + 1,
          position: real.position,
          color: lit
            ? real.isRedGiantAccent
              ? "#ff7a3d"
              : real.isNebula
                ? "#ffd9a8"
                : real.spectralClass === "O" || real.spectralClass === "B"
                  ? "#aac4ff"
                  : "#fff4e0"
            : STAR_PALETTE.unlit.color,
          size: lit ? 0.5 : 0.3,
          bloom: lit ? STAR_PALETTE.ignited.bloom : 0,
          twinkleDuration: 2.2 + (i % 7) * 0.35,
          twinklePhase: i * 0.7,
          state: lit ? "ignited" : "unlit",
          spectralClass: real.spectralClass,
          magnitude: real.magnitude,
          isRedGiantAccent: real.isRedGiantAccent,
        };
      });
    }
    // Fallback (course with no authored asterism): deterministic ring.
    const n = Math.max(4, Math.min(9, sector.totalStars || 7));
    const out: Star3D[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 1.1 + (i % 3) * 0.25;
      const lit = i < sector.litStars;
      out.push({
        slug: `${sector.seriesSlug}#${i}`,
        label: `${sector.name} ${i + 1}`,
        index: i + 1,
        position: [
          Number((Math.cos(a) * r).toFixed(3)),
          Number((Math.sin(i * 2.3) * 0.3).toFixed(3)),
          Number((Math.sin(a) * r).toFixed(3)),
        ],
        color: lit ? STAR_PALETTE.ignited.color : STAR_PALETTE.unlit.color,
        size: lit ? 0.5 : 0.3,
        bloom: lit ? STAR_PALETTE.ignited.bloom : 0,
        twinkleDuration: 2.2 + (i % 7) * 0.35,
        twinklePhase: i * 0.7,
        state: lit ? "ignited" : "unlit",
      });
    }
    return out;
  }, [sector]);

  const ringPoints = useMemo(() => {
    const asterism = asterismFor(sector.seriesSlug);
    if (asterism) {
      const pts: number[] = [];
      for (const [a, b] of asterism.connections) {
        const sa = stars[a];
        const sb = stars[b];
        if (sa && sb) pts.push(...sa.position, ...sb.position);
      }
      return new Float32Array(pts);
    }
    return new Float32Array(stars.flatMap((s) => s.position).flat().map(Number));
  }, [stars, sector.seriesSlug]);

  return (
    <group position={sector.position}>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ringPoints, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#4FC3F7"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
      {stars.map((star) => (
        <IgnitedStar
          key={star.slug}
          star={star}
          litOpacity={1}
          staticMode
          onHover={(slug) =>
            onHover(
              slug ? stars.find((x) => x.slug === slug) ?? null : null,
              sector,
            )
          }
          onSelect={() => onSelect(sector)}
        />
      ))}
    </group>
  );
}

export function ProfileScene({
  sky,
  certifiedSeriesSlugs,
  focusSlug,
  onSettled,
  onHover,
  onSelectSector,
  prefersReducedMotion = false,
}: ProfileSceneProps) {
  const { sectors, articles, road, frontierSlug } = useMemo(
    () => buildGalaxyModel({ sky, certifiedSeriesSlugs, focusSlug }),
    [sky, certifiedSeriesSlugs, focusSlug],
  );
  const camera = useThreeCam();

  const handleSectorHover = useCallback(
    (star: Star3D | null, sector: GalaxySector) => {
      if (!star) {
        onHover?.(null);
        return;
      }
      const pos = new THREE.Vector3(...sector.position);
      const pt = projectToPercent(pos, camera);
      onHover?.({
        sector,
        starLabel: star.label,
        x: pt.x,
        y: pt.y,
      });
    },
    [camera, onHover],
  );

  const flyToSector = useCallback(
    (sector: GalaxySector) => onSelectSector?.(sector.seriesSlug),
    [onSelectSector],
  );

  // Glyph nodes pass a slug; the focused constellation passes the sector.
  const flyToSectorBySlug = useCallback(
    (slug: string) => onSelectSector?.(slug),
    [onSelectSector],
  );

  const frontierNav = sectors.find((s) => s.seriesSlug === frontierSlug) ?? null;

  return (
    <>
      <CameraRig
        focusSlug={focusSlug ?? null}
        sectors={sectors}
        frontierSlug={frontierSlug}
        prefersReducedMotion={prefersReducedMotion}
        onSettled={onSettled}
      />
      <SkyRoad road={road} sectors={sectors} prefersReducedMotion={prefersReducedMotion} />
      {sectors.map((sector) => {
        const isFocus = sector.seriesSlug === focusSlug;
        if (isFocus) {
          return (
            <FocusedConstellation
              key={sector.seriesSlug}
              sector={sector}
              onHover={handleSectorHover}
              onSelect={flyToSector}
            />
          );
        }
        return (
          <ConstellationGlyph
            key={sector.seriesSlug}
            sector={sector}
            isFrontier={sector.seriesSlug === frontierSlug}
            onSelect={flyToSectorBySlug}
            prefersReducedMotion={prefersReducedMotion}
          />
        );
      })}
      {frontierNav ? (
        <WaypointReticle
          sector={frontierNav}
          prefersReducedMotion={prefersReducedMotion}
        />
      ) : null}
      {articles.map((a) => (
        <IgnitedStar
          key={`article-${a.id}`}
          star={{
            slug: `article-${a.id}`,
            label: a.title,
            index: 0,
            position: a.position,
            color: a.color,
            size: a.size,
            bloom: 0.5,
            twinkleDuration: 3.1,
            twinklePhase: (a.id % 10) * 0.6,
            state: "ignited",
          }}
          litOpacity={1}
          staticMode
          onHover={() => undefined}
          onSelect={() => undefined}
        />
      ))}
    </>
  );
}

/** Small helper so ProfileScene doesn't import useThree directly (keeps diff clean). */
function useThreeCam() {
  return useThree((s) => s.camera) as THREE.PerspectiveCamera;
}
