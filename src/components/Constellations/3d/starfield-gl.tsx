/**
 * starfield-gl.tsx — 3-shell procedural background starfield (deep-sky v1.2.0).
 *
 * REV 3 (matches the approved v2 demo): the background field is split into
 * THREE depth shells — near (r 8–14), mid (r 14–24), far (r 24–50) — that
 * SHIFT AT DIFFERENT RATES with the pointer, giving differential parallax
 * depth (near moves a lot, far barely). Each shell is its own `Points` draw
 * with the shared sharp-point star shader (star-material.glsl), so per-star
 * variance (color temperature, magnitude, staggered organic twinkle,
 * spectral spike) is computed on the GPU.
 *
 * The interactive lesson stars remain higher-fidelity `IgnitedStar` sprites
 * (fine for ~29 lessons); this layer is the deep-sky field behind them. The
 * flat single-shell Milky-Way band is retired in favor of the demo's pure
 * layered star field + nebula.
 */
"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { STAR_VERTEX_GLSL, STAR_FRAGMENT_GLSL } from "./star-material.glsl";
import { seededUnit } from "./star-model";

/** One star in a Points buffer. */
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
  /** Explicit foreground stars (drawn on the near shell, minimal parallax). */
  stars?: StarPoint[];
  /** Total procedural field star budget, split across the 3 depth shells. */
  fieldCount?: number;
  /** Master opacity (0..1). */
  opacity?: number;
  /** Base point size (multiplies shell base sizes). */
  size?: number;
  /** Disable twinkle/drift/parallax (prefers-reduced-motion). */
  staticMode?: boolean;
}

/** Depth-shell geometry spec (radii + factor + base size + palette weight). */
interface ShellSpec {
  key: "near" | "mid" | "far";
  rMin: number;
  rMax: number;
  /** Differential parallax factor (near shifts most, far least). */
  parallax: number;
  baseSize: number;
  count: number;
}

/** Deterministic procedural field star on a shell (seeded, never identical). */
function shellStar(i: number, key: string): StarPoint {
  const u = seededUnit(`${key}:${i}`);
  const u2 = seededUnit(`${key}:${i}:2`);
  const u3 = seededUnit(`${key}:${i}:3`);
  // Spherical scatter; the radius bounds come from the shell spec at build.
  const theta = u2 * Math.PI * 2;
  const phi = Math.acos(2 * u3 - 1);
  const position: [number, number, number] = [
    Number((Math.sin(phi) * Math.cos(theta)).toFixed(4)),
    Number((Math.sin(phi) * Math.sin(theta)).toFixed(4)),
    Number((Math.cos(phi)).toFixed(4)),
  ];
  // Cool blue-white deep-sky stars, a few warm. Colors identical across
  // shells; radius + magnitude drive apparent brightness/size.
  const warm = u > 0.85;
  const color = warm ? "#ffd9a8" : u > 0.5 ? "#aac4ff" : "#cad8ff";
  return {
    position,
    color,
    // Lower magnitude = brighter. Near/far handled by shell base + radius.
    magnitude: Number((2 + u * 4).toFixed(2)),
    twinklePhase: u2 * Math.PI * 2,
    twinkleSpeed: Number((0.6 + u3 * 2.4).toFixed(2)),
    spike: Number((u * 0.6).toFixed(2)),
  };
}

/** Build the typed attribute arrays for ONE shell at a given radius range. */
function buildShellAttributes(shell: ShellSpec) {
  const unit = Array.from({ length: shell.count }, (_, i) =>
    shellStar(i, shell.key),
  );
  const positions = new Float32Array(unit.length * 3);
  const colors = new Float32Array(unit.length * 3);
  const magnitudes = new Float32Array(unit.length);
  const phases = new Float32Array(unit.length);
  const speeds = new Float32Array(unit.length);
  const spikes = new Float32Array(unit.length);
  unit.forEach((s, i) => {
    const r = shell.rMin + seededUnit(`${shell.key}:r:${i}`) * (shell.rMax - shell.rMin);
    positions[i * 3] = s.position[0] * r;
    positions[i * 3 + 1] = s.position[1] * r;
    positions[i * 3 + 2] = s.position[2] * r;
    const c = new THREE.Color(s.color);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    magnitudes[i] = s.magnitude;
    phases[i] = s.twinklePhase;
    speeds[i] = s.twinkleSpeed;
    spikes[i] = s.spike;
  });
  return {
    length: unit.length,
    positions,
    colors,
    magnitudes,
    phases,
    speeds,
    spikes,
  };
}

function shellCounts(fieldCount: number) {
  // Weights roughly mirror the demo's shell density (more stars further out).
  const wNear = 0.19;
  const wMid = 0.34;
  const wFar = 0.55;
  return {
    near: Math.max(90, Math.round(fieldCount * wNear)),
    mid: Math.max(150, Math.round(fieldCount * wMid)),
    far: Math.max(220, Math.round(fieldCount * wFar)),
  };
}

