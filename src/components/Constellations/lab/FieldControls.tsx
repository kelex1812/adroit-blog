/**
 * FieldControls — the lab's live parameter panel.
 *
 * Sits BESIDE the canvas, never over it. The whole point of the lab is that
 * the frame under review is the frame that ships, and a slider painted across
 * the sky reproduces the "dashboard over sky" failure at review time.
 *
 * Values are shown numerically and the whole set is copyable as JSON, so a
 * tuned look can be pasted into a Phase 2 port instead of re-derived by eye.
 *
 * Knobs are study-aware: every study shares the same FieldParams, but some
 * controls only read clearly on certain studies (e.g. figure lines → atlas).
 * Inactive knobs stay visible but muted so the shared param set remains one
 * JSON blob for Phase 2.
 */
"use client";

import { useCallback, useState } from "react";

/** Every knob the studies read. */
export interface FieldParams {
  /** Total star budget across the field's three shells. */
  fieldCount: number;
  /** Spike weight a star must clear to throw a diffraction cross (0..1). */
  spikeThreshold: number;
  /** Field exposure. */
  exposure: number;
  /** Rank illumination (0..1) — the ADR-312 uniform. */
  illumination: number;
  /** Dust master density. */
  dustDensity: number;
  /** Authored bright foreground stars (the ones that earn spikes). */
  brightAnchors: number;
  /** Faint additive asterism figure lines (atlas study). */
  figureLines: boolean;
  /** Freeze twinkle + drift — the screenshot-review setting. */
  staticMode: boolean;
}

export const DEFAULT_FIELD_PARAMS: FieldParams = {
  fieldCount: 30000,
  spikeThreshold: 0.42,
  exposure: 1.2,
  illumination: 0.7,
  dustDensity: 0.85,
  brightAnchors: 22,
  figureLines: true,
  staticMode: false,
};

export type LabStudyId = "chart" | "star" | "deep-field" | "atlas" | "warp";

/** Rank ladder illumination values, for reviewing all five bands (ADR-312). */
const RANK_PRESETS: ReadonlyArray<readonly [string, number]> = [
  ["Starseed", 0.15],
  ["Wayfarer", 0.35],
  ["Explorer", 0.7],
  ["Polestar", 0.88],
  ["Celestial", 1.0],
];

const STUDY_BLURBS: Record<LabStudyId, string> = {
  chart:
    "2D celestial chart (no WebGL). Click figures. Sliders don't drive this study.",
  star: "Watch column B (point shader). Column A is the shipped sprites — knobs mostly ignore it on purpose.",
  "deep-field": "Photographic flythrough reference — keep for contrast, not the product default.",
  atlas: "Older volumetric atlas. Prefer Star chart unless you want deep orbiting.",
  warp: "Warp in/out from a framed window. Can later host the chart plate.",
};

type KnobId =
  | "fieldCount"
  | "spikeThreshold"
  | "brightAnchors"
  | "exposure"
  | "illumination"
  | "dustDensity"
  | "staticMode"
  | "figureLines";

/** Which knobs are primary for the active study (others stay muted). */
const STUDY_PRIMARY: Record<LabStudyId, ReadonlySet<KnobId>> = {
  chart: new Set([]),
  star: new Set(["spikeThreshold", "exposure", "illumination", "staticMode"]),
  "deep-field": new Set([
    "fieldCount",
    "spikeThreshold",
    "brightAnchors",
    "exposure",
    "illumination",
    "dustDensity",
    "staticMode",
  ]),
  atlas: new Set([
    "spikeThreshold",
    "exposure",
    "illumination",
    "dustDensity",
    "figureLines",
    "staticMode",
  ]),
  warp: new Set([
    "fieldCount",
    "spikeThreshold",
    "exposure",
    "illumination",
    "dustDensity",
    "staticMode",
  ]),
};

interface SliderProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  muted?: boolean;
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
  muted,
}: SliderProps) {
  return (
    <label className={`hf-control${muted ? " is-muted" : ""}`}>
      <span className="hf-control__head">
        <span className="hf-control__label">{label}</span>
        <output className="hf-control__value">
          {format ? format(value) : value.toFixed(2)}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <span className="hf-control__hint">{hint}</span> : null}
    </label>
  );
}

export interface FieldControlsProps {
  params: FieldParams;
  onChange: (next: FieldParams) => void;
  /** Active study — drives which knobs read as primary. */
  study?: LabStudyId;
  /** Name of the focused atlas sector, when one is focused. */
  focusName?: string | null;
  onClearFocus?: () => void;
  /** Extra per-study readouts (e.g. spiked-star count). */
  readouts?: ReadonlyArray<readonly [string, string]>;
}

