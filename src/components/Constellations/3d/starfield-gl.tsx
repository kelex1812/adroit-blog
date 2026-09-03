/**
 * starfield-gl.ts — ONE `Points` buffer starfield with a custom
 * RawShaderMaterial (ADR-306: full-advantage Three.js, GPU-first).
 *
 * Thousands of stars (the real asterism + a procedural background field +
 * the Milky Way band) drawn in a single draw call with per-star shader
 * attributes — NONE identical. Per-star variance (color temperature,
 * magnitude, staggered twinkle, spectral spike) is computed on the GPU.
 *
 * The interactive lesson stars remain higher-fidelity `IgnitedStar` sprites
 * (fine for ~29 lessons); this Points layer is the deep-sky field behind and
 * around them.
 */
"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { STAR_VERTEX_GLSL, STAR_FRAGMENT_GLSL } from "./star-material.glsl";
import { seededUnit } from "./star-model";

/** One star in the Points buffer. */
export interface StarPoint {
  position: [number, number, number];
  /** Spectral color (hex). */
  color: string;
  /** Apparent magnitude (lower = brighter/larger). */
  magnitude: number;
  twinklePhase: number;
  twinkleSpeed: number;
  /** Spectral diffraction-cross intensity (0..1). */
  spike: number;
}

export interface StarfieldGLProps {
  /** Explicit stars (the real asterism + any authored points). */
  stars?: StarPoint[];
  /** Number of procedural background field stars to scatter. */
  fieldCount?: number;
  /** Master opacity (0..1). */
  opacity?: number;
  /** Base point size. */
  size?: number;
  /** Disable twinkle/drift (prefers-reduced-motion). */
  staticMode?: boolean;
}

/** Deterministic procedural field star (seeded, never identical). */
function fieldStar(i: number): StarPoint {
  const u = seededUnit(`field:${i}`);
  const u2 = seededUnit(`field:${i}:2`);
  const u3 = seededUnit(`field:${i}:3`);
  // Scatter across a large sphere shell (radius 18–40) for real depth.
  const r = 18 + u * 22;
  const theta = u2 * Math.PI * 2;
  const phi = Math.acos(2 * u3 - 1);
  const position: [number, number, number] = [
    Number((r * Math.sin(phi) * Math.cos(theta)).toFixed(2)),
    Number((r * Math.sin(phi) * Math.sin(theta)).toFixed(2)),
    Number((r * Math.cos(phi)).toFixed(2)),
  ];
  // Cool blue-white field stars (real deep-sky), a few warm.
  const warm = u > 0.82;
  const color = warm ? "#ffd9a8" : u > 0.5 ? "#aac4ff" : "#cad8ff";
  return {
    position,
    color,
    magnitude: Number((2 + u * 4).toFixed(2)),
    twinklePhase: u2 * Math.PI * 2,
    twinkleSpeed: Number((0.6 + u3 * 2.4).toFixed(2)),
    spike: Number((u * 0.5).toFixed(2)),
  };
}

/** Build the Milky Way band of unresolved faint stars along the XZ plane. */
function milkyWayStars(count: number): StarPoint[] {
  const out: StarPoint[] = [];
  for (let i = 0; i < count; i++) {
    const u = seededUnit(`mw:${i}`);
    const u2 = seededUnit(`mw:${i}:2`);
    const r = 20 + u * 20;
    const angle = u2 * Math.PI * 2;
    // Band is thin in y (the galactic plane), wide in x/z.
    const y = (u - 0.5) * 2.2;
    out.push({
      position: [
        Number((Math.cos(angle) * r).toFixed(2)),
        Number(y.toFixed(2)),
        Number((Math.sin(angle) * r).toFixed(2)),
      ],
      color: "#c8d2eb",
      magnitude: Number((4 + u * 3).toFixed(2)),
      twinklePhase: u2 * Math.PI * 2,
      twinkleSpeed: Number((0.4 + u * 1.6).toFixed(2)),
      spike: 0,
    });
  }
  return out;
}

export function StarfieldGL({
  stars = [],
  fieldCount = 900,
  opacity = 1,
  size = 1,
  staticMode = false,
}: StarfieldGLProps) {
  const material = useRef<THREE.ShaderMaterial>(null);

  // Build the single Points buffer: explicit stars + procedural field + MW band.
  const { positions, colors, magnitudes, phases, speeds, spikes } = useMemo(() => {
    const field = Array.from({ length: fieldCount }, (_, i) => fieldStar(i));
    const mw = milkyWayStars(600);
    const all = [...stars, ...field, ...mw];
    const positions = new Float32Array(all.length * 3);
    const colors = new Float32Array(all.length * 3);
    const magnitudes = new Float32Array(all.length);
    const phases = new Float32Array(all.length);
    const speeds = new Float32Array(all.length);
    const spikes = new Float32Array(all.length);
    all.forEach((s, i) => {
      positions[i * 3] = s.position[0];
      positions[i * 3 + 1] = s.position[1];
      positions[i * 3 + 2] = s.position[2];
      const c = new THREE.Color(s.color);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      magnitudes[i] = s.magnitude;
      phases[i] = s.twinklePhase;
      speeds[i] = s.twinkleSpeed;
      spikes[i] = s.spike;
    });
    return { positions, colors, magnitudes, phases, speeds, spikes };
  }, [stars, fieldCount]);

  useFrame((state) => {
    const m = material.current;
    if (!m) return;
    // G2: reduced motion freezes the twinkle (uTime stays 0 → static field).
    m.uniforms.uTime.value = staticMode ? 0 : state.clock.elapsedTime;
    m.uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 2);
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColorTemp" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aMagnitude" args={[magnitudes, 1]} />
        <bufferAttribute attach="attributes-aTwinklePhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aTwinkleSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aSpike" args={[spikes, 1]} />
      </bufferGeometry>
      <rawShaderMaterial
        ref={material}
        vertexShader={STAR_VERTEX_GLSL}
        fragmentShader={STAR_FRAGMENT_GLSL}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uSize: { value: size },
          uOpacity: { value: opacity },
        }}
      />
    </points>
  );
}
