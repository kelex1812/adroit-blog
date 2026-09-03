/**
 * nebula-gl.ts — procedural fbm/simplex nebula shader (ADR-306: full-advantage
 * Three.js, GPU-first). ZERO texture assets — the dust is computed on the GPU
 * from fbm noise, so it is infinite and genuinely shifts under the camera.
 *
 * A large inside-facing sphere renders the volumetric dust field (deep violet
 * + cool blue + faint warm amber toward completed regions) around the
 * constellation, giving the "inside the sky" immersion (volumetric dust +
 * depth). The Milky Way band of unresolved stars is handled by the Points
 * starfield (starfield-gl); this layer is the soft dust atmosphere.
 */
"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const NEBULA_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NEBULA_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv * 4.0;
  float n = fbm(p + uTime * 0.012);
  float n2 = fbm(p * 1.6 + 3.7);

  // Restrained deep-sky dust (v2 demo palette): near-black deep + cool blue +
  // faint violet. LOW base alpha so the wash reads as sparse interstellar dust,
  // never a flat blue gradient. (Warm amber was retired in the v2 retune — the
  // palette is blue/purple over near-black, per the approved demo.)
  vec3 deep  = vec3(0.015, 0.025, 0.07);
  vec3 blue  = vec3(0.09, 0.16, 0.32);
  vec3 violet = vec3(0.18, 0.12, 0.30);

  vec3 col = mix(deep, blue, n);
  col = mix(col, violet, smoothstep(0.5, 0.9, n2));

  float alpha = (0.10 + n * 0.45) * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export interface NebulaGLProps {
  /** Master opacity (0..1). */
  opacity?: number;
  /** Radius of the inside-facing dust sphere. */
  radius?: number;
  /** Disable drift (prefers-reduced-motion). */
  staticMode?: boolean;
}

export function NebulaGL({ opacity = 1, radius = 34, staticMode = false }: NebulaGLProps) {
  const material = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uTime.value = staticMode ? 0 : state.clock.elapsedTime;
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: opacity },
    }),
    [opacity],
  );

  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 32]} />
      <shaderMaterial
        ref={material}
        vertexShader={NEBULA_VERTEX}
        fragmentShader={NEBULA_FRAGMENT}
        uniforms={uniforms}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