export function FieldControls({
  params,
  onChange,
  study = "chart",
  focusName,
  onClearFocus,
  readouts = [],
}: FieldControlsProps) {
  const [copied, setCopied] = useState(false);
  const primary = STUDY_PRIMARY[study];

  const set = useCallback(
    <K extends keyof FieldParams>(key: K, value: FieldParams[K]) => {
      onChange({ ...params, [key]: value });
    },
    [onChange, params],
  );

  const copy = useCallback(() => {
    void navigator.clipboard
      ?.writeText(JSON.stringify(params, null, 2))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setCopied(false));
  }, [params]);

  const isPrimary = (id: KnobId) => primary.has(id);

  return (
    <aside className="hf-panel" data-testid="hf-controls">
      <h2 className="hf-panel__title">Field parameters</h2>
      <p className="hf-panel__study-blurb" data-testid="hf-controls-blurb">
        {STUDY_BLURBS[study]}
      </p>

      <Slider
        label="Star count"
        hint={
          study === "deep-field"
            ? "Split 64 / 27 / 9 across the far, mid and near shells."
            : "Loudest on Deep field. Other studies cap the budget so the hero stays readable."
        }
        value={params.fieldCount}
        min={5000}
        max={60000}
        step={2500}
        format={(v) => `${(v / 1000).toFixed(1)}k`}
        onChange={(v) => set("fieldCount", v)}
        muted={!isPrimary("fieldCount")}
      />

      <Slider
        label="Spike threshold"
        hint="Higher = fewer diffraction crosses. Spikes are earned. Watch column B / bright anchors."
        value={params.spikeThreshold}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => set("spikeThreshold", v)}
        muted={!isPrimary("spikeThreshold")}
      />

      <Slider
        label="Bright anchors"
        hint="Authored foreground stars — the ones that actually spike."
        value={params.brightAnchors}
        min={0}
        max={80}
        step={1}
        format={(v) => String(Math.round(v))}
        onChange={(v) => set("brightAnchors", Math.round(v))}
        muted={!isPrimary("brightAnchors")}
      />

      <Slider
        label="Exposure"
        value={params.exposure}
        min={0.3}
        max={2}
        step={0.02}
        onChange={(v) => set("exposure", v)}
        muted={!isPrimary("exposure")}
      />

      <Slider
        label="Rank illumination"
        hint="Scales brightness AND the visibility floor — stars appear as it rises. Try Starseed → Celestial."
        value={params.illumination}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => set("illumination", v)}
        muted={!isPrimary("illumination")}
      />

      <div className={`hf-presets${isPrimary("illumination") ? "" : " is-muted"}`}>
        {RANK_PRESETS.map(([name, value]) => (
          <button
            key={name}
            type="button"
            className={
              Math.abs(params.illumination - value) < 0.005
                ? "hf-preset hf-preset--on"
                : "hf-preset"
            }
            onClick={() => set("illumination", value)}
          >
            {name}
          </button>
        ))}
      </div>

      <Slider
        label="Dust density"
        hint="Layered occluding planes in the band. 0 removes the dust entirely."
        value={params.dustDensity}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => set("dustDensity", v)}
        muted={!isPrimary("dustDensity")}
      />

      <label className={`hf-toggle${isPrimary("staticMode") ? "" : " is-muted"}`}>
        <input
          type="checkbox"
          checked={params.staticMode}
          onChange={(e) => set("staticMode", e.target.checked)}
        />
        <span>Static mode (freeze twinkle + drift)</span>
      </label>

      <label className={`hf-toggle${isPrimary("figureLines") ? "" : " is-muted"}`}>
        <input
          type="checkbox"
          checked={params.figureLines}
          onChange={(e) => set("figureLines", e.target.checked)}
          disabled={study !== "atlas"}
        />
        <span>Faint figure lines (atlas only)</span>
      </label>

      {focusName ? (
        <div className="hf-focus">
          <span className="hf-focus__label">Focused</span>
          <span className="hf-focus__name">{focusName}</span>
          <button type="button" className="hf-btn hf-btn--ghost" onClick={onClearFocus}>
            Clear focus
          </button>
        </div>
      ) : null}

      {readouts.length > 0 ? (
        <dl className="hf-readouts">
          {readouts.map(([k, v]) => (
            <div className="hf-readouts__row" key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="hf-panel__actions">
        <button type="button" className="hf-btn" onClick={copy}>
          {copied ? "Copied" : "Copy params JSON"}
        </button>
        <button
          type="button"
          className="hf-btn hf-btn--ghost"
          onClick={() => onChange({ ...DEFAULT_FIELD_PARAMS })}
        >
          Reset
        </button>
      </div>
    </aside>
  );
}

export default FieldControls;
