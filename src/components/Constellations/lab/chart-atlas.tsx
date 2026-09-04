/**
 * chart-atlas.tsx — 2D course map with mythic figure art (lab).
 *
 * The Urania's Mirror answer to "dots and lines aren't exciting": each course
 * constellation carries an engraved figure of what it depicts, drawn behind
 * the star lines. Art is gold-on-black PNG composited with `mix-blend-mode:
 * screen`, so the black plate disappears into the sky and only the engraving
 * shows — no cut-out masks, no per-asset alpha work.
 *
 * Art placement is per-figure (`FIGURE_ART`): scale is a multiple of the star
 * figure's span, dx/dy nudge it so the drawing sits over the right stars.
 */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  LAB_COURSES,
  labFigures,
  type LabFigure,
} from "./field-fixtures";
import { bgStars, NEBULAE } from "./chart-sky";
import "./chart-2d.css";

interface FigureArt {
  src: string;
  /** Size as a multiple of the star figure's span. */
  scale: number;
  /** Offset in units of the star figure's span. */
  dx: number;
  dy: number;
}

/** Engraved figures — generated for the lab, gold line art on black. */
const FIGURE_ART: Record<string, FigureArt> = {
  "salesforce-architect": { src: "/constellations/orion.png", scale: 2.5, dx: 0, dy: -0.08 },
  "agentic-ai": { src: "/constellations/cassiopeia.png", scale: 2.3, dx: 0, dy: -0.1 },
  "omni-studio-cert": { src: "/constellations/lyra.png", scale: 2.4, dx: 0, dy: -0.05 },
  "hermes-consultant": { src: "/constellations/corvus.png", scale: 2.2, dx: 0, dy: 0 },
  "hermes-consultant-intermediate": { src: "/constellations/delphinus.png", scale: 2.3, dx: 0, dy: 0 },
  "hermes-consultant-advanced": { src: "/constellations/corona.png", scale: 2.4, dx: 0, dy: 0.05 },
  "ai-at-work": { src: "/constellations/cygnus.png", scale: 2.5, dx: 0, dy: 0 },
};

/**
 * Ghost keying. The engravings ship as gold-on-black, so alpha is taken from
 * luminance (`0.32 0.55 0.13`) and the colour is replaced with a flat tint in
 * the matrix's constant column. Result: the black plate vanishes and the
 * linework survives as a single luminous colour whose density follows the
 * original hatching — spectral rather than printed.
 *
 * Cool tint = still being earned. Warm gold = course complete.
 */
function ghostFilter(id: string, tint: [number, number, number], blur: number) {
  return (
    <filter
      key={id}
      id={id}
      colorInterpolationFilters="sRGB"
      x="-30%"
      y="-30%"
      width="160%"
      height="160%"
    >
      <feColorMatrix
        type="matrix"
        values={`0 0 0 0 ${tint[0]}
                 0 0 0 0 ${tint[1]}
                 0 0 0 0 ${tint[2]}
                 0.32 0.55 0.13 0 0`}
        result="keyed"
      />
      <feGaussianBlur in="keyed" stdDeviation={blur} />
    </filter>
  );
}

const COOL: [number, number, number] = [0.68, 0.81, 1];
const WARM: [number, number, number] = [1, 0.85, 0.62];

const GHOST_FILTERS = (
  <>
    {ghostFilter("hf2-ghost", COOL, 0.7)}
    {ghostFilter("hf2-ghost-halo", COOL, 6)}
    {ghostFilter("hf2-ghost-gold", WARM, 0.7)}
    {ghostFilter("hf2-ghost-gold-halo", WARM, 6)}
  </>
);


/** Faint atlas graticule — concentric rings and spokes, cartographic depth. */
function Graticule() {
  const spokes = [];
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    spokes.push(
      <line
        key={a}
        className={a % 45 === 0 ? "hf2-spoke is-major" : "hf2-spoke"}
        x1={500 + Math.cos(rad) * 150}
        y1={520 + Math.sin(rad) * 150}
        x2={500 + Math.cos(rad) * 440}
        y2={520 + Math.sin(rad) * 440}
      />,
    );
  }
  return (
    <g className="hf2-graticule">
      {[150, 265, 380, 440].map((r) => (
        <circle key={r} className="hf2-grat-ring" cx={500} cy={520} r={r} fill="none" />
      ))}
      {spokes}
    </g>
  );
}

