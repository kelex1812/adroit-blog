/**
 * deep-field-gl.tsx — the candidate field (ADR-310).
 *
 * Three `Points` buffers (far / mid / near), tens of thousands of stars, all
 * drawn by the one spike shader. Everything that makes the field look like a
 * photograph is decided in `deep-field-model.ts`; this module is only the
 * upload + uniform plumbing, which is why the same `FieldPoints` primitive can
 * draw the background field, a course asterism, and the star-material
 * comparison without any of them diverging visually.
 *
 * The shells exist for two reasons beyond parallax: they let `dust-volume`
 * render BETWEEN populations (a dust layer at renderOrder 8 darkens the far
 * shell and leaves the near shell burning in front of it, which is real
 * occlusion rather than a tint), and they let each depth carry its own
 * magnitude window so the near foreground can hold the bright spiked anchors.
 */
"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  SPIKE_STAR_FRAGMENT_GLSL,
  SPIKE_STAR_VERTEX_GLSL,
} from "./spike-material.glsl";
import {
  DEFAULT_BAND,
  buildShellAttributes,
  shellSpecs,
} from "./deep-field-model";
import type { BandParams, FieldAttributes } from "./deep-field-model";

/* ------------------------------------------------------------------ */
/*  FieldPoints — one Points buffer on the spike shader                */
/* ------------------------------------------------------------------ */

export interface FieldPointsProps {
  attrs: FieldAttributes;
  /** Base point-size multiplier. */
  size?: number;
  /** Master alpha. */
  opacity?: number;
  /** Exposure — scales luminance before the core/spike mix. */
  exposure?: number;
  /** Rank illumination (0..1). Lowers the visibility floor as it rises. */
  illumination?: number;
  /** Spike weight a star must clear to throw a diffraction cross. */
  spikeThreshold?: number;
  spikeGain?: number;
  /** Camera-distance fade window. */
  fade?: [number, number];
  renderOrder?: number;
  /** Freeze the shader clock (reduced motion / screenshot review). */
  staticMode?: boolean;
}

/**
 * Uniforms are created once and mutated via refs — never re-created from a
 * render-time object literal. Live slider values are pushed through refs so
 * R3F re-applying the memoized `uniforms` prop cannot stale-lock the shader
 * (that was why exposure / rank / spikes felt dead outside Deep Field rebuilds).
 */
export function FieldPoints({
  attrs,
  size = 1,
  opacity = 1,
  exposure = 1,
  illumination = 1,
  spikeThreshold = 0.42,
  spikeGain = 1,
  fade = [10, 150],
  renderOrder = 0,
  staticMode = false,
}: FieldPointsProps) {
  const material = useRef<THREE.RawShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: 1 },
      uOpacity: { value: 1 },
      uExposure: { value: 1 },
      uIllumination: { value: 1 },
      uSpikeThreshold: { value: 0.42 },
      uSpikeGain: { value: 1 },
      uFade: { value: new THREE.Vector2(10, 150) },
    }),
    [],
  );

  /*
   * Props are read directly rather than mirrored into a ref: both callers
   * below run after render (useLayoutEffect, and useFrame — which r3f
   * re-points at the newest callback every render), so each already closes
   * over current values.
   */
  const pushUniforms = (time: number, pixelRatio: number) => {
    const m = material.current;
    if (!m) return;
    const u = m.uniforms;
    u.uTime.value = staticMode ? 0 : time;
    u.uPixelRatio.value = Math.min(pixelRatio, 2);
    u.uSize.value = size;
    u.uOpacity.value = opacity;
    u.uExposure.value = exposure;
    u.uIllumination.value = illumination;
    u.uSpikeThreshold.value = spikeThreshold;
    u.uSpikeGain.value = spikeGain;
    (u.uFade.value as THREE.Vector2).set(fade[0], fade[1]);
  };

  useLayoutEffect(() => {
    pushUniforms(0, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  });

  useFrame((state) => {
    pushUniforms(state.clock.elapsedTime, state.gl.getPixelRatio());
  });

  if (attrs.count === 0) return null;

  return (
    <points frustumCulled={false} renderOrder={renderOrder}>
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
        vertexShader={SPIKE_STAR_VERTEX_GLSL}
        fragmentShader={SPIKE_STAR_FRAGMENT_GLSL}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  DeepFieldGL — the field                                            */
/* ------------------------------------------------------------------ */

export interface DeepFieldGLProps {
  /** Total star budget across the three shells. */
  fieldCount?: number;
  /** Spike gate (0..1). Higher = fewer stars throw a diffraction cross. */
  spikeThreshold?: number;
  /** Exposure — the field's overall brightness. */
  exposure?: number;
  /** Master alpha. */
  opacity?: number;
  /** Rank illumination (0..1): scales brightness AND the visibility floor. */
  rankIllumination?: number;
  /** Authored bright foreground stars (the ones that earn spikes). */
  brightAnchors?: number;
  /** Milky Way band shape. */
  band?: BandParams;
  /** Base point size for the whole field. */
  size?: number;
  /** Deterministic seed — same seed, same sky. */
  seed?: string;
  /** Freeze twinkle + field drift. */
  staticMode?: boolean;
  /**
   * Very slow field rotation (rad/s). The default is barely perceptible; it
   * exists so a still frame and a live frame are the same image, but a viewer
   * who watches for ten seconds sees the sky move.
   */
  driftRate?: number;
}

export function DeepFieldGL({
  fieldCount = 30000,
  spikeThreshold = 0.42,
  exposure = 1,
  opacity = 1,
  rankIllumination = 1,
  brightAnchors = 18,
  band = DEFAULT_BAND,
  size = 1,
  seed = "hubble-field",
  staticMode = false,
  driftRate = 0.0035,
}: DeepFieldGLProps) {
  const group = useRef<THREE.Group>(null);

  const shells = useMemo(() => {
    const specs = shellSpecs(fieldCount, brightAnchors);
    return specs.map((spec) => ({ spec, attrs: buildShellAttributes(spec, band, seed) }));
  }, [fieldCount, brightAnchors, band, seed]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g || staticMode) return;
    g.rotation.y += driftRate * delta;
  });

  // Rank illumination is a brightness multiplier as well as a visibility
  // floor, so a low-rank sky is both emptier and dimmer (ADR-312) — but the
  // multiplier keeps a floor, because zero would be a dead frame.
  const illumExposure = exposure * (0.45 + 0.55 * Math.min(Math.max(rankIllumination, 0), 1));

  return (
    <group ref={group}>
      {shells.map(({ spec, attrs }) => (
        <FieldPoints
          key={`${spec.key}:${attrs.count}:${seed}`}
          attrs={attrs}
          size={size * spec.baseSize}
          opacity={opacity}
          exposure={illumExposure}
          illumination={rankIllumination}
          spikeThreshold={spikeThreshold}
          fade={spec.fade}
          renderOrder={spec.renderOrder}
          staticMode={staticMode}
        />
      ))}
    </group>
  );
}

export default DeepFieldGL;
