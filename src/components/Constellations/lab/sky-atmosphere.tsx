/**
 * sky-atmosphere.tsx — lifts the void without becoming a blue wash.
 *
 * The north star forbids a flat nebula dome. This is a large inward sphere with:
 *   - a deep ink → indigo horizon gradient (never cyan)
 *   - a soft Milky Way luminosity band (additive structure, not tint)
 *   - a handful of distant galaxy smudges (elongated ellipses)
 *
 * It reads as "there is air and dust between you and infinity" — fantastic
 * enough to feel wondrous, photographic enough to pass the Hubble gate.
 */
"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { DEFAULT_BAND } from "./deep-field-model";
import type { BandParams } from "./deep-field-model";

const ATMOS_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDir = normalize(position);
  gl_Position = projectionMatrix * mv;
}
`;

const ATMOS_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vDir;

uniform vec3 uDeep;
uniform vec3 uLift;
uniform vec3 uBand;
uniform vec3 uWarm;
uniform float uBandTiltX;
uniform float uBandTiltZ;
uniform float uIntensity;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i);
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.11 + vec3(3.1, 5.7, 1.9);
    a *= 0.5;
  }
  return v;
}

// Rotate dir into band frame (small tilts only).
vec3 bandFrame(vec3 d) {
  float cx = cos(uBandTiltX); float sx = sin(uBandTiltX);
  float cz = cos(uBandTiltZ); float sz = sin(uBandTiltZ);
  vec3 p = d;
  p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  p = vec3(cz * p.x - sz * p.y, sz * p.x + cz * p.y, p.z);
  return p;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 b = bandFrame(d);

  // Soft lift away from pure black — zenith slightly cooler, limbs warmer.
  float zenith = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 base = mix(uLift, uDeep, zenith);
  base = mix(base, uWarm, 0.12 * (1.0 - zenith));

  // Milky Way band: luminosity ribbon with filament noise (additive later).
  float lat = abs(b.y);
  float band = exp(-pow(lat * 3.4, 2.0));
  float filaments = fbm(b * 3.2 + 2.0);
  band *= mix(0.55, 1.15, filaments);

  // Distant galaxy smudges — sparse elongated kernels.
  float galaxies = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec3 center = normalize(vec3(
      sin(fi * 2.7 + 0.4),
      cos(fi * 1.3) * 0.35,
      cos(fi * 2.1 + 1.1)
    ));
    vec3 q = d - center;
    // Stretch one axis for elliptical look.
    q = vec3(q.x * 2.8, q.y * 0.9, q.z * 1.4);
    float g = exp(-dot(q, q) * (90.0 + fi * 8.0));
    galaxies += g * (0.35 + 0.08 * fi);
  }

  vec3 col = base;
  col += uBand * band * 0.55 * uIntensity;
  col += mix(uBand, uWarm, 0.35) * galaxies * 0.4 * uIntensity;

  // Very soft vignette so the dome never reads as a painted wall.
  float rim = pow(1.0 - abs(d.y), 1.6);
  col += uWarm * rim * 0.04 * uIntensity;

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface SkyAtmosphereProps {
  /** 0..2 master lift. */
  intensity?: number;
  band?: BandParams;
  radius?: number;
}

export function SkyAtmosphere({
  intensity = 1,
  band = DEFAULT_BAND,
  radius = 220,
}: SkyAtmosphereProps) {
  const uniforms = useMemo(
    () => ({
      uDeep: { value: new THREE.Color("#070b16") },
      uLift: { value: new THREE.Color("#12182a") },
      uBand: { value: new THREE.Color("#3a4a6e") },
      uWarm: { value: new THREE.Color("#2a2238") },
      uBandTiltX: { value: band.tiltX },
      uBandTiltZ: { value: band.tiltZ },
      uIntensity: { value: intensity },
    }),
    [band.tiltX, band.tiltZ, intensity],
  );

  return (
    <mesh scale={[-1, 1, 1]} frustumCulled={false} renderOrder={-20}>
      <sphereGeometry args={[radius, 48, 32]} />
      <shaderMaterial
        vertexShader={ATMOS_VERTEX}
        fragmentShader={ATMOS_FRAGMENT}
        uniforms={uniforms}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

export default SkyAtmosphere;
