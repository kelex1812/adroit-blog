/**
 * ConstellationGlyph — the LOD node for a non-focused sector (deep-sky "Sky
 * Roads", kara t_ea789325 + arch t_2156deb1).
 *
 * At overview distance every course renders as a compact bright-anchor glyph:
 * the recognizable asterism subset (`sector.glyph` — real positions, spectral
 * colors, magnitude-scaled) at --glyph-scale, a status halo ring + progress arc
 * (lit/total) around it, and the name label. Clicking flies the camera in —
 * the figure then "materializes" at full fidelity in ProfileScene. Unstarted
 * sectors read as faint cool pinpricks; certified carry the diamond badge.
 */
"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { ConstellationGlyphProps, GlyphStar } from "@/shared/contracts-galaxy";
import type { Star3D } from "./star-model";

const STATE_COLORS: Record<string, string> = {
  certified: "#FFF6E8",
  completed: "#FFC46B",
  "in-progress": "#4FC3F7",
  unstarted: "#7DD3FC",
};

const STATE_HALO: Record<string, number> = {
  certified: 0.55,
  completed: 0.4,
  "in-progress": 0.35,
  unstarted: 0.12,
};

const GLYPH_SCALE = 0.34;
const ARC_RADIUS = 1.5;

function spectralColor(s: GlyphStar): string {
  if (s.isRedGiantAccent) return "#ff7a3d";
  if (s.isNebula) return "#ffd9a8";
  if (s.spectralClass === "O" || s.spectralClass === "B") return "#aac4ff";
  return "#fff4e0";
}

/** Convert a glyph star to the IgnitedStar-compatible Star3D shape. */
function toStar3D(sector: ConstellationGlyphProps["sector"], g: GlyphStar, i: number): Star3D {
  const isLit = sector.state !== "unstarted";
  const base = isLit ? spectralColor(g) : "#6b7a99";
  return {
    slug: `${sector.seriesSlug}#glyph-${i}`,
    label: g.name,
    index: i + 1,
    position: g.position,
    color: base,
    size: 0.5,
    bloom: isLit ? 0.6 : 0,
    twinkleDuration: 2.2 + (i % 7) * 0.35,
    twinklePhase: i * 0.7,
    state: isLit ? "ignited" : "unlit",
    spectralClass: g.spectralClass,
    magnitude: g.magnitude,
    isRedGiantAccent: g.isRedGiantAccent,
  };
}

/** The progress arc (lit/total) drawn around the glyph — warm fill, cool track. */
function ProgressArc({ fraction, color }: { fraction: number; color: string }) {
  const pts = useMemo(() => {
    const out: number[] = [];
    const steps = 28;
    const f = Math.min(1, Math.max(0, fraction));
    for (let i = 0; i <= steps; i++) {
      const a = (-Math.PI / 2 + (i / steps) * Math.PI * 2) * f;
      out.push(Math.cos(a) * ARC_RADIUS, Math.sin(a) * ARC_RADIUS, 0);
    }
    return new Float32Array(out);
  }, [fraction]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pts, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  );
}

/** The faint full-circle track behind the progress arc. */
function ArcTrack() {
  const pts = useMemo(() => {
    const out: number[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const a = (-Math.PI / 2 + (i / steps) * Math.PI * 2);
      out.push(Math.cos(a) * ARC_RADIUS, Math.sin(a) * ARC_RADIUS, 0);
    }
    return new Float32Array(out);
  }, []);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pts, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color="#7DD3FC"
        transparent
        opacity={0.16}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  );
}

export function ConstellationGlyph({
  sector,
  isFrontier,
  onSelect,
  prefersReducedMotion = false,
}: ConstellationGlyphProps) {
  const stars = useMemo(() => sector.glyph.map((g, i) => toStar3D(sector, g, i)), [sector]);
  const haloRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = STATE_COLORS[sector.state] ?? STATE_COLORS.unstarted;
  const fraction = sector.totalStars > 0 ? sector.litStars / sector.totalStars : 0;

  // Gentle halo pulse on the frontier (or on hover), off for reduced motion.
  useFrame((state) => {
    const m = haloRef.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const pulse = isFrontier && !prefersReducedMotion ? 0.75 + 0.25 * Math.sin(t * 2) : 1;
    const hover = hovered ? 1.18 : 1;
    m.scale.setScalar(1.6 * pulse * hover);
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = (STATE_HALO[sector.state] ?? 0.12) * (hovered ? 1.4 : 1);
  });

  const empty = stars.length === 0;

  return (
    <group
      position={sector.position}
      scale={GLYPH_SCALE}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(sector.seriesSlug);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Status halo */}
      <mesh ref={haloRef}>
        <ringGeometry args={[1.05, 1.25, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={STATE_HALO[sector.state] ?? 0.12}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Certified diamond badge */}
      {sector.state === "certified" ? (
        <mesh position={[1.45, 1.45, 0]} rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial
            color="#FFF6E8"
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      {/* Progress arc */}
      <ArcTrack />
      <ProgressArc fraction={fraction} color={sector.state === "in-progress" ? "#22D3EE" : "#FFC46B"} />
      {/* Bright anchors — real asterism figure at glyph scale */}
      {stars.map((s) => (
        <sprite key={s.slug} position={s.position} scale={[s.size * 2.2, s.size * 2.2, 1]}>
          <spriteMaterial
            color={s.color}
            transparent
            opacity={sector.state === "unstarted" ? 0.55 : 0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
      {empty ? (
        // No authored asterism: show a lone pinprick so the node still reads.
        <sprite scale={[1.2, 1.2, 1]}>
          <spriteMaterial color={color} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ) : null}
      {/* Name label */}
      <Html position={[0, -1.9, 0]} center style={{ pointerEvents: "none" }}>
        <span className="cx3d-glyph-label">{sector.name}</span>
      </Html>
    </group>
  );
}
