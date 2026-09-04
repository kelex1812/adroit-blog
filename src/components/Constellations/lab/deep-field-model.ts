/**
 * deep-field-model.ts — PURE deep-field generator (no three/r3f imports).
 *
 * Follows the pure-model rule (ADR-305): all of the field's design math lives
 * here, unit-testable, and the r3f layer (`deep-field-gl.tsx`) only uploads
 * the arrays this module produces.
 *
 * What makes the output read as a photograph rather than a scatter:
 *
 *   1. Magnitudes are sampled from a real luminosity function. The cumulative
 *      count of stars brighter than m goes as 10^(0.6m), so inverting it gives
 *      a distribution where the overwhelming majority are near-invisible and a
 *      handful dominate. A flat histogram is the single most common way a
 *      procedural starfield reads as clip-art.
 *   2. A small set of authored bright anchors is added on top, because real
 *      deep-field frames always contain a few foreground stars bright enough
 *      to throw spikes, and a pure random draw only produces one or two.
 *   3. Positions are anisotropic: most stars sit in a thin, tilted Milky Way
 *      band (two-sided exponential in galactic latitude) with the remainder in
 *      an isotropic halo. A uniform sphere reads as static noise.
 *   4. Radius is continuous and volume-uniform inside each shell, and
 *      magnitude is nudged by radius, so nearer stars are brighter and the
 *      field parallaxes as real depth.
 *   5. Spectral color comes from temperature only (the OBAFGKM ramp already
 *      authored in `star-model.ts`) — blue-white through white through amber,
 *      never a general red.
 *
 * Deterministic: identical params in, byte-identical arrays out.
 */
import { SPECTRAL_ARC, STAR_PALETTE, hashString, seededUnit } from "../3d/star-model";
import type { SpectralClass } from "../3d/star-model";

/* ------------------------------------------------------------------ */
/*  Color plumbing                                                     */
/* ------------------------------------------------------------------ */

/** sRGB channel (0..1) → linear. Matches three's color management. */
export function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * "#rrggbb" → linear RGB triple. The renderer works in linear space, so
 * uploading raw sRGB bytes would wash the spectral ramp out.
 */
export function hexToLinearRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const int = parseInt(full, 16);
  return [
    srgbToLinear(((int >> 16) & 0xff) / 255),
    srgbToLinear(((int >> 8) & 0xff) / 255),
    srgbToLinear((int & 0xff) / 255),
  ];
}

/**
 * Relative abundance of each spectral class in the field. Weighted toward the
 * mid arc (A–G) so the field is predominantly white with cool and warm
 * outliers; O is rare and M is capped, because a field full of amber stars
 * reads as sepia rather than as a sky.
 */
export const FIELD_SPECTRAL_WEIGHTS: ReadonlyArray<readonly [SpectralClass, number]> = [
  ["O", 0.012],
  ["B", 0.1],
  ["A", 0.22],
  ["F", 0.265],
  ["G", 0.2],
  ["K", 0.135],
  ["M", 0.068],
];

/** The hot end only — used for the bright anchors, which are foreground stars. */
const ANCHOR_SPECTRAL_WEIGHTS: ReadonlyArray<readonly [SpectralClass, number]> = [
  ["O", 0.09],
  ["B", 0.28],
  ["A", 0.3],
  ["F", 0.21],
  ["G", 0.12],
];

/** Pick a spectral class from a weighted table with a uniform draw. */
export function pickSpectralClass(
  u: number,
  weights: ReadonlyArray<readonly [SpectralClass, number]> = FIELD_SPECTRAL_WEIGHTS,
): SpectralClass {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let acc = 0;
  const target = Math.min(Math.max(u, 0), 0.999999) * total;
  for (const [cls, w] of weights) {
    acc += w;
    if (target < acc) return cls;
  }
  return weights[weights.length - 1]![0];
}

/* ------------------------------------------------------------------ */
/*  Luminosity function + spike gating                                 */
/* ------------------------------------------------------------------ */

/**
 * Invert the cumulative star count N(<m) ∝ 10^(0.6m) for a uniform draw.
 *
 * The result is heavily weighted to the faint end: with a window of
 * [-1, 8.2], half the stars land fainter than mag 8.0, roughly one in a
 * thousand clears mag 3.2, and one in twenty thousand clears mag 1.
 */
