/**
 * ProfileScene — the r3f profile galaxy scene (/profile).
 *
 * Every course = a 3D sector (its constellation rendered in place) positioned
 * on a ring; completed sectors fully lit, in-progress partially lit, unstarted
 * faint. Free-floating article stars scatter through the interior. The camera
 * flies to a sector on selection (damped tween) and the rank ladder maps to
 * overall galaxy illumination. Blooms via parent EffectComposer.
 */
"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { IgnitedStar } from "./IgnitedStar";
import { STAR_PALETTE, type Star3D } from "./star-model";
import { asterismFor, projectAsterism } from "./asterism-data";
import {
  buildGalaxyModel,
  RANK_ILLUMINATION,
  type GalaxySector,
} from "./galaxy-model";
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
  /** DOM overlay for a hovered sector star. */
  onHover?: (h: SectorHover | null) => void;
  onSelectSector?: (seriesSlug: string) => void;
  prefersReducedMotion?: boolean;
}

const CAMERA_HOME: [number, number, number] = [0, 4.6, 9.5];

function projectToPercent(
  pos: THREE.Vector3,
  camera: THREE.Camera,
): { x: number; y: number } {
  const v = pos.clone().project(camera);
  return { x: ((v.x + 1) / 2) * 100, y: ((1 - v.y) / 2) * 100 };
}

/** One course's constellation, rendered as a mini-scene at a sector position. */
function SectorConstellation({
  sector,
  litCount,
  onHover,
  onSelect,
}: {
  sector: GalaxySector;
  litCount: number;
  onHover: (s: Star3D | null, sector: GalaxySector) => void;
  onSelect: (sector: GalaxySector) => void;
}) {
  const stars: Star3D[] = useMemo(() => {
      // Real-asterism sectors (ADR-307): when the course maps to a real
      // constellation, draw its actual member stars (scaled to fit the sector)
      // with real spectral colors. Otherwise fall back to a deterministic ring.
      const asterism = asterismFor(sector.seriesSlug);
      if (asterism) {
        const projected = projectAsterism(asterism, 1.7);
        return projected.map((real, i) => {
          const lit = i < litCount;
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
      const n = Math.max(4, Math.min(9, sector.totalStars || 7));
      const out: Star3D[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 1.1 + (i % 3) * 0.25;
        const lit = i < litCount;
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
    }, [sector, litCount]);

  const ringPoints = useMemo(() => {
    // Real-asterism sectors draw the actual figure (belt/shoulders/feet);
    // fallback sectors draw a closed ring.
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
          <bufferAttribute
            attach="attributes-position"
            args={[ringPoints, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#4FC3F7"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
      {stars.map((star) => (
        <IgnitedStar
          key={star.slug}
          star={star}
          // Always visible so unstarted sectors read as faint pinpricks;
          // the star's own state (color/size/bloom) distinguishes lit vs dim.
          litOpacity={1}
          staticMode
          onHover={(slug) =>
            onHover(slug ? stars.find((x) => x.slug === slug) ?? null : null, sector)
          }
          onSelect={() => onSelect(sector)}
        />
      ))}
    </group>
  );
}

export function ProfileScene({
  sky,
  rank,
  certifiedSeriesSlugs,
  onHover,
  onSelectSector,
  prefersReducedMotion = false,
}: ProfileSceneProps) {
  const { sectors, articles } = useMemo(
    () => buildGalaxyModel({ sky, certifiedSeriesSlugs }),
    [sky, certifiedSeriesSlugs],
  );
  const holder = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const illumination = RANK_ILLUMINATION[rank] ?? RANK_ILLUMINATION.starseed;
  const fullyLitSectors = Math.round(illumination * sectors.length);
  const [focus, setFocus] = useState<THREE.Vector3>(
    () => new THREE.Vector3(...CAMERA_HOME),
  );

  // Damped camera flight toward the focused sector (reduced-motion: steady home).
  useFrame((state, dt) => {
    const cam = holder.current;
    if (!cam) return;
    const damp = 1 - Math.exp(-dt * (prefersReducedMotion ? 3 : 1.4));
    if (prefersReducedMotion) {
      cam.position.lerp(new THREE.Vector3(...CAMERA_HOME), damp);
    } else {
      cam.position.lerp(focus, damp);
    }
    cam.lookAt(0, 0, 0);
  });

  const flyToSector = useCallback(
    (sector: GalaxySector) => {
      setFocus(new THREE.Vector3(...sector.position));
      onSelectSector?.(sector.seriesSlug);
    },
    [onSelectSector],
  );

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

  return (
    <>
      <group ref={holder} position={CAMERA_HOME}>
        <pointLight position={[4, 6, 4]} intensity={0.3} color="#fff7e6" />
        <ambientLight intensity={0.45} />
      </group>
      {sectors.map((sector, i) => {
        const litCount =
          sector.state === "completed" || sector.state === "certified" || i < fullyLitSectors
            ? sector.totalStars
            : sector.state === "in-progress"
              ? Math.max(1, Math.round(sector.litStars))
              : 0;
        return (
          <SectorConstellation
            key={sector.seriesSlug}
            sector={sector}
            litCount={litCount}
            onHover={handleSectorHover}
            onSelect={flyToSector}
          />
        );
      })}
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