function chartLayout(figures: LabFigure[]): Array<{
  figure: LabFigure;
  cx: number;
  cy: number;
  scale: number;
}> {
  const slots: Array<[number, number, number]> = [
    [235, 265, 1.5],
    [700, 235, 1.35],
    [845, 520, 1.2],
    [150, 620, 1.15],
    [495, 555, 1.2],
    [755, 785, 1.15],
    [325, 830, 1.25],
  ];
  return figures.map((figure, i) => {
    const [cx, cy, scale] = slots[i] ?? [500, 500, 1];
    return { figure, cx, cy, scale };
  });
}

function structuralIndices(figure: LabFigure): number[] {
  const set = new Set<number>();
  for (const [a, b] of figure.connections) {
    set.add(a);
    set.add(b);
  }
  return [...set].sort((a, b) => a - b);
}

function boundsOf(figure: LabFigure, indices: number[]) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const i of indices) {
    const s = figure.stars[i]!;
    minX = Math.min(minX, s.position[0]);
    maxX = Math.max(maxX, s.position[0]);
    minY = Math.min(minY, s.position[1]);
    maxY = Math.max(maxY, s.position[1]);
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    w: Math.max(maxX - minX, 0.4),
    h: Math.max(maxY - minY, 0.4),
  };
}

function diamond(x: number, y: number, r: number): string {
  return `M${x},${y - r} L${x + r * 0.7},${y} L${x},${y + r} L${x - r * 0.7},${y} Z`;
}