export function magnitudeFromUniform(u: number, magMin: number, magMax: number): number {
  const clamped = Math.min(Math.max(u, 1e-9), 1);
  const m = magMax + Math.log10(clamped) / 0.6;
  return Math.min(magMax, Math.max(magMin, m));
}

/** Magnitude at which a star starts to earn a diffraction cross. */
export const SPIKE_BRIGHT_CUT = 5.0;
/** Magnitude span from "first hint of a spike" to "full spike". */
export const SPIKE_SPAN = 4.2;

/**
 * Spike weight (0..1) from apparent magnitude. Combined with the shader's
 * `uSpikeThreshold`, the default settings leave a few dozen spiked stars in a
 * 30k field — "spikes are earned", not a lens-flare filter.
 */
export function spikeWeight(magnitude: number): number {
  const w = (SPIKE_BRIGHT_CUT - magnitude) / SPIKE_SPAN;
  return Math.min(1, Math.max(0, w));
}

/* ------------------------------------------------------------------ */
/*  Deterministic PRNG                                                 */
/* ------------------------------------------------------------------ */

/**
 * mulberry32, seeded from the shared FNV-1a hash so a string seed maps to a
 * reproducible stream. Used instead of per-star `seededUnit` calls because a
 * 40k-star field needs ~300k draws and string building dominates at that size;
 * `seededUnit` still seeds the stream and the authored anchors.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  Milky Way band geometry                                            */
/* ------------------------------------------------------------------ */

export interface BandParams {
  /** Fraction of stars that belong to the band (rest go to the halo). */
  bandFraction: number;
  /** Band thickness as an exponential scale height in radians. */
  bandScaleHeight: number;
  /** Band tilt about Z (radians) — swings the band diagonally in frame. */
  tiltZ: number;
  /** Band tilt about X (radians) — rolls the band toward/away from camera. */
  tiltX: number;
}

export const DEFAULT_BAND: BandParams = {
  bandFraction: 0.6,
  bandScaleHeight: 0.1,
  tiltZ: -0.38,
  tiltX: 0.26,
};

/**
 * A unit direction inside the tilted Milky Way band.
 *
 * Galactic latitude is drawn from a two-sided exponential, which produces a
 * thin core with soft, ragged edges — the shape a real band has. Longitude is
 * warped by a sine so one side of the band is denser than the other, giving
 * the field a bright core region instead of a uniform stripe.
 */
export function bandDirection(
  uLon: number,
  uSide: number,
  uLat: number,
  band: BandParams,
): [number, number, number] {
  const l = uLon * Math.PI * 2 + 0.55 * Math.sin(uLon * Math.PI * 2);
  const height = Math.min(
    Math.PI / 2,
    -Math.log(1 - Math.min(uLat, 0.9995)) * band.bandScaleHeight,
  );
  const b = (uSide < 0.5 ? -1 : 1) * height;
  return rotateDirection(
    [Math.cos(b) * Math.cos(l), Math.sin(b), Math.cos(b) * Math.sin(l)],
    band,
  );
}

/** An isotropic unit direction (the halo population). */
export function haloDirection(uTheta: number, uPhi: number): [number, number, number] {
  const theta = uTheta * Math.PI * 2;
  const phi = Math.acos(2 * uPhi - 1);
  return [
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ];
}

/** Apply the band tilt (Z then X) to a direction. */
export function rotateDirection(
  dir: [number, number, number],
  band: BandParams,
): [number, number, number] {
  const [x, y, z] = dir;
  const cz = Math.cos(band.tiltZ);
  const sz = Math.sin(band.tiltZ);
  const x1 = x * cz - y * sz;
  const y1 = x * sz + y * cz;
  const cx = Math.cos(band.tiltX);
  const sx = Math.sin(band.tiltX);
  return [x1, y1 * cx - z * sx, y1 * sx + z * cx];
}

/* ------------------------------------------------------------------ */
/*  Shells                                                             */
/* ------------------------------------------------------------------ */

export interface ShellSpec {
  key: "near" | "mid" | "far";
  count: number;
  rMin: number;
  rMax: number;
  /** Brightest magnitude this shell's luminosity function will produce. */
  magMin: number;
  /** Faintest magnitude (the peak of the distribution). */
  magMax: number;
  /** Authored bright foreground stars added to this shell. */
  anchors: number;
  /** Base point-size multiplier — far shells draw smaller. */
  baseSize: number;
  /** Draw order, so dust layers can sit between shells and truly occlude. */
  renderOrder: number;
  /** Camera-distance fade window. */
  fade: [number, number];
}

