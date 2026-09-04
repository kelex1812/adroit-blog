/**
 * HubbleStarCompare — the star material study (ADR-310's evidence).
 *
 * Same stars, same positions, same spectral colors, two primitives:
 *
 *   LEFT   the shipped `IgnitedStar` — three stacked additive radial-gradient
 *          sprites. Under any bloom at all these resolve as out-of-focus lens
 *          balls, and because sprite scale is the only brightness channel, a
 *          magnitude spread of 0.1 to 4.6 turns into a size spread rather than
 *          a brightness spread.
 *   RIGHT  the new `FieldPoints` — one Points buffer on the spike shader. Hot
 *          sub-pixel cores, real Pogson brightness, diffraction crosses only
 *          on the members bright enough to earn them.
 *
 * The figure is Orion's bright members, so the comparison runs across a real
 * magnitude range instead of a synthetic one, and both columns sit in the same
 * deep field — the question is not "which looks nicer in isolation" but "which
 * one belongs in a Hubble frame".
 *
 * Column labels are DOM chrome above the canvas, never world-space HTML.
 */
"use client";

import { useMemo } from "react";
import type { Star3D } from "../3d/star-model";
import { SPECTRAL_ARC, STAR_PALETTE, magnitudeSizeFor, twinkleFor } from "../3d/star-model";
import { IgnitedStar } from "../3d/IgnitedStar";
import { DeepFieldGL, FieldPoints } from "./deep-field-gl";
import { DustVolume } from "./dust-volume";
import { buildFigureAttributes } from "./deep-field-model";
import type { FigureStar } from "./deep-field-model";
import { LabCanvas } from "./LabCanvas";
import { LAB_COURSES, labFigure } from "./field-fixtures";
import { SkyAtmosphere } from "./sky-atmosphere";
import { FigurePresence } from "./figure-presence";
import type { FieldParams } from "./FieldControls";

/** Horizontal offset of each column from the origin. */
const SPREAD = 3.2;
/** Figure scale — small enough that two columns fit a 16/9 frame. */
const FIGURE_SCALE = 0.5;
/** Sprite base size. Kept modest so the bokeh is honest, not a caricature. */
const SPRITE_BASE = 0.3;

/** Orion's bright members — a real magnitude range. */
export function compareFigure(): FigureStar[] {
  const orion = labFigure(LAB_COURSES[0]!, 1);
  return orion.stars.filter((s) => s.magnitude < 4.7).slice(0, 16);
}

/** Map a figure star onto the `Star3D` shape `IgnitedStar` consumes. */
function toStar3D(s: FigureStar, index: number): Star3D {
  const tw = twinkleFor(s.name);
  const color = s.isRedGiantAccent
    ? "#ff7a3d"
    : s.isNebula
      ? "#ffd9a8"
      : SPECTRAL_ARC[s.spectralClass].color;
  return {
    slug: `compare-${index}`,
    label: s.name,
    index: index + 1,
    state: "ignited",
    position: [
      -SPREAD + s.position[0] * FIGURE_SCALE,
      s.position[1] * FIGURE_SCALE,
      s.position[2] * FIGURE_SCALE,
    ],
    color,
    // The shipped magnitude → size mapping, so the sprite column is the
    // shipped look and not a strawman.
    size: magnitudeSizeFor(s.magnitude, SPRITE_BASE),
    bloom: STAR_PALETTE.ignited.bloom,
    twinkleDuration: tw.duration,
    twinklePhase: tw.phase,
    spectralClass: s.spectralClass,
    magnitude: s.magnitude,
  };
}

export interface HubbleStarCompareProps {
  params: FieldParams;
}

export function HubbleStarCompare({ params }: HubbleStarCompareProps) {
  const orion = useMemo(() => labFigure(LAB_COURSES[0]!, 1), []);
  const figure = useMemo(
    () => orion.stars.filter((s) => s.magnitude < 4.7).slice(0, 16),
    [orion],
  );
  const sprites = useMemo(() => figure.map(toStar3D), [figure]);
  const points = useMemo(
    () =>
      buildFigureAttributes(figure, {
        origin: [SPREAD, 0, 0],
        scale: FIGURE_SCALE,
        seed: "compare",
      }),
    [figure],
  );
  const compareConnections = useMemo(() => {
    // Re-map Orion connections onto the filtered bright-member subset by name.
    const indexByName = new Map(figure.map((s, i) => [s.name, i]));
    const out: Array<[number, number]> = [];
    for (const [a, b] of orion.connections) {
      const sa = orion.stars[a];
      const sb = orion.stars[b];
      if (!sa || !sb) continue;
      const ia = indexByName.get(sa.name);
      const ib = indexByName.get(sb.name);
      if (ia === undefined || ib === undefined) continue;
      out.push([ia, ib]);
    }
    return out;
  }, [figure, orion]);

  return (
    <div className="hf-stage" data-testid="hf-study-compare">
      <StarCompareLegend />
      <LabCanvas
        containerClassName="hf-canvas"
        camera={{ position: [0, 0, 12], fov: 48 }}
        bloom={{ intensity: 0.36, threshold: 0.86 }}
      >
        <SkyAtmosphere intensity={0.95} />
        <DeepFieldGL
          key={`cmp-${params.fieldCount}-${params.brightAnchors}`}
          fieldCount={Math.round(params.fieldCount * 0.5)}
          brightAnchors={Math.round(params.brightAnchors * 0.5)}
          spikeThreshold={params.spikeThreshold}
          exposure={params.exposure}
          rankIllumination={params.illumination}
          staticMode={params.staticMode}
          driftRate={0.0012}
        />
        <DustVolume
          layers={5}
          density={params.dustDensity * 0.7}
          staticMode={params.staticMode}
          driftRate={0.0012}
        />
        {sprites.map((star) => (
          <IgnitedStar key={star.slug} star={star} staticMode={params.staticMode} />
        ))}
        <FigurePresence
          stars={figure}
          connections={compareConnections}
          origin={[SPREAD, 0, 0]}
          scale={FIGURE_SCALE}
          focused
          enabled
          figureName="Orion"
        />
        <FieldPoints
          attrs={points}
          size={1.55}
          exposure={params.exposure * 1.15}
          illumination={params.illumination}
          spikeThreshold={params.spikeThreshold}
          spikeGain={1.35}
          fade={[6, 60]}
          renderOrder={20}
          staticMode={params.staticMode}
        />
      </LabCanvas>
    </div>
  );
}

/**
 * DOM column headers for the compare study. Lives outside the canvas so the
 * sky is never carrying HTML.
 */
export function StarCompareLegend() {
  return (
    <div className="hf-compare-legend" data-testid="hf-compare-legend">
      <div className="hf-compare-legend__col">
        <span className="hf-compare-legend__key">A · shipped</span>
        <span className="hf-compare-legend__title">IgnitedStar sprites</span>
        <span className="hf-compare-legend__note">
          Radial-gradient billboards. Bloom turns these into bokeh, and
          magnitude only changes their size.
        </span>
      </div>
      <div className="hf-compare-legend__col">
        <span className="hf-compare-legend__key">B · candidate</span>
        <span className="hf-compare-legend__title">Point-shader stars</span>
        <span className="hf-compare-legend__note">
          Hot sub-pixel cores, Pogson brightness, diffraction crosses only on
          the brightest members.
        </span>
      </div>
    </div>
  );
}

export default HubbleStarCompare;
