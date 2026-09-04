/**
 * AtlasStudy — orbitable course constellations (lab).
 */
"use client";

import { useMemo } from "react";
import { OrbitControls } from "@react-three/drei";
import { LabCanvas } from "./LabCanvas";
import { DeepFieldGL, FieldPoints } from "./deep-field-gl";
import { DustVolume } from "./dust-volume";
import { SkyAtmosphere } from "./sky-atmosphere";
import { FigurePresence } from "./figure-presence";
import { buildFigureAttributes } from "./deep-field-model";
import {
  LAB_COURSES,
  atlasSectorPositions,
  labFigures,
  type LabFigure,
} from "./field-fixtures";
import type { FieldParams } from "./FieldControls";

function SectorNode({
  figure,
  origin,
  focused,
  params,
  onSelect,
}: {
  figure: LabFigure;
  origin: [number, number, number];
  focused: boolean;
  params: FieldParams;
  onSelect: (slug: string) => void;
}) {
  const scale = focused ? 1.2 : 0.52;
  const attrs = useMemo(
    () =>
      buildFigureAttributes(figure.stars, {
        origin,
        scale,
        seed: figure.seriesSlug,
      }),
    [figure, origin, scale],
  );

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect(figure.seriesSlug);
      }}
    >
      <FigurePresence
        stars={figure.stars}
        connections={figure.connections}
        origin={origin}
        scale={scale}
        focused={focused}
        enabled={params.figureLines || focused}
        figureName={focused ? figure.figureName : undefined}
      />
      <FieldPoints
        attrs={attrs}
        size={focused ? 1.55 : 0.9}
        exposure={params.exposure * (focused ? 1.15 : 0.5)}
        illumination={params.illumination}
        spikeThreshold={params.spikeThreshold}
        spikeGain={focused ? 1.45 : 1}
        fade={focused ? [4, 80] : [8, 100]}
        renderOrder={focused ? 20 : 10}
        staticMode={params.staticMode}
      />
    </group>
  );
}

export function AtlasStudy({
  params,
  focusSlug,
  onFocusChange,
}: {
  params: FieldParams;
  focusSlug: string | null;
  onFocusChange: (slug: string | null) => void;
}) {
  const figures = useMemo(() => labFigures(1), []);
  const positions = useMemo(
    () => atlasSectorPositions(LAB_COURSES.map((c) => c.seriesSlug)),
    [],
  );
  const focused = figures.find((f) => f.seriesSlug === focusSlug) ?? null;

  return (
    <div className="hf-lab-stage" data-testid="hf-atlas">
      <LabCanvas
        containerClassName="hf-canvas hf-canvas--fill"
        camera={{ position: [0, 8, 38], fov: 48, near: 0.1, far: 400 }}
        bloom={{ intensity: 0.4, threshold: 0.84 }}
      >
        <SkyAtmosphere intensity={1.05} />
        <DeepFieldGL
          key={`atlas-${params.fieldCount}-${params.brightAnchors}`}
          fieldCount={Math.min(params.fieldCount, 22000)}
          brightAnchors={params.brightAnchors}
          spikeThreshold={params.spikeThreshold}
          exposure={params.exposure * 0.95}
          rankIllumination={params.illumination}
          staticMode={params.staticMode}
        />
        <DustVolume density={params.dustDensity * 0.6} staticMode={params.staticMode} />
        {figures.map((fig) => {
          const origin = positions[fig.seriesSlug] ?? ([0, 0, 0] as [number, number, number]);
          return (
            <SectorNode
              key={fig.seriesSlug}
              figure={fig}
              origin={origin}
              focused={fig.seriesSlug === focusSlug}
              params={params}
              onSelect={(slug) => onFocusChange(slug)}
            />
          );
        })}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          minDistance={12}
          maxDistance={90}
          maxPolarAngle={Math.PI * 0.85}
        />
      </LabCanvas>
      {focused ? (
        <div className="hf-lab-inspect" data-testid="hf-atlas-inspect">
          <p className="hf-lab-inspect-kicker">{focused.figureName}</p>
          <h3 className="hf-lab-inspect-title">{focused.name}</h3>
          <p className="hf-lab-inspect-meta">
            {focused.litStars} / {focused.totalStars} lit
            {focused.complete ? " · complete" : ""}
          </p>
          <p className="hf-lab-inspect-hint">
            Click a sector to focus. The luminous ghost is the figure itself —
            not a pasted illustration. Orbit to look around.
          </p>
        </div>
      ) : null}
    </div>
  );
}