function FigureSvg({
  figure,
  cx,
  cy,
  scale,
  focused,
  dimmed,
  showArt,
  index,
  onSelect,
}: {
  figure: LabFigure;
  cx: number;
  cy: number;
  scale: number;
  focused: boolean;
  dimmed: boolean;
  showArt: boolean;
  index: number;
  onSelect: () => void;
}) {
  const struct = useMemo(() => structuralIndices(figure), [figure]);
  const b = useMemo(() => boundsOf(figure, struct), [figure, struct]);
  const unit = 70 * scale;

  const toX = (x: number) => cx + ((x - (b.minX + b.maxX) / 2) / b.w) * unit;
  const toY = (y: number) => cy - ((y - (b.minY + b.maxY) / 2) / b.h) * unit;

  const progress =
    figure.totalStars > 0 ? figure.litStars / figure.totalStars : 0;

  const rails = figure.connections.filter(
    ([a, bi]) => figure.stars[a] && figure.stars[bi],
  );
  const litCount = Math.round(rails.length * progress);

  const examIdx =
    struct.find((i) => figure.stars[i]?.role === "exam") ??
    struct.find((i) => figure.stars[i]?.isNebula) ??
    struct[Math.floor(struct.length / 2)]!;

  const checkIdxs = struct
    .filter((i) => i !== examIdx && figure.stars[i]?.role === "check")
    .slice(0, 2);
  const checks =
    checkIdxs.length > 0
      ? checkIdxs
      : struct
          .filter((i) => i !== examIdx)
          .filter((_, n) => n === 1 || n === 3)
          .slice(0, 2);

  const pct = Math.round(progress * 100);
  const art = FIGURE_ART[figure.seriesSlug];
  const artSize = art ? unit * art.scale : 0;
  const artX = cx - artSize / 2 + (art?.dx ?? 0) * unit;
  const artY = cy - artSize / 2 + (art?.dy ?? 0) * unit;

  return (
    <g
      className={`hf2-figure${focused ? " is-focused" : ""}${dimmed ? " is-dimmed" : ""}${figure.complete ? " is-complete" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${figure.figureName} constellation — ${figure.name}, ${pct}% complete`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Depth: a pool of deeper sky so the apparition has somewhere to sit */}
      <ellipse
        className="hf2-pocket"
        cx={cx}
        cy={cy}
        rx={unit * 1.35}
        ry={unit * 1.25}
        fill="url(#hf2-pocket)"
      />

      {/* Apparition — halo pass behind, keyed pass in front */}
      {showArt && art ? (
        <g
          className="hf2-art-group"
          mask="url(#hf2-fade)"
          style={{ animationDelay: `${-index * 1.7}s` }}
        >
          <image
            className="hf2-art-halo"
            href={art.src}
            x={artX}
            y={artY}
            width={artSize}
            height={artSize}
            preserveAspectRatio="xMidYMid meet"
            filter={figure.complete ? "url(#hf2-ghost-gold-halo)" : "url(#hf2-ghost-halo)"}
          />
          <image
            className="hf2-art"
            href={art.src}
            x={artX}
            y={artY}
            width={artSize}
            height={artSize}
            preserveAspectRatio="xMidYMid meet"
            filter={figure.complete ? "url(#hf2-ghost-gold)" : "url(#hf2-ghost)"}
          />
        </g>
      ) : null}

      {/* Achievement ring — closes only when the exam is passed */}
      {figure.complete ? (
        <circle className="hf2-ring" cx={cx} cy={cy} r={unit * 0.95} fill="none" />
      ) : null}

      {/* Dark casing keeps the star lines legible on top of the artwork */}
      {rails.map(([a, bi], i) => {
        const sa = figure.stars[a]!;
        const sb = figure.stars[bi]!;
        return (
          <line
            key={`c-${i}`}
            className="hf2-line-case"
            x1={toX(sa.position[0])}
            y1={toY(sa.position[1])}
            x2={toX(sb.position[0])}
            y2={toY(sb.position[1])}
          />
        );
      })}

      {/* Full figure outline */}
      {rails.map(([a, bi], i) => {
        const sa = figure.stars[a]!;
        const sb = figure.stars[bi]!;
        return (
          <line
            key={`g-${i}`}
            className="hf2-line"
            x1={toX(sa.position[0])}
            y1={toY(sa.position[1])}
            x2={toX(sb.position[0])}
            y2={toY(sb.position[1])}
          />
        );
      })}

      {/* Progress lights the same lines */}
      {rails.slice(0, litCount).map(([a, bi], i) => {
        const sa = figure.stars[a]!;
        const sb = figure.stars[bi]!;
        return (
          <line
            key={`p-${i}`}
            className="hf2-line-lit"
            x1={toX(sa.position[0])}
            y1={toY(sa.position[1])}
            x2={toX(sb.position[0])}
            y2={toY(sb.position[1])}
          />
        );
      })}

      {/*
        Energy travelling the finished path. `pathLength={100}` normalises every
        rail so one dash spec produces the same spark speed on long and short
        segments; the stagger makes it read as flow around the figure.
      */}
      {rails.slice(0, litCount).map(([a, bi], i) => {
        const sa = figure.stars[a]!;
        const sb = figure.stars[bi]!;
        return (
          <line
            key={`f-${i}`}
            className="hf2-line-flow"
            pathLength={100}
            x1={toX(sa.position[0])}
            y1={toY(sa.position[1])}
            x2={toX(sb.position[0])}
            y2={toY(sb.position[1])}
            style={{ animationDelay: `${-(index * 0.9 + i * 0.55)}s` }}
          />
        );
      })}

      {/* Joint vertices */}
      {struct.map((i) => {
        if (i === examIdx || checks.includes(i)) return null;
        const s = figure.stars[i]!;
        return (
          <circle
            key={`v-${i}`}
            className="hf2-dot"
            cx={toX(s.position[0])}
            cy={toY(s.position[1])}
            r={focused ? 2.2 : 1.8}
          />
        );
      })}

      {/* Knowledge checks */}
      {checks.map((i) => {
        const s = figure.stars[i]!;
        const on = s.lit || progress >= 0.4;
        return (
          <path
            key={`k-${i}`}
            className={`hf2-check${on ? " is-on" : ""}`}
            d={diamond(toX(s.position[0]), toY(s.position[1]), focused ? 4.5 : 3.5)}
          />
        );
      })}

      {/* Final exam */}
      {(() => {
        const s = figure.stars[examIdx]!;
        const x = toX(s.position[0]);
        const y = toY(s.position[1]);
        return (
          <g className={`hf2-exam${figure.complete ? " is-on" : ""}`}>
            {figure.complete ? (
              <circle
                className="hf2-exam-pulse"
                cx={x}
                cy={y}
                r={focused ? 7 : 5.5}
                fill="none"
                style={{ animationDelay: `${-index * 0.8}s` }}
              />
            ) : null}
            <circle className="hf2-exam-ring" cx={x} cy={y} r={focused ? 7 : 5.5} fill="none" />
            <circle className="hf2-exam-dot" cx={x} cy={y} r={focused ? 3.2 : 2.6} />
          </g>
        );
      })()}

      <text className="hf2-label" x={cx} y={cy + unit * 0.78}>
        {figure.figureName}
      </text>
      <text className="hf2-course" x={cx} y={cy + unit * 0.78 + 14}>
        {figure.name.length > 36 ? `${figure.name.slice(0, 34)}…` : figure.name}
      </text>
      <text className="hf2-pct" x={cx} y={cy + unit * 0.78 + 28}>
        {figure.complete ? "Course complete" : `${pct}% learned`}
      </text>
    </g>
  );
}

