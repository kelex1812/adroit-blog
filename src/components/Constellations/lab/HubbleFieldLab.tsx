/**
 * HubbleFieldLab — shell for the four Hubble Field studies.
 * Study tabs + FieldControls sit beside the canvas; never over the sky.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import {
  DEFAULT_FIELD_PARAMS,
  FieldControls,
  type FieldParams,
} from "./FieldControls";
import { HubbleStarCompare } from "./HubbleStarCompare";
import { AtlasStudy } from "./AtlasStudy";
import { ChartAtlasStudy } from "./chart-atlas";
import { DeepFieldGL, FieldPoints } from "./deep-field-gl";
import { DustVolume } from "./dust-volume";
import { LabCanvas } from "./LabCanvas";
import { SkyAtmosphere } from "./sky-atmosphere";
import { FigurePresence } from "./figure-presence";
import { WarpRig, type WarpMode } from "./WarpRig";
import { buildFigureAttributes } from "./deep-field-model";
import { LAB_COURSES, labFigure } from "./field-fixtures";
import "./lab.css";

type LabStudy = "chart" | "star" | "deep-field" | "atlas" | "warp";

const STUDIES: { id: LabStudy; label: string }[] = [
  { id: "chart", label: "Star chart" },
  { id: "star", label: "Star material" },
  { id: "deep-field", label: "Deep field" },
  { id: "atlas", label: "Volume atlas" },
  { id: "warp", label: "Warp" },
];

function DeepFieldStudy({ params }: { params: FieldParams }) {
  return (
    <div className="hf-lab-stage" data-testid="hf-deep-field">
      <LabCanvas
        containerClassName="hf-canvas hf-canvas--fill"
        camera={{ position: [0, 0.8, 18], fov: 50, near: 0.1, far: 400 }}
        bloom={{ intensity: 0.36, threshold: 0.86 }}
      >
        <SkyAtmosphere intensity={1.05} />
        <DeepFieldGL
          key={`df-${params.fieldCount}-${params.brightAnchors}`}
          fieldCount={params.fieldCount}
          brightAnchors={params.brightAnchors}
          spikeThreshold={params.spikeThreshold}
          exposure={params.exposure}
          rankIllumination={params.illumination}
          staticMode={params.staticMode}
        />
        <DustVolume density={params.dustDensity} staticMode={params.staticMode} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={6}
          maxDistance={80}
        />
      </LabCanvas>
    </div>
  );
}

function WarpStudy({
  params,
  mode,
  onModeSettled,
}: {
  params: FieldParams;
  mode: WarpMode;
  onModeSettled: (m: "framed" | "observatory") => void;
}) {
  const figure = useMemo(() => labFigure(LAB_COURSES[0]!, 1), []);
  const attrs = useMemo(
    () =>
      buildFigureAttributes(figure.stars, {
        origin: [0, 0, 0],
        scale: 1.1,
        seed: "warp-orion",
      }),
    [figure],
  );
  const isObs = mode === "observatory" || mode === "warping-in";

  return (
    <div
      className={`hf-lab-warp-shell${isObs ? " is-observatory" : " is-framed"}`}
      data-testid="hf-warp"
    >
      <div className="hf-lab-warp-frame">
        <LabCanvas
          containerClassName="hf-canvas hf-canvas--fill"
          camera={{ position: [0, 0.4, 11], fov: 42, near: 0.1, far: 400 }}
          bloom={{ intensity: 0.4, threshold: 0.84 }}
        >
          <SkyAtmosphere intensity={1.1} />
          <DeepFieldGL
            key={`warp-${params.fieldCount}-${params.brightAnchors}`}
            fieldCount={Math.min(params.fieldCount, 24000)}
            brightAnchors={params.brightAnchors}
            spikeThreshold={params.spikeThreshold}
            exposure={params.exposure}
            rankIllumination={params.illumination}
            staticMode={params.staticMode}
          />
          <DustVolume
            density={params.dustDensity * 0.7}
            staticMode={params.staticMode}
          />
          <FigurePresence
            stars={figure.stars}
            connections={figure.connections}
            origin={[0, 0, 0]}
            scale={1.1}
            focused
            enabled={params.figureLines}
            figureName={figure.figureName}
          />
          <FieldPoints
            attrs={attrs}
            size={1.55}
            exposure={params.exposure * 1.1}
            illumination={params.illumination}
            spikeThreshold={params.spikeThreshold}
            spikeGain={1.4}
            fade={[4, 80]}
            renderOrder={20}
            staticMode={params.staticMode}
          />
          <WarpRig
            mode={mode}
            onSettled={onModeSettled}
            prefersReducedMotion={params.staticMode}
          />
        </LabCanvas>
        {isObs ? (
          <div className="hf-lab-telescope">
            <span>
              {figure.figureName} · {figure.litStars}/{figure.totalStars}
            </span>
            <span className="hf-lab-telescope-hint">Esc · warp out</span>
          </div>
        ) : (
          <p className="hf-lab-frame-caption">
            Profile-sized window · warp in to enter
          </p>
        )}
      </div>
    </div>
  );
}

export function HubbleFieldLab() {
  const [study, setStudy] = useState<LabStudy>("chart");
  /*
   * OS reduced-motion is a floor, applied at initialisation rather than in an
   * effect so the first paint is already still. The lab route is `ssr: false`,
   * so `window` is available here. The Static toggle can still freeze things.
   */
  const [params, setParams] = useState<FieldParams>(() => ({
    ...DEFAULT_FIELD_PARAMS,
    staticMode:
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  const [warpMode, setWarpMode] = useState<WarpMode>("framed");
  const [atlasFocus, setAtlasFocus] = useState<string | null>("salesforce-architect");

  const onWarpToggle = useCallback(() => {
    setWarpMode((m) => {
      if (m === "framed") return "warping-in";
      if (m === "observatory") return "warping-out";
      return m;
    });
  }, []);

  const onModeSettled = useCallback((m: "framed" | "observatory") => {
    setWarpMode(m);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (warpMode === "observatory" || warpMode === "warping-in")
      ) {
        setWarpMode("warping-out");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [warpMode]);

  const focusName =
    study === "atlas" || study === "chart"
      ? LAB_COURSES.find((c) => c.seriesSlug === atlasFocus)?.name ?? null
      : null;

  return (
    <div className="hf-lab" data-testid="hubble-field-lab">
      <div className="hf-lab-sidebar">
        <p className="hf-lab-eyebrow">Hubble Field · observatory lab</p>
        <h2 className="hf-lab-controls-title">Studies</h2>
        <div className="hf-lab-tabs" role="tablist">
          {STUDIES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={study === s.id}
              className={`hf-lab-tab${study === s.id ? " is-active" : ""}`}
              onClick={() => setStudy(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {study === "warp" ? (
          <div className="hf-lab-warp-actions">
            <button
              type="button"
              className="hf-lab-primary"
              onClick={onWarpToggle}
            >
              {warpMode === "framed" || warpMode === "warping-out"
                ? "Warp in"
                : "Warp out"}
            </button>
            <p className="hf-lab-hint">Esc also warps out from observatory.</p>
          </div>
        ) : null}

        <FieldControls
          params={params}
          onChange={setParams}
          study={study}
          focusName={focusName}
          onClearFocus={() => setAtlasFocus(null)}
        />
      </div>

      <main className="hf-lab-main">
        {study === "chart" ? (
          <ChartAtlasStudy
            focusSlug={atlasFocus}
            onFocusChange={setAtlasFocus}
          />
        ) : null}
        {study === "star" ? <HubbleStarCompare params={params} /> : null}
        {study === "deep-field" ? <DeepFieldStudy params={params} /> : null}
        {study === "atlas" ? (
          <AtlasStudy
            params={params}
            focusSlug={atlasFocus}
            onFocusChange={setAtlasFocus}
          />
        ) : null}
        {study === "warp" ? (
          <WarpStudy
            params={params}
            mode={warpMode}
            onModeSettled={onModeSettled}
          />
        ) : null}
      </main>
    </div>
  );
}

export default HubbleFieldLab;