/** One parallaxed depth shell. */
function DepthShell({
  spec,
  size,
  opacity,
  staticMode,
  shellRef,
}: {
  spec: ShellSpec;
  size: number;
  opacity: number;
  staticMode: boolean;
  shellRef: React.RefObject<THREE.Group>;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const attrs = useMemo(() => buildShellAttributes(spec), [spec]);

  useFrame((state) => {
    const m = material.current;
    if (m) {
      m.uniforms.uTime.value = staticMode ? 0 : state.clock.elapsedTime;
      m.uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 2);
    }
  });

  return (
    <group ref={shellRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[attrs.positions, 3]} />
          <bufferAttribute attach="attributes-aColorTemp" args={[attrs.colors, 3]} />
          <bufferAttribute attach="attributes-aMagnitude" args={[attrs.magnitudes, 1]} />
          <bufferAttribute attach="attributes-aTwinklePhase" args={[attrs.phases, 1]} />
          <bufferAttribute attach="attributes-aTwinkleSpeed" args={[attrs.speeds, 1]} />
          <bufferAttribute attach="attributes-aSpike" args={[attrs.spikes, 1]} />
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
            uSize: { value: size * spec.baseSize },
            uOpacity: { value: opacity },
            uSpikeOn: { value: 1 },
          }}
        />
      </points>
    </group>
  );
}

export function StarfieldGL({
  stars = [],
  fieldCount = 900,
  opacity = 1,
  size = 1,
  staticMode = false,
}: StarfieldGLProps) {
  const nearRef = useRef<THREE.Group>(null);
  const midRef = useRef<THREE.Group>(null);
  const farRef = useRef<THREE.Group>(null);

  const counts = useMemo(() => shellCounts(fieldCount), [fieldCount]);
  // Stable spec identity so geometry is built once per count change.
  const specs = useMemo<ShellSpec[]>(
    () => [
      { key: "near", rMin: 8, rMax: 14, parallax: 0.42, baseSize: 1.0, count: counts.near },
      { key: "mid", rMin: 14, rMax: 24, parallax: 0.16, baseSize: 0.7, count: counts.mid },
      { key: "far", rMin: 24, rMax: 50, parallax: 0.05, baseSize: 0.42, count: counts.far },
    ],
    [counts],
  );

  // Explicit foreground stars (authored) live in their own un-parallaxed set.
  const fg = useMemo(() => {
    if (stars.length === 0) return null;
    const positions = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    const magnitudes = new Float32Array(stars.length);
    const phases = new Float32Array(stars.length);
    const speeds = new Float32Array(stars.length);
    const spikes = new Float32Array(stars.length);
    stars.forEach((s, i) => {
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
  }, [stars]);

  // Differential parallax: each shell shifts at a different rate with the
  // pointer (near most, far barely). Constellation foreground (SeriesScene)
  // drifts ~ (0.5, 0.35) with the pointer; shells move LESS, so near reads
  // closer than far — real layered depth.
  useFrame((state) => {
    const { pointer } = state;
    const set = staticMode
      ? () => {
          nearRef.current?.position.set(0, 0, 0);
          midRef.current?.position.set(0, 0, 0);
          farRef.current?.position.set(0, 0, 0);
        }
      : () => {
          nearRef.current?.position.set(pointer.x * 0.42, pointer.y * 0.3, 0);
          midRef.current?.position.set(pointer.x * 0.16, pointer.y * 0.11, 0);
          farRef.current?.position.set(pointer.x * 0.05, pointer.y * 0.035, 0);
        };
    set();
  });

  const shellEls = specs.map((spec) => {
    const ref =
      spec.key === "near" ? nearRef : spec.key === "mid" ? midRef : farRef;
    return (
      <DepthShell
        key={spec.key}
        spec={spec}
        size={size}
        opacity={opacity}
        staticMode={staticMode}
        shellRef={ref as React.RefObject<THREE.Group>}
      />
    );
  });

  const fgMaterial = useRef<THREE.ShaderMaterial>(null);
  useFrame((state) => {
    const m = fgMaterial.current;
    if (!m) return;
    m.uniforms.uTime.value = staticMode ? 0 : state.clock.elapsedTime;
    m.uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 2);
  });

  return (
    <>
      {shellEls}
      {fg ? (
        <points frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[fg.positions, 3]} />
            <bufferAttribute attach="attributes-aColorTemp" args={[fg.colors, 3]} />
            <bufferAttribute attach="attributes-aMagnitude" args={[fg.magnitudes, 1]} />
            <bufferAttribute attach="attributes-aTwinklePhase" args={[fg.phases, 1]} />
            <bufferAttribute attach="attributes-aTwinkleSpeed" args={[fg.speeds, 1]} />
            <bufferAttribute attach="attributes-aSpike" args={[fg.spikes, 1]} />
          </bufferGeometry>
          <rawShaderMaterial
            ref={fgMaterial}
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
              uSpikeOn: { value: 1 },
            }}
          />
        </points>
      ) : null}
    </>
  );
}