/**
 * Three continuous shells rather than one sphere. Each shell has its own
 * radius range, magnitude window and draw order; the near shell carries the
 * bright anchors, and the far shell carries the bulk of the faint population.
 */
export function shellSpecs(fieldCount: number, brightAnchors = 18): ShellSpec[] {
  const total = Math.max(600, Math.round(fieldCount));
  return [
    {
      key: "far",
      count: Math.round(total * 0.64),
      rMin: 42,
      rMax: 150,
      magMin: 2.6,
      magMax: 9.2,
      anchors: 0,
      baseSize: 1.0,
      renderOrder: 0,
      fade: [40, 190],
    },
    {
      key: "mid",
      count: Math.round(total * 0.27),
      rMin: 17,
      rMax: 42,
      magMin: 1.4,
      magMax: 8.2,
      anchors: Math.round(brightAnchors * 0.35),
      baseSize: 0.9,
      renderOrder: 4,
      fade: [16, 70],
    },
    {
      key: "near",
      count: Math.round(total * 0.09),
      rMin: 6,
      rMax: 17,
      magMin: -1.4,
      magMax: 7.0,
      anchors: Math.round(brightAnchors * 0.65),
      baseSize: 0.82,
      renderOrder: 12,
      fade: [5, 30],
    },
  ];
}

export interface FieldAttributes {
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  magnitudes: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
  spikes: Float32Array;
}

/**
 * Build one shell's typed attribute arrays.
 *
 * The first `spec.anchors` stars are the authored bright foreground: their
 * magnitude is drawn from a narrow bright window and their spectral class from
 * the hot end of the arc, which is what guarantees the frame contains a few
 * spiked stars at any field count.
 */
export function buildShellAttributes(
  spec: ShellSpec,
  band: BandParams = DEFAULT_BAND,
  seed = "hubble-field",
): FieldAttributes {
  const count = Math.max(0, spec.count);
  const rnd = mulberry32(hashString(`${seed}:${spec.key}`));

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const spikes = new Float32Array(count);

  const r3Min = spec.rMin ** 3;
  const r3Span = spec.rMax ** 3 - r3Min;

  for (let i = 0; i < count; i++) {
    const isAnchor = i < spec.anchors;

    // Volume-uniform radius inside the shell — a linear draw would pile stars
    // near the inner surface and hollow out the depth.
    const r = Math.cbrt(r3Min + rnd() * r3Span);

    const inBand = rnd() < band.bandFraction;
    const dir = inBand
      ? bandDirection(rnd(), rnd(), rnd(), band)
      : haloDirection(rnd(), rnd());

    positions[i * 3] = dir[0] * r;
    positions[i * 3 + 1] = dir[1] * r;
    positions[i * 3 + 2] = dir[2] * r;

    // Nearer stars within the shell run slightly brighter, so radius and
    // brightness correlate the way distance modulus makes them correlate.
    const depth = (r - spec.rMin) / Math.max(spec.rMax - spec.rMin, 1e-6);
    const mag = isAnchor
      ? spec.magMin + rnd() * 3.4
      : magnitudeFromUniform(rnd(), spec.magMin, spec.magMax) + depth * 1.1;

    magnitudes[i] = Number(mag.toFixed(3));
    spikes[i] = Number(spikeWeight(mag).toFixed(4));

    const cls = pickSpectralClass(
      rnd(),
      isAnchor ? ANCHOR_SPECTRAL_WEIGHTS : FIELD_SPECTRAL_WEIGHTS,
    );
    const [cr, cg, cb] = hexToLinearRgb(SPECTRAL_ARC[cls].color);
    colors[i * 3] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;

    phases[i] = rnd() * Math.PI * 2;
    speeds[i] = Number((0.35 + rnd() * 2.1).toFixed(3));
  }

  return { count, positions, colors, magnitudes, phases, speeds, spikes };
}

/**
 * Histogram of a shell's magnitudes in 1-mag bins from `from`.
 * Exists so the steepness of the luminosity function is assertable rather than
 * eyeballed — a flat histogram is a rejection condition, not a taste call.
 */