/**
 * The chart is pure SVG, so it deliberately takes no `FieldParams` — the lab
 * sliders drive the WebGL studies only, and `FieldControls` already mutes them
 * for this study.
 */
export function ChartAtlasStudy({
  focusSlug,
  onFocusChange,
}: {
  focusSlug: string | null;
  onFocusChange: (slug: string | null) => void;
}) {
  const figures = useMemo(() => labFigures(1), []);
  const layout = useMemo(() => chartLayout(figures), [figures]);
  const focused = figures.find((f) => f.seriesSlug === focusSlug) ?? null;
  const [showArt, setShowArt] = useState(true);

  const far = useMemo(() => bgStars(260, "far", [0.4, 1.1], [0.12, 0.4]), []);
  const mid = useMemo(() => bgStars(120, "mid", [0.8, 1.7], [0.3, 0.65]), []);
  const near = useMemo(() => bgStars(36, "near", [1.4, 2.4], [0.5, 0.9]), []);

  /*
   * Parallax is written straight to CSS custom properties rather than React
   * state — pointer moves would otherwise re-render seven figures plus 400
   * stars on every frame.
   */
  const rootRef = useRef<HTMLDivElement>(null);
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--hf2-px", String((e.clientX - r.left) / r.width - 0.5));
    el.style.setProperty("--hf2-py", String((e.clientY - r.top) / r.height - 0.5));
  }, []);
  const onPointerLeave = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty("--hf2-px", "0");
    el.style.setProperty("--hf2-py", "0");
  }, []);

  return (
    <div
      className="hf2"
      data-testid="hf-chart-atlas"
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <header className="hf2-intro">
        <p className="hf2-intro-title">Your learning sky</p>
        <p className="hf2-intro-copy">
          Each constellation is a course, drawn as the figure it depicts. The
          star lines light up as you finish lessons.
        </p>
        <label className="hf2-toggle">
          <input
            type="checkbox"
            checked={showArt}
            onChange={(e) => setShowArt(e.target.checked)}
          />
          <span>Show figure drawings</span>
        </label>
      </header>

      <svg
        className="hf2-svg"
        viewBox="0 0 1000 1000"
        role="img"
        aria-label="Map of your courses as constellation figures"
      >
        <defs>
          {GHOST_FILTERS}

          {/*
            Figures fade at the crown and the feet so they read as apparitions
            in the sky rather than stickers pasted on the plate.
          */}
          <linearGradient id="hf2-fade-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.16" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="0.62" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.9" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="hf2-fade" maskContentUnits="objectBoundingBox">
            <rect width="1" height="1" fill="url(#hf2-fade-grad)" />
          </mask>

          {/* Depth pocket: each figure sits in its own pool of deeper sky. */}
          <radialGradient id="hf2-pocket">
            <stop offset="0" stopColor="#0a1428" stopOpacity="0.85" />
            <stop offset="0.6" stopColor="#070d1c" stopOpacity="0.45" />
            <stop offset="1" stopColor="#05070e" stopOpacity="0" />
          </radialGradient>

          {/* The dome itself — brighter toward the centre so it reads curved. */}
          <radialGradient id="hf2-dome">
            <stop offset="0" stopColor="#22376a" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="#14224a" stopOpacity="0.8" />
            <stop offset="0.75" stopColor="#0b1230" stopOpacity="0.5" />
            <stop offset="1" stopColor="#05070e" stopOpacity="0" />
          </radialGradient>

          {/* Halo for the handful of foreground stars. */}
          <filter id="hf2-starglow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>

          {/* Nebula clouds. Colour is carried almost entirely by alpha. */}
          {NEBULAE.map((n) => (
            <radialGradient key={n.id} id={n.id}>
              <stop offset="0" stopColor={n.color} stopOpacity={n.alpha} />
              <stop offset="0.5" stopColor={n.color} stopOpacity={n.alpha * 0.4} />
              <stop offset="1" stopColor={n.color} stopOpacity="0" />
            </radialGradient>
          ))}

          <radialGradient id="hf2-vignette">
            <stop offset="0.62" stopColor="#05070e" stopOpacity="0" />
            <stop offset="0.88" stopColor="#04060c" stopOpacity="0.22" />
            <stop offset="1" stopColor="#02040a" stopOpacity="0.6" />
          </radialGradient>

          <linearGradient id="hf2-shoot" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#cfe4ff" stopOpacity="0" />
            <stop offset="1" stopColor="#eaf3ff" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* ---- Far: dome, nebulae, deep star field ---- */}
        <g className="hf2-par hf2-par-far">
          <circle cx="500" cy="520" r="520" fill="url(#hf2-dome)" />
          {NEBULAE.map((n) => (
            <ellipse
              key={n.id}
              className="hf2-neb"
              cx={n.cx}
              cy={n.cy}
              rx={n.rx}
              ry={n.ry}
              fill={`url(#${n.id})`}
              transform={`rotate(${n.rot} ${n.cx} ${n.cy})`}
              style={{ animationDuration: `${n.drift}s`, animationDelay: `-${n.rot}s` }}
            />
          ))}
          {far.map((s, i) => (
            <circle key={i} className="hf2-bg-star" cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
          ))}
        </g>

        {/* ---- Mid: graticule, plate edge, twinkling field ---- */}
        <g className="hf2-par hf2-par-mid">
          <Graticule />
          <circle className="hf2-plate" cx="500" cy="520" r="440" fill="none" />
          {mid.map((s, i) => (
            <circle
              key={i}
              className="hf2-bg-star is-twinkle"
              cx={s.x}
              cy={s.y}
              r={s.r}
              opacity={s.o}
              style={{
                animationDuration: `${s.dur}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
        </g>

        {/* ---- Near: the courses ---- */}
        <g className="hf2-par hf2-par-near">
          <g filter="url(#hf2-starglow)">
            {near.map((s, i) => (
              <circle
                key={i}
                className="hf2-bg-star is-near"
                cx={s.x}
                cy={s.y}
                r={s.r * 1.6}
                opacity={s.o * 0.55}
              />
            ))}
          </g>
          {near.map((s, i) => (
            <circle
              key={i}
              className="hf2-bg-star is-twinkle is-near"
              cx={s.x}
              cy={s.y}
              r={s.r}
              opacity={s.o}
              style={{
                animationDuration: `${s.dur}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}

          {layout.map(({ figure, cx, cy, scale }, i) => (
            <FigureSvg
              key={figure.seriesSlug}
              figure={figure}
              cx={cx}
              cy={cy}
              scale={scale * (focusSlug === figure.seriesSlug ? 1.08 : 1)}
              focused={focusSlug === figure.seriesSlug}
              dimmed={Boolean(focusSlug && focusSlug !== figure.seriesSlug)}
              showArt={showArt}
              index={i}
              onSelect={() =>
                onFocusChange(
                  focusSlug === figure.seriesSlug ? null : figure.seriesSlug,
                )
              }
            />
          ))}
        </g>

        {/* Occasional meteors — the sky is alive, not a screenshot */}
        <g className="hf2-shooters">
          <line className="hf2-shoot" x1="0" y1="0" x2="90" y2="0" stroke="url(#hf2-shoot)" />
          <line className="hf2-shoot is-b" x1="0" y1="0" x2="70" y2="0" stroke="url(#hf2-shoot)" />
        </g>

        <rect
          className="hf2-vignette"
          x="-60"
          y="-60"
          width="1120"
          height="1120"
          fill="url(#hf2-vignette)"
        />
      </svg>

      <aside className="hf2-inspect">
        {focused ? (
          <>
            <p className="hf2-kicker">Course</p>
            <h3 className="hf2-title">{focused.name}</h3>
            <p className="hf2-meta">
              Drawn as <strong>{focused.figureName}</strong>
              {" · "}
              {focused.complete
                ? "Finished — exam passed"
                : `${focused.litStars} of ${focused.totalStars} lessons done`}
            </p>
            <p className="hf2-hint">
              Click another figure to switch. A CTA here would open the course.
            </p>
            <button
              type="button"
              className="hf2-clear"
              onClick={() => onFocusChange(null)}
            >
              Show all courses
            </button>
          </>
        ) : (
          <>
            <p className="hf2-kicker">How to read this</p>
            <h3 className="hf2-title">{LAB_COURSES.length} courses</h3>
            <ul className="hf2-howto">
              <li>
                <i className="hf2-ico-line" /> Constellation = one course
              </li>
              <li>
                <i className="hf2-ico-lit" /> Bright lines = progress
              </li>
              <li>
                <i className="hf2-ico-check" /> Diamond = knowledge check
              </li>
              <li>
                <i className="hf2-ico-exam" /> Ringed star = final exam
              </li>
            </ul>
            <p className="hf2-hint">Click any figure to focus it.</p>
          </>
        )}
      </aside>
    </div>
  );
}

export default ChartAtlasStudy;
