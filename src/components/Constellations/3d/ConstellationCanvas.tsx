/**
 * ConstellationCanvas — the r3f Canvas shell for the 3D scenes.
 *
 * Three is ~150-600KB, so it is ONLY loaded on surfaces that need it: the
 * Learn course page and /profile. The PUBLIC components (SeriesConstellation3D,
 * ProfileGalaxy3D) lazy-import this whole module via `next/dynamic(..., { ssr:
 * false })`, so blog pages never pull three. This component itself is browser
 * only (renders `<Canvas>`), gates on WebGL support, and falls back to the 2D
 * constellation when WebGL is unavailable.
 *
 * REV 2 (full-advantage): the background is the custom GLSL deep-sky field —
 * a single `Points` buffer starfield (StarfieldGL) + a procedural fbm nebula
 * (NebulaGL), NOT stock drei `<Stars>`. The full EffectComposer chain is
 * UnrealBloom (per-state) + chromatic aberration + vignette + restrained film
 * grain, composited on GPU in one pass.
 *
 * The shimmer (`<LoadingSky />`) is shown only until the renderer reports its
 * first frame via `onCreated` (state-driven, not a DOM query). A safety timer
 * also clears it so a stalled renderer can never permanently occlude the scene.
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";
import { LoadingSky } from "./LoadingSky";
import { supportsWebGL } from "./webgl";
import { StarfieldGL } from "./starfield-gl";
import { NebulaGL } from "./nebula-gl";
import { DustMotes } from "./dust-motes";
import { Meteors } from "./meteors";

export interface ConstellationCanvasProps {
  /** r3f scene content (star field, sectors, rays). */
  children: React.ReactNode;
  /** Shown while WebGL initializes. */
  label?: string;
  /** Fallback rendered when WebGL is unavailable (2D component). */
  fallback: React.ReactNode;
  /** Bloom params (mirror design tokens). */
  bloom?: { strength?: number; threshold?: number; radius?: number };
  /** Perf cap (design: cap DPR at 2). */
  dpr?: [number, number];
  /** G2: disable film grain + camera breathing for reduced motion. */
  prefersReducedMotion?: boolean;
}

export function ConstellationCanvas({
  children,
  label = "Charting your sky",
  fallback,
  bloom,
  dpr,
  prefersReducedMotion = false,
}: ConstellationCanvasProps) {
  const webgl = useMemo(() => supportsWebGL(), []);
  const [ready, setReady] = useState(false);

  // Safety: never let the shimmer occlude the scene if the renderer is slow
  // to report its first frame (e.g. heavy GPU init on first visit).
  useEffect(() => {
    if (!ready) {
      const t = window.setTimeout(() => setReady(true), 3500);
      return () => window.clearTimeout(t);
    }
  }, [ready]);

  if (!webgl) return <>{fallback}</>;

  return (
    <div className="cx3d-canvas" data-testid="cx3d-canvas">
      {!ready && <LoadingSky label={label} />}
      <Canvas
        dpr={dpr ?? [1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 9], fov: 45, near: 0.1, far: 80 }}
        onCreated={() => setReady(true)}
        // Lazy-mount fix: the scene mounts below the fold (or inside a lazy
        // wrapper), so R3F's container ResizeObserver misses the initial size
        // and the canvas stays at the 300x150 default. Observing scroll as well
        // re-measures once the section scrolls into view.
        resize={{ scroll: true }}
      >
        {/* The deep-sky field (v2 base): near-black sky + restrained blue/purple
            nebula + 3-shell parallax starfield + drifting dust + shooting stars. */}
        <color attach="background" args={["#02030a"]} />
        <NebulaGL opacity={0.9} staticMode={prefersReducedMotion} />
        <StarfieldGL fieldCount={900} staticMode={prefersReducedMotion} />
        {children}
        {/* Life layers: floating interstellar dust + occasional meteors. */}
        <DustMotes count={220} staticMode={prefersReducedMotion} />
        <Meteors staticMode={prefersReducedMotion} />
        <EffectComposer>
          <Bloom
            intensity={bloom?.strength ?? 0.7}
            luminanceThreshold={bloom?.threshold ?? 0.85}
            luminanceSmoothing={0.9}
            radius={bloom?.radius ?? 0.5}
            mipmapBlur
          />
          {/* NOTE: chromatic aberration was REMOVED in the v2 retune (AC-4).
              Bright stars get their sharp diffraction spike in the shader
              instead of scene-wide fringing. */}
          <Vignette eskil={false} offset={0.2} darkness={0.7} />
          {/* Restrained film grain, tied to state (off for reduced motion). */}
          {!prefersReducedMotion && <Noise premultiply opacity={0.05} />}
        </EffectComposer>
      </Canvas>
    </div>
  );
}
