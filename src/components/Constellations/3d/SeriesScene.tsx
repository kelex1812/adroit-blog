/**
 * SeriesScene — the r3f on-course tracker scene (Learn course page).
 *
 * Renders the course's constellation in real 3D: layered-glow stars on an
 * organic path, additive connecting rails, an ignition sequence that surges
 * lit stars on one-by-one in lesson order on mount, slow camera drift +
 * pointer parallax, raycast hover (lift + DOM tooltip), and click-to-fly to a
 * lesson. Blooms via the parent EffectComposer — only lit/current/complete
 * stars exceed the bloom threshold (unlit pinpricks stay dim).
 */
"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { IgnitedStar } from "./IgnitedStar";
import { buildSeriesStars, STAR_PALETTE, type Star3D } from "./star-model";
import { overlayAsterism, asterismFor } from "./asterism-data";
import type { ConstellationState } from "@/shared/contracts-constellations";

export interface HoverState {
  star: Star3D;
  /** Screen position in % of the container (for the DOM tooltip). */
  x: number;
  y: number;
}

export interface SeriesSceneProps {
  constellation: ConstellationState;
  currentLessonSlug?: string | null;
  /** DOM overlay for the hovered star — set by the parent. */
  onHover?: (h: HoverState | null) => void;
  /** Click → navigate to lesson (parent owns router). */
  onSelect?: (lessonSlug: string) => void;
  prefersReducedMotion?: boolean;
}

/** Additive rail connecting the real asterism's figure (belt, shoulders, feet). */
function ConnectingRails({
  stars,
  connections,
}: {
  stars: Star3D[];
  connections: [number, number][];
}) {
  const lines = useMemo(() => {
    const out: { key: string; points: [number, number, number][] }[] = [];
    for (const [a, b] of connections) {
      const sa = stars[a];
      const sb = stars[b];
      if (!sa || !sb) continue;
      out.push({
        key: `${sa.slug}-${sb.slug}`,
        points: [sa.position, sb.position],
      });
    }
    return out;
  }, [stars, connections]);

  return (
    <>
      {lines.map((l) => (
        <line key={l.key}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(l.points.flat()), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#9fc4ff"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </line>
      ))}
    </>
  );
}

/** Project a world position to % screen coords inside the canvas container. */
function projectToPercent(
  pos: THREE.Vector3,
  camera: THREE.Camera,
): { x: number; y: number } {
  const v = pos.clone().project(camera);
  return {
    x: ((v.x + 1) / 2) * 100,
    y: ((1 - v.y) / 2) * 100,
  };
}

export function SeriesScene({
  constellation,
  currentLessonSlug,
  onHover,
  onSelect,
  prefersReducedMotion = false,
}: SeriesSceneProps) {
  const stars = useMemo(() => {
    const base = buildSeriesStars({ constellation, currentLessonSlug });
    // Overlay the real asterism (Orion/Cassiopeia) — real positions, spectral
    // class, magnitude, and the Betelgeuse accent (ADR-307). Unlit stars stay
    // faint cool (unborn protostars), not their spectral color.
    return overlayAsterism(base, constellation.seriesSlug).map((s) =>
      s.state === "unlit" ? { ...s, color: STAR_PALETTE.unlit.color } : s,
    );
  }, [constellation, currentLessonSlug]);
  const [hovered, setHovered] = useState<Star3D | null>(null);
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const { pointer } = useThree();

  // Ignition sequence: lit stars surge on one-by-one in lesson order (~120ms
  // stagger), respecting reduced motion (skip straight to lit). Each lit
  // star's reveal gate is its order among LIT stars (not absolute lesson pos).
  const litOrder = useMemo(() => {
    const map = new Map<string, number>();
    stars.forEach((s, i) => {
      if (s.state === "ignited" || s.state === "complete") map.set(s.slug, i);
    });
    return map;
  }, [stars]);
  const [revealedCount, setRevealedCount] = useState(
    prefersReducedMotion ? litOrder.size : 0,
  );
  useEffect(() => {
    if (prefersReducedMotion) return;
    const total = litOrder.size;
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setRevealedCount(i);
      if (i >= total) window.clearInterval(timer);
    }, 120);
    return () => window.clearInterval(timer);
  }, [litOrder, prefersReducedMotion]);

  const isRevealed = useCallback(
    (slug: string) => {
      if (prefersReducedMotion) return true;
      const star = stars.find((s) => s.slug === slug);
      if (!star) return false;
      // Unlit pinpricks and the current "you are here" star are ALWAYS visible
      // (dim / cyan pulse). Only ignited/complete stars surge on via the
      // ignition sequence — gating them behind litOrder keeps the sky from
      // going blank on a course with no completed lessons yet.
      if (star.state === "unlit" || star.state === "current") return true;
      const idx = litOrder.get(slug);
      return idx === undefined ? false : idx < revealedCount;
    },
    [litOrder, revealedCount, prefersReducedMotion, stars],
  );

  // Slow camera drift + pointer parallax (damped), disabled for reduced motion.
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (!prefersReducedMotion) {
      const t = state.clock.elapsedTime;
      const drift = Math.sin(t * 0.12) * 0.25;
      const px = pointer.x * 0.5;
      const py = pointer.y * 0.35;
      const target = new THREE.Vector3(px, py, drift);
      g.position.lerp(target, 0.02);
    } else {
      g.position.set(0, 0, 0);
    }
  });

  const handleHover = useCallback(
    (slug: string | null) => {
      if (!slug) {
        setHovered(null);
        onHover?.(null);
        return;
      }
      const s = stars.find((x) => x.slug === slug) ?? null;
      setHovered(s);
      if (s) {
        const pos = new THREE.Vector3(...s.position);
        onHover?.({ star: s, ...projectToPercent(pos, camera) });
      } else {
        onHover?.(null);
      }
    },
    [stars, camera, onHover],
  );

  const handleSelect = useCallback(
    (slug: string) => {
      // Fly the camera toward the star before navigating (design: click-to-fly).
      const s = stars.find((x) => x.slug === slug);
      if (s) {
        const cam = camera as THREE.PerspectiveCamera;
        const target = new THREE.Vector3(...s.position);
        // Snap camera to look at the star's world position.
        cam.position.set(target.x, target.y, target.z + 6);
        cam.lookAt(target);
      }
      onSelect?.(slug);
    },
    [stars, camera, onSelect],
  );

  return (
      <group ref={group}>
              <ConnectingRails
                stars={stars}
                connections={asterismFor(constellation.seriesSlug)?.connections ?? []}
              />
              {stars.map((star) => {
        const litNowForThis = isRevealed(star.slug);
        return (
          <IgnitedStar
            key={star.slug}
            star={star}
            litOpacity={litNowForThis ? 1 : 0}
            scale={hovered?.slug === star.slug ? 1.35 : 1}
            staticMode={prefersReducedMotion}
            onHover={handleHover}
            onSelect={handleSelect}
          />
        );
      })}
    </group>
  );
}

/** Convenience: lit count for HUD chrome (stars lit / total). */
export function seriesLitLabel(constellation: ConstellationState): string {
  return `${constellation.litStars} / ${constellation.totalStars} stars lit`;
}
