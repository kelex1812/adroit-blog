/**
 * IgnitedStar — one star in the 3D constellation, rendered as layered LIGHT.
 *
 * Design lesson: a star is a glowing round point of light — a white-hot core
 * over a tinted mid glow over a soft additive bloom — never a drawn cross.
 * We stack THREE additive sprites (bloom + mid + core) on a billboard and give
 * each star its own color temperature, size, and a staggered twinkle so no two
 * stars shine identically.
 *
 * Also the raycast hit target: pointer over lifts + reports hover; click
 * reports the lesson slug for click-to-fly / navigation.
 */
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { glowTexture } from "./glow-texture";
import type { Star3D } from "./star-model";

export interface IgnitedStarProps {
  star: Star3D;
  /** Master opacity (0..1) driven by the ignition sequence. */
  litOpacity?: number;
  /** Master scale multiplier — used to scale up the current lesson star. */
  scale?: number;
  /** Disable twinkle + motion (prefers-reduced-motion). */
  staticMode?: boolean;
  onHover?: (slug: string | null) => void;
  onSelect?: (slug: string) => void;
}

/** Layered star: [bloom, mid, core] — all additive billboard sprites. */
export function IgnitedStar({
  star,
  litOpacity = 1,
  scale = 1,
  staticMode = false,
  onHover,
  onSelect,
}: IgnitedStarProps) {
  const tex = useMemo(() => glowTexture(), []);
  const group = useRef<THREE.Group>(null);

  // Bloom presence is gated by state (unlit stars have NO bloom), not just
  // opacity — so the overall scene keeps the design's bloom discipline.
  const bloomed = star.bloom > 0;
  const [hovered, setHovered] = useState(false);

  // Per-star unique temperature/size/phase already baked into `star`.
  const layers = useMemo(() => {
    const c = new THREE.Color(star.color);
    const core = c.clone().lerp(new THREE.Color("#ffffff"), 0.75);
    return {
      bloomColor: c.clone().multiplyScalar(1).getStyle(),
      coreColor: core.getStyle(),
      bloomScale: star.size * 4.2,
      midScale: star.size * 2.2,
      coreScale: star.size * 0.85,
    };
  }, [star.color, star.size]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // Staggered twinkle: unique duration + phase (star never blinks in unison).
    const tw =
      staticMode || star.state === "unlit"
        ? 1
        : 0.82 + 0.18 * Math.sin((t * Math.PI * 2) / star.twinkleDuration + star.twinklePhase);
    // Hover lift: scale up + a touch of forward z so it reads as "reaching out".
    const hoverMul = hovered ? 1.35 : 1;
    const s = star.size * scale * tw * hoverMul;
    // Per-layer scales scaled with the star so bloom grows with hover.
    const layers = g.children as THREE.Sprite[];
    if (layers[0]) {
      layers[0].scale.set(s * 4.2, s * 4.2, 1);
      layers[0].material.opacity = bloomed ? 0.35 * litOpacity : 0;
    }
    if (layers[1]) {
      layers[1].scale.set(s * 2.2, s * 2.2, 1);
      layers[1].material.opacity = bloomed ? 0.7 * litOpacity : 0;
    }
    if (layers[2]) {
      layers[2].scale.set(s * 0.85, s * 0.85, 1);
      layers[2].material.opacity = 1 * litOpacity;
    }
    g.position.z = hovered ? star.position[2] + 0.15 : star.position[2];
  });

  const handleHover = (on: boolean) => {
    setHovered(on);
    onHover?.(on ? star.slug : null);
  };

  return (
    <group ref={group} position={star.position}>
      <sprite
        scale={[star.size * 4.2, star.size * 4.2, 1]}
        onPointerOver={(e) => {
          e.stopPropagation();
          handleHover(true);
        }}
        onPointerOut={() => handleHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(star.slug);
        }}
      >
        <spriteMaterial
          map={tex}
          color={layers.bloomColor}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
          opacity={bloomed ? 0.35 : 0}
        />
      </sprite>
      <sprite scale={[star.size * 2.2, star.size * 2.2, 1]}>
        <spriteMaterial
          map={tex}
          color={star.color}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
          opacity={bloomed ? 0.7 : 0}
        />
      </sprite>
      <sprite scale={[star.size * 0.85, star.size * 0.85, 1]}>
        <spriteMaterial
          map={tex}
          color={layers.coreColor}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
          opacity={1}
        />
      </sprite>
    </group>
  );
}
