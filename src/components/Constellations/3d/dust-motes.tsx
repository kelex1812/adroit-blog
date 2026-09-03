/**
 * dust-motes.tsx — floating interstellar dust motes (deep-sky v1.2.0, AC-3).
 *
 * A sparse `Points` field of faint blue-white motes that drift slowly and
 * organically through the scene. Drift + gentle twinkle are computed in the
 * vertex shader (GPU-side, no per-frame JS geometry churn), exactly like the
 * approved v2 demo. Positions are deterministically seeded (repo convention —
 * never Math.random at render) and scaled by size. Reduced motion freezes
 * uTime so the motes sit still.
 */
"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { seededUnit } from "./star-model";

const DUST_VERTEX_GLSL = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute float aPhase;
attribute float aSpeed;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uPixelRatio;

varying float vAlpha;

void main() {
  vec3 p = position;
  // Slow organic drift (v2 demo).
  p.x += sin(uTime * aSpeed + aPhase) * 0.6;
  p.y += cos(uTime * aSpeed * 0.8 + aPhase * 1.3) * 0.5;
  p.z += sin(uTime * aSpeed * 0.6 + aPhase * 0.7) * 0.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = 0.5 + 0.5 * sin(uTime * aSpeed * 2.0 + aPhase);
  vAlpha = tw;
  gl_PointSize = 2.0 * uPixelRatio * (300.0 / max(-mv.z, 0.1));
  gl_Position = projectionMatrix * mv;
}
`;

const DUST_FRAGMENT_GLSL = /* glsl */ `
precision highp float;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = exp(-d * d * 30.0) * vAlpha * 0.5;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.75, 0.82, 1.0, a);
}
`;

export interface DustMotesProps {
  /** Number of motes to scatter. */
  count?: number;
  /** Disable drift (prefers-reduced-motion). */
  staticMode?: boolean;
}

/** Scatter shell radius bounds (matches the demo's mid-field dust). */
const SHELL_MIN = 6;
const SHELL_MAX = 26;

export function DustMotes({
  count = 220,
  staticMode = false,
}: DustMotesProps) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const attrs = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Deterministic seeded scatter on a shell (repo convention).
      const r = SHELL_MIN + seededUnit(`dust:r:${i}`) * (SHELL_MAX - SHELL_MIN);
      const th = seededUnit(`dust:th:${i}`) * Math.PI * 2;
      const ph = Math.acos(2 * seededUnit(`dust:ph:${i}`) - 1);
      positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      positions[i * 3 + 2] = r * Math.cos(ph);
      phases[i] = seededUnit(`dust:phase:${i}`) * Math.PI * 2;
      speeds[i] = 0.1 + seededUnit(`dust:speed:${i}`) * 0.3;
    }
    return { positions, phases, speeds };
  }, [count]);

  useFrame((state) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uTime.value = staticMode ? 0 : state.clock.elapsedTime;
    m.uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 2);
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attrs.positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[attrs.phases, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[attrs.speeds, 1]} />
      </bufferGeometry>
      <rawShaderMaterial
        ref={material}
        vertexShader={DUST_VERTEX_GLSL}
        fragmentShader={DUST_FRAGMENT_GLSL}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
        }}
      />
    </points>
  );
}
