/**
 * dust-volume.tsx — dust as STRUCTURE, not a wash.
 *
 * The shipped `nebula-gl` is a noise shader on an inward-facing sphere: a flat
 * blue-violet tint over the whole frame, identical from every angle, with no
 * occlusion. This replaces it with a small number of large, near-black planes
 * lying in the Milky Way band, each carrying a domain-warped fbm mask with a
 * hard-ish edge — so the dust has filaments, holes and borders.
 *
 * Two things make it read as dust rather than as fog:
 *
 *   1. It SUBTRACTS light. The material is normal-blended and almost black, so
 *      compositing it over the additive star field darkens whatever was drawn
 *      before it. Because the field is split into shells with explicit draw
 *      order, a dust layer at renderOrder 8 occludes the far and mid
 *      populations while the near shell draws on top and burns through it.
 *   2. It has form. The mask is thresholded, so there are edges; the coverage
 *      is modulated by a large-scale envelope, so there are gaps; and every
 *      layer sits at a real position and orientation in the band, so orbiting
 *      changes what it hides.
 *
 * Plane borders are faded to zero so a layer never resolves as a rectangle.
 */
"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { seededUnit } from "../3d/star-model";
import { DEFAULT_BAND } from "./deep-field-model";
import type { BandParams } from "./deep-field-model";

const DUST_VERTEX_GLSL = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DUST_FRAGMENT_GLSL = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec3 uDark;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uThreshold;
uniform float uScale;
uniform float uSeed;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(11.3, 7.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv * uScale + uSeed;

  // Domain warp: displacing the sample point by another fbm is what turns
  // blobs into filaments and lanes.
  vec2 q = vec2(fbm(p), fbm(p + 5.2));
  float n = fbm(p * 1.6 + 3.0 * q);

  // Threshold for edges, then an independent large-scale envelope so the layer
  // is patchy instead of covering the whole plane.
  float mask = smoothstep(uThreshold, uThreshold + 0.16, n);
  float envelope = smoothstep(0.34, 0.72, fbm(p * 0.28 + 17.0));
  mask *= envelope;

  // Fade the plane borders to zero — otherwise the layer reads as a rectangle.
  float edge = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x)
             * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);

  float alpha = mask * edge * uOpacity;
  if (alpha < 0.004) discard;

  // Deep ink with a luminous warm-violet core — atmosphere lifts the void;
  // dust still subtracts light rather than washing the frame cyan.
  vec3 c = mix(uDark, uTint, smoothstep(0.35, 0.92, n));
  // A whisper of emissive edge on dense filaments (fantastic, not HUD).
  c += uTint * smoothstep(0.7, 0.98, n) * 0.35;
  gl_FragColor = vec4(c, alpha);
}
`;

interface DustLayerSpec {
  key: string;
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
  opacity: number;
  threshold: number;
  scale: number;
  seed: number;
  renderOrder: number;
}

/**
 * Deterministically place the layers inside the band plane.
 *
 * Layers are laid out in the band's own XZ plane (the parent group carries the
 * band tilt), at radii spanning the mid and far shells, with a per-layer tilt
 * jitter so no two present the same face. Far layers get renderOrder 2 (they
 * occlude the far shell only); near layers get 8 (they occlude far and mid,
 * and the near shell burns through them).
 */
function dustLayers(count: number, seed: string): DustLayerSpec[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const u = (n: string) => seededUnit(`${seed}:dust:${i}:${n}`);
    const angle = i * golden + u("a") * 0.8;
    const r = 16 + u("r") * 92;
    const y = (u("y") - 0.5) * 16;
    const span = 34 + r * 0.85;
    return {
      key: `dust-${i}`,
      position: [
        Number((Math.cos(angle) * r * 0.55).toFixed(3)),
        Number(y.toFixed(3)),
        Number((Math.sin(angle) * r * 0.55).toFixed(3)),
      ],
      // Lie in the band plane, then jitter by up to ~28 degrees.
      rotation: [
        -Math.PI / 2 + (u("rx") - 0.5) * 0.98,
        u("ry") * Math.PI * 2,
        (u("rz") - 0.5) * 0.98,
      ],
      width: Number(span.toFixed(2)),
      height: Number((span * (0.42 + u("h") * 0.5)).toFixed(2)),
      // Nearer layers are allowed to be denser; distant ones stay whispers.
      opacity: Number((0.2 + (1 - r / 110) * 0.36).toFixed(3)),
      threshold: Number((0.5 + u("t") * 0.14).toFixed(3)),
      scale: Number((2.1 + u("s") * 3.4).toFixed(2)),
      seed: Number((u("n") * 40).toFixed(3)),
      renderOrder: r > 45 ? 2 : 8,
    };
  });
}

function DustLayer({
  spec,
  density,
  dark,
  tint,
}: {
  spec: DustLayerSpec;
  density: number;
  dark: THREE.Color;
  tint: THREE.Color;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uDark: { value: dark.clone() },
      uTint: { value: tint.clone() },
      uOpacity: { value: spec.opacity },
      uThreshold: { value: spec.threshold },
      uScale: { value: spec.scale },
      uSeed: { value: spec.seed },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* Read `density` directly — both callers below run after render. */
  const pushOpacity = () => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uOpacity.value = spec.opacity * density;
  };

  useLayoutEffect(() => {
    pushOpacity();
  });

  useFrame(() => {
    pushOpacity();
  });

  return (
    <mesh
      position={spec.position}
      rotation={spec.rotation}
      renderOrder={spec.renderOrder}
      frustumCulled={false}
    >
      <planeGeometry args={[spec.width, spec.height, 1, 1]} />
      <shaderMaterial
        ref={material}
        vertexShader={DUST_VERTEX_GLSL}
        fragmentShader={DUST_FRAGMENT_GLSL}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}

export interface DustVolumeProps {
  /** Number of dust planes. Sparse on purpose — 6-8 is plenty. */
  layers?: number;
  /** Master density multiplier (0 = no dust). */
  density?: number;
  /** Band orientation — should match the field's. */
  band?: BandParams;
  /** Deterministic seed. */
  seed?: string;
  /** Field drift rate, so dust and stars turn together. */
  driftRate?: number;
  staticMode?: boolean;
}

export function DustVolume({
  layers = 7,
  density = 1,
  band = DEFAULT_BAND,
  seed = "hubble-field",
  driftRate = 0.0035,
  staticMode = false,
}: DustVolumeProps) {
  const group = useRef<THREE.Group>(null);
  const specs = useMemo(() => dustLayers(layers, seed), [layers, seed]);

  // Near-black with a deep violet / warm core — atmosphere carries the lift;
  // dust still subtracts rather than washing cyan.
  const dark = useMemo(() => new THREE.Color("#080814"), []);
  const tint = useMemo(() => new THREE.Color("#1c1430"), []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g || staticMode) return;
    g.rotation.y += driftRate * delta;
  });

  if (density <= 0) return null;

  return (
    <group ref={group}>
      <group rotation={[band.tiltX, 0, band.tiltZ]}>
        {specs.map((spec) => (
          <DustLayer
            key={spec.key}
            spec={spec}
            density={density}
            dark={dark}
            tint={tint}
          />
        ))}
      </group>
    </group>
  );
}

export default DustVolume;
