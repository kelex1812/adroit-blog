/**
 * LabCanvas — a clean r3f Canvas for the Hubble Field lab.
 *
 * Deliberately NOT `ConstellationCanvas`. That component hardcodes the shipped
 * scene furniture — `NebulaGL`'s blue wash sphere, `DustMotes`, `Meteors`, a
 * 900-star field and a bloom chain tuned to make sprite stars glow. Reusing it
 * would import every failure the lab exists to disprove, and no amount of prop
 * plumbing removes a hardcoded child.
 *
 * What is left is the minimum: a near-black background, restrained bloom well
 * below production strength (brightness now comes from the field's magnitude
 * distribution, not the post chain — ADR-310), and a vignette. No film grain,
 * no chromatic aberration, no scene-wide tint.
 *
 * The Canvas element is intentionally stable across layout changes: callers
 * pass `containerClassName` and toggle CSS, so warping in and out never tears
 * down the WebGL context (ADR-309).
 */
"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { supportsWebGL } from "../3d/webgl";

export interface LabCanvasProps {
  children: React.ReactNode;
  /** Class on the canvas host element — the warp transition drives this. */
  containerClassName?: string;
  /** Camera start. Framed studies sit closer; the atlas pulls back. */
  camera?: { position: [number, number, number]; fov?: number; near?: number; far?: number };
  dpr?: [number, number];
  /** Restrained by default. Raising this past ~0.5 is a bloom-tutorial smell. */
  bloom?: { intensity?: number; threshold?: number; radius?: number };
  vignette?: { offset?: number; darkness?: number };
  /** Background — near-black, never a tinted sphere. */
  background?: string;
  onCreated?: () => void;
}

export function LabCanvas({
  children,
  containerClassName = "hf-canvas",
  camera,
  dpr = [1, 2],
  bloom,
  vignette,
  background = "#0a0e1a",
  onCreated,
}: LabCanvasProps) {
  const webgl = useMemo(() => supportsWebGL(), []);

  if (!webgl) {
    return (
      <div className={containerClassName}>
        <p className="hf-nowebgl">
          WebGL unavailable — the lab has no 2D fallback by design. Review the
          field on a GPU-capable browser.
        </p>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <Canvas
        dpr={dpr}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{
          position: camera?.position ?? [0, 0, 14],
          fov: camera?.fov ?? 48,
          near: camera?.near ?? 0.1,
          far: camera?.far ?? 400,
        }}
        onCreated={() => onCreated?.()}
        // The studies mount below the fold and inside a lazy wrapper, so the
        // container ResizeObserver can miss the first measurement.
        resize={{ scroll: true }}
      >
        <color attach="background" args={[background]} />
        {children}
        <EffectComposer>
          <Bloom
            intensity={bloom?.intensity ?? 0.38}
            luminanceThreshold={bloom?.threshold ?? 0.88}
            luminanceSmoothing={0.82}
            radius={bloom?.radius ?? 0.48}
            mipmapBlur
          />
          <Vignette
            eskil={false}
            offset={vignette?.offset ?? 0.22}
            darkness={vignette?.darkness ?? 0.72}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

export default LabCanvas;