export function magnitudeHistogram(
  magnitudes: Float32Array | number[],
  from = -2,
  bins = 13,
): number[] {
  const out = new Array<number>(bins).fill(0);
  for (const m of magnitudes) {
    const idx = Math.floor(m - from);
    if (idx >= 0 && idx < bins) out[idx]! += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Figure stars (asterisms) → the same attribute layout               */
/* ------------------------------------------------------------------ */

/** One member star of a course figure, as the atlas/compare studies see it. */
export interface FigureStar {
  name: string;
  position: [number, number, number];
  spectralClass: SpectralClass;
  magnitude: number;
  /** Lesson completed → the star burns; otherwise it is a faint marker. */
  lit: boolean;
  /** Whole course complete → lit members run white-hot. */
  complete?: boolean;
  /** ADR-303: the one astronomically-real red giant keeps its true tint. */
  isRedGiantAccent?: boolean;
  isNebula?: boolean;
  /**
   * Chart hierarchy (2D atlas): lessons stay quiet; knowledge checks punch;
   * the exam is the crown that completes the figure.
   */
  role?: "lesson" | "check" | "exam";
}

/**
 * Project a course figure into the same attribute layout the field uses, so
 * asterisms and background stars are drawn by ONE shader and cannot drift
 * apart visually.
 *
 * Progress is encoded in brightness, not in chrome: an unlit lesson keeps its
 * real position but is pushed several magnitudes fainter and desaturated
 * toward the slate `unlit` palette color, so "which stars are lit" is the only
 * progress readout the scene needs.
 */
export function buildFigureAttributes(
  stars: readonly FigureStar[],
  opts: { origin?: [number, number, number]; scale?: number; seed?: string } = {},
): FieldAttributes {
  const { origin = [0, 0, 0], scale = 1, seed = "figure" } = opts;
  const count = stars.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const spikes = new Float32Array(count);

  const unlitRgb = hexToLinearRgb(STAR_PALETTE.unlit.color);

  stars.forEach((s, i) => {
    positions[i * 3] = origin[0] + s.position[0] * scale;
    positions[i * 3 + 1] = origin[1] + s.position[1] * scale;
    positions[i * 3 + 2] = origin[2] + s.position[2] * scale;

    // Unlit lessons drop 4.2 magnitudes — visible as a pinprick, never as a
    // competing light source.
    const mag = s.lit ? s.magnitude : s.magnitude + 4.2;
    magnitudes[i] = Number(mag.toFixed(3));
    spikes[i] = s.lit ? Number(spikeWeight(mag).toFixed(4)) : 0;

    const baseHex = s.isRedGiantAccent
      ? "#ff7a3d"
      : s.isNebula
        ? "#ffd9a8"
        : SPECTRAL_ARC[s.spectralClass].color;
    const [r, g, b] = hexToLinearRgb(baseHex);
    if (s.lit) {
      // A completed course pushes its members toward white-hot.
      const w = s.complete ? 0.45 : 0;
      colors[i * 3] = r + (1 - r) * w;
      colors[i * 3 + 1] = g + (1 - g) * w;
      colors[i * 3 + 2] = b + (1 - b) * w;
    } else {
      colors[i * 3] = unlitRgb[0];
      colors[i * 3 + 1] = unlitRgb[1];
      colors[i * 3 + 2] = unlitRgb[2];
    }

    const u = seededUnit(`${seed}:${s.name}`);
    phases[i] = u * Math.PI * 2;
    speeds[i] = Number((0.4 + seededUnit(`${seed}:${s.name}:spd`) * 1.9).toFixed(3));
  });

  return { count, positions, colors, magnitudes, phases, speeds, spikes };
}

/** Flatten figure connections into a LineSegments position buffer. */
export function buildFigureLines(
  stars: readonly FigureStar[],
  connections: ReadonlyArray<readonly [number, number]>,
  opts: { origin?: [number, number, number]; scale?: number } = {},
): Float32Array {
  const { origin = [0, 0, 0], scale = 1 } = opts;
  const usable = connections.filter(
    ([a, b]) => stars[a] !== undefined && stars[b] !== undefined,
  );
  const out = new Float32Array(usable.length * 6);
  usable.forEach(([a, b], i) => {
    const pa = stars[a]!.position;
    const pb = stars[b]!.position;
    out[i * 6] = origin[0] + pa[0] * scale;
    out[i * 6 + 1] = origin[1] + pa[1] * scale;
    out[i * 6 + 2] = origin[2] + pa[2] * scale;
    out[i * 6 + 3] = origin[0] + pb[0] * scale;
    out[i * 6 + 4] = origin[1] + pb[1] * scale;
    out[i * 6 + 5] = origin[2] + pb[2] * scale;
  });
  return out;
}